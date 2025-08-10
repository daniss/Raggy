import uuid
import logging
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Query, Request
from app.models.schemas import UploadResponse, DocumentInfo
from app.core.deps import get_current_user, get_demo_org_id
from app.core.validation import validate_file_type, validate_file_size, validate_filename, sanitize_filename, validate_search_query, validate_pagination_params
from app.core.audit_middleware import get_request_info
from app.services.audit_logger import audit_logger, AuditAction
from app.core.redis_cache import redis_cache
from app.rag import document_loader, document_splitter, adaptive_splitter, retriever
from app.core.config import settings
from app.db.supabase_client import save_document_info, update_document_status, delete_document, get_documents_list
from app.rag.supabase_retriever import supabase_retriever
from app.services.batch_processor import batch_processor, BatchStatus
from app.services.task_handlers import enqueue_document_processing
from app.services.background_jobs import JobPriority
from datetime import datetime, timezone
from app.core.file_constants import ALLOWED_FILE_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/", response_model=UploadResponse)
async def upload_documents(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and process documents for the knowledge base.
    Always uses background jobs for async processing to prevent timeouts.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        logger.info(f"Processing {len(files)} uploaded files")
        
        total_chunks = 0
        processed_files = []
        
        for file in files:
            try:
                # Validate file
                if not file.filename:
                    logger.warning("File without filename skipped")
                    continue
                
                # Validate filename
                if not validate_filename(file.filename):
                    logger.warning(f"Invalid filename: {file.filename}")
                    continue
                
                # Sanitize filename
                safe_filename = sanitize_filename(file.filename)
                
                # Read file content
                file_content = await file.read()
                if not file_content:
                    logger.warning(f"Empty file: {safe_filename}")
                    continue
                
                # Validate file size
                if not validate_file_size(len(file_content)):
                    logger.warning(f"File too large: {safe_filename} ({len(file_content)} bytes)")
                    continue
                
                # Validate file type
                if not validate_file_type(file.content_type or "text/plain", ALLOWED_FILE_TYPES):
                    logger.warning(f"Unsupported file type: {file.content_type} for {safe_filename}")
                    continue
                
                logger.info(f"Processing file: {safe_filename} ({len(file_content)} bytes)")
                
                # Save document info to Supabase
                demo_org_id = get_demo_org_id()
                document_id = await save_document_info(
                    filename=safe_filename,
                    content_type=file.content_type or "text/plain",
                    size_bytes=len(file_content),
                    file_path="",  # We don't store files, just process them
                    user_id=current_user.get("id") if current_user else None,
                    organization_id=demo_org_id
                )
                
                try:
                    # Always use background job for async processing to prevent timeouts
                    job_id = await enqueue_document_processing(
                        filename=file.filename,
                        content=file_content,
                        content_type=file.content_type or "text/plain",
                        user_id=current_user.get("id") if current_user else "anonymous",
                        metadata={
                            "document_id": document_id,
                            "organization_id": current_org["id"],
                            "upload_date": datetime.now(timezone.utc).isoformat(),
                            "file_size": len(file_content)
                        },
                        priority=JobPriority.HIGH if len(files) == 1 else JobPriority.NORMAL
                    )
                    
                    # Update document status to processing
                    await update_document_status(
                        document_id=document_id,
                        status="processing"
                    )
                    
                    processed_files.append({
                        "filename": file.filename,
                        "chunks": 0,  # Will be updated by background job
                        "document_ids": [],
                        "document_id": document_id,
                        "job_id": job_id,
                        "status": "processing"
                    })
                    
                    logger.info(f"Queued {file.filename} for background processing (job_id: {job_id})")
                    
                    # Log audit event for successful upload
                    client_ip, user_agent = get_request_info(request)
                    await audit_logger.log_document_event(
                        action=AuditAction.DOCUMENT_UPLOAD,
                        organization_id=current_org["id"],
                        user_id=current_user.get("id"),
                        document_id=document_id,
                        filename=file.filename,
                        size_bytes=len(file_content),
                        ip_address=client_ip,
                        user_agent=user_agent
                    )
                    
                    # Invalidate cache when new documents are added
                    redis_cache.invalidate_document_cache(document_id)
                    
                except Exception as e:
                    # Update document status to error
                    await update_document_status(
                        document_id=document_id,
                        status="error",
                        error_message=str(e)
                    )
                    raise e
                
            except Exception as e:
                logger.error(f"Failed to process file {file.filename}: {e}")
                # Continue processing other files
                continue
        
        # Check if any files were successfully processed
        if not processed_files:
            raise HTTPException(
                status_code=400, 
                detail="No documents could be processed successfully"
            )
        
        return UploadResponse(
            success=True,
            message=f"Successfully queued {len(processed_files)} files for background processing",
            document_id=str(uuid.uuid4()),  # Generate a batch ID
            chunks_created=total_chunks
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Upload processing failed. Please try again.")


@router.get("/documents")
async def list_documents(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, max_length=100, description="Search query"),
    status: str = Query(None, regex="^(processing|completed|error)$", description="Filter by status")
):
    """
    List uploaded documents with pagination and filtering.
    """
    try:
        # Validate pagination parameters
        page, page_size = validate_pagination_params(page, page_size)
        
        # Validate search query
        if search and not validate_search_query(search):
            raise HTTPException(status_code=400, detail="Invalid search query")
            
        # Get documents from database with pagination (organization-scoped)
        documents = await get_documents_list(
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            organization_id=current_org["id"]
        )
        
        return documents
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document list")


@router.delete("/documents/{document_id}")
async def delete_document_endpoint(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Delete a document and its chunks from the knowledge base.
    """
    try:
        logger.info(f"Delete request for document: {document_id}")
        
        # First, get the document info from Supabase (organization-scoped)
        from app.db.supabase_client import supabase_client
        result = supabase_client.table("documents").select("*").eq("id", document_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found in your organization")
            
        target_document = result.data[0]
        
        # Check permissions: users can only delete their own documents, admins can delete any
        from app.models.schemas import UserRole
        user_role = current_org.get("user_role")
        document_owner = target_document.get("uploaded_by")
        
        # Strict authorization check
        if user_role != UserRole.ADMIN.value and document_owner != current_user["id"]:
            logger.warning(f"Unauthorized delete attempt: user {current_user['id']} tried to delete document {document_id} owned by {document_owner}")
            raise HTTPException(status_code=403, detail="Insufficient permissions to delete this document")
        
        filename = target_document["filename"]
        logger.info(f"Deleting document: {filename}")
        
        # Check how many documents exist before deletion
        stats = retriever.get_collection_stats()
        pre_count = stats.get("total_vectors", 0)
        logger.info(f"Vector store has {pre_count} documents before deletion")
        
        # Delete from vector store using filename
        delete_success = retriever.delete_documents_by_filename(filename)
        
        # Verify deletion worked
        post_stats = retriever.get_collection_stats()
        post_count = post_stats.get("total_vectors", 0)
        logger.info(f"Vector store has {post_count} documents after deletion")
        
        if not delete_success:
            logger.warning(f"Failed to delete from vector store for {filename}, but continuing...")
        else:
            logger.info(f"Successfully removed {pre_count - post_count} chunks from vector store for {filename}")
        
        # Delete from Supabase database
        await delete_document(document_id)
        
        # Log audit event for document deletion
        client_ip, user_agent = get_request_info(request)
        await audit_logger.log_document_event(
            action=AuditAction.DOCUMENT_DELETE,
            organization_id=current_org["id"],
            user_id=current_user["id"],
            document_id=document_id,
            filename=filename,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Invalidate ALL cache when documents are deleted to ensure fresh responses
        redis_cache.invalidate_all_cache()
        
        logger.info(f"Successfully deleted document: {filename}")
        return {
            "message": f"Document '{filename}' deleted successfully",
            "document_id": document_id,
            "vector_store_deleted": delete_success,
            "chunks_removed": pre_count - post_count,
            "collection_count": post_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(status_code=500, detail="Document deletion failed. Please try again.")


@router.post("/reset")
async def reset_knowledge_base(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Reset the entire knowledge base (admin only).
    """
    try:
        # Admin check is handled by require_admin dependency
        
        logger.info("Resetting knowledge base...")
        
        # Get count before reset
        pre_stats = retriever.get_collection_stats()
        pre_count = pre_stats.get("total_vectors", 0)
        logger.info(f"Vector store has {pre_count} documents before reset")
        
        # Reset vector store collection
        reset_success = retriever.reset_collection()
        
        # Verify reset worked
        post_stats = retriever.get_collection_stats()
        post_count = post_stats.get("total_vectors", 0)
        logger.info(f"Vector store has {post_count} documents after reset")
        
        # Clear all cached responses
        redis_cache.invalidate_all_cache()
        
        if reset_success:
            logger.info(f"Successfully reset knowledge base (removed {pre_count} documents)")
            return {
                "message": "Knowledge base reset successfully",
                "documents_removed": pre_count,
                "collection_count": post_count
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to reset knowledge base")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset knowledge base: {e}")
        raise HTTPException(status_code=500, detail="Reset operation failed")


@router.get("/stats")
async def upload_stats(current_user: dict = Depends(get_current_user)):
    """
    Get upload and collection statistics.
    """
    try:
        stats = retriever.get_collection_stats()
        
        # Add cache statistics
        cache_stats = redis_cache.get_stats()
        
        # Get some sample documents to show what's in the collection
        sample_docs = []
        try:
            from app.db.supabase_client import supabase_client
            sample_results = supabase_client.table("document_vectors").select(
                "id, document_id, metadata"
            ).limit(5).execute()
            
            if sample_results.data:
                sample_docs = [
                    {
                        "id": doc["id"],
                        "filename": doc.get("metadata", {}).get("filename", "unknown"),
                        "document_id": doc["document_id"]
                    }
                    for doc in sample_results.data
                ]
        except Exception as e:
            logger.warning(f"Could not fetch sample documents: {e}")
        
        return {
            "collection_stats": stats,
            "cache_stats": cache_stats,
            "sample_documents": sample_docs,
            "supported_formats": ALLOWED_FILE_TYPES
        }
        
    except Exception as e:
        logger.error(f"Failed to get upload stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


@router.post("/batch", response_model=dict)
async def upload_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Upload multiple documents for batch processing.
    Returns immediately with a job ID for tracking progress.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        if len(files) > 50:  # Reasonable limit for batch processing
            raise HTTPException(status_code=400, detail="Too many files (max 50)")
        
        logger.info(f"Creating batch job for {len(files)} files")
        
        # Prepare file data for batch processing
        files_data = []
        for file in files:
            if not file.filename:
                logger.warning("File without filename skipped")
                continue
            
            # Validate filename
            if not validate_filename(file.filename):
                logger.warning(f"Invalid filename: {file.filename}")
                continue
            
            # Read file content
            file_content = await file.read()
            if not file_content:
                logger.warning(f"Empty file: {file.filename}")
                continue
            
            # Validate file size
            if not validate_file_size(len(file_content)):
                logger.warning(f"File too large: {file.filename} ({len(file_content)} bytes)")
                continue
            
            # Validate file type
            if not validate_file_type(file.content_type or "text/plain", ALLOWED_FILE_TYPES):
                logger.warning(f"Unsupported file type: {file.content_type} for {file.filename}")
                continue
            
            files_data.append({
                "filename": sanitize_filename(file.filename),
                "content": file_content,
                "content_type": file.content_type or "text/plain",
                "metadata": {
                    "user_id": current_user.get("id") if current_user else "anonymous",
                    "upload_date": datetime.now(timezone.utc).isoformat(),
                    "file_size": len(file_content),
                    "organization_id": current_org["id"]
                }
            })
        
        if not files_data:
            raise HTTPException(status_code=400, detail="No valid files to process")
        
        # Create batch job
        job = batch_processor.create_batch_job(
            files_data=files_data,
            user_id=current_user.get("id") if current_user else None
        )
        
        # Start processing in background
        background_tasks.add_task(batch_processor.process_batch_async, job.id)
        
        return {
            "success": True,
            "message": f"Batch job created with {len(files_data)} files",
            "job_id": job.id,
            "files_count": len(files_data),
            "status": job.status.value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch upload failed: {e}")
        raise HTTPException(status_code=500, detail="Batch upload processing failed. Please try again.")


@router.get("/batch/{job_id}")
async def get_batch_status(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get the status of a batch processing job.
    """
    try:
        job = batch_processor.get_job_status(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Batch job not found")
        
        # Check if user owns this job (or is admin in same org)
        from app.models.schemas import UserRole
        if (current_user and 
            current_user.get("id") != job.user_id and 
            current_org.get("user_role") != UserRole.ADMIN.value):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Prepare response
        items_summary = {
            "total": len(job.items),
            "pending": len([item for item in job.items if item.status == BatchStatus.PENDING]),
            "processing": len([item for item in job.items if item.status == BatchStatus.PROCESSING]),
            "completed": len([item for item in job.items if item.status == BatchStatus.COMPLETED]),
            "failed": len([item for item in job.items if item.status == BatchStatus.FAILED])
        }
        
        return {
            "job_id": job.id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "total_chunks": job.total_chunks,
            "error_count": job.error_count,
            "items": items_summary,
            "details": [
                {
                    "id": item.id,
                    "filename": item.filename,
                    "status": item.status.value,
                    "chunks_count": item.chunks_count,
                    "error_message": item.error_message,
                    "document_id": item.document_id
                }
                for item in job.items
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get batch status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve batch status")


@router.get("/batch")
async def list_batch_jobs(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page")
):
    """
    List batch processing jobs for the current user.
    """
    try:
        # Validate pagination parameters
        page, page_size = validate_pagination_params(page, page_size)
        
        # Get jobs for user (or all jobs in org if admin)
        from app.models.schemas import UserRole
        user_id = None if current_org.get("user_role") == UserRole.ADMIN.value else current_user.get("id")
        jobs = batch_processor.list_jobs(user_id=user_id)
        
        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_jobs = jobs[start_idx:end_idx]
        
        # Prepare response
        job_summaries = []
        for job in paginated_jobs:
            items_summary = {
                "total": len(job.items),
                "completed": len([item for item in job.items if item.status == BatchStatus.COMPLETED]),
                "failed": len([item for item in job.items if item.status == BatchStatus.FAILED])
            }
            
            job_summaries.append({
                "job_id": job.id,
                "status": job.status.value,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "total_chunks": job.total_chunks,
                "items": items_summary
            })
        
        return {
            "jobs": job_summaries,
            "page": page,
            "page_size": page_size,
            "total_jobs": len(jobs),
            "has_more": end_idx < len(jobs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list batch jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve batch jobs")


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get document details and content for preview.
    """
    try:
        from app.db.supabase_client import supabase_client
        
        # Get document info from database (organization-scoped)
        result = supabase_client.table("documents").select("*").eq("id", document_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found in your organization")
        
        document = result.data[0]
        
        logger.info(f"Retrieved document: {document['filename']}")
        return {
            "id": document["id"],
            "filename": document["filename"],
            "content": document.get("content", ""),
            "file_type": document["content_type"],
            "file_size": document["size_bytes"],
            "upload_date": document["created_at"],
            "metadata": document.get("metadata", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document")


@router.get("/documents/{document_id}/chunks")
async def get_document_chunks(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get document chunks for preview.
    """
    try:
        # Verify document exists and belongs to organization
        from app.db.supabase_client import supabase_client
        doc_result = supabase_client.table("documents").select("id, filename").eq("id", document_id).eq("organization_id", current_org["id"]).execute()
        
        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document not found in your organization")
        
        # Get chunks using the retriever
        chunks = supabase_retriever.get_document_chunks(document_id)
        
        # Sort chunks by chunk_index
        chunks.sort(key=lambda x: x.metadata.get("chunk_index", 0))
        
        # Prepare response
        chunks_data = []
        for chunk in chunks:
            chunks_data.append({
                "id": chunk.metadata.get("id"),
                "content": chunk.page_content,
                "chunk_index": chunk.metadata.get("chunk_index", 0)
            })
        
        logger.info(f"Retrieved {len(chunks_data)} chunks for document {document_id}")
        return chunks_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chunks for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document chunks")


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Download original document file.
    """
    try:
        from app.db.supabase_client import supabase_client
        from fastapi.responses import Response
        
        # Get document info from database (organization-scoped)
        result = supabase_client.table("documents").select("*").eq("id", document_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found in your organization")
        
        document = result.data[0]
        
        # For now, return the text content as a download
        # In a full implementation, you'd store the original binary file
        content = document.get("content", "")
        filename = document["filename"]
        
        logger.info(f"Downloading document: {filename}")
        
        return Response(
            content=content.encode('utf-8'),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download document")


@router.get("/documents/{document_id}/analytics")
async def get_document_analytics(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get analytics data for a specific document.
    """
    try:
        from app.db.supabase_client import supabase_client
        
        # Verify document exists and belongs to organization
        doc_result = supabase_client.table("documents").select("id, filename").eq("id", document_id).eq("organization_id", current_org["id"]).execute()
        
        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document not found in your organization")
        
        # Get basic analytics from database
        # This is a simplified version - in a full implementation you'd have more detailed analytics
        
        # Count how many queries reference this document (simplified query)
        queries_result = supabase_client.table("conversations").select("id", count="exact").eq("organization_id", current_org["id"]).execute()
        total_queries = queries_result.count or 0
        
        # Get chunks count
        chunks_result = supabase_client.table("document_vectors").select("id", count="exact").eq("document_id", document_id).execute()
        chunks_count = chunks_result.count or 0
        
        return {
            "document_id": document_id,
            "filename": doc_result.data[0]["filename"],
            "total_queries_in_org": total_queries,
            "chunks_count": chunks_count,
            "usage_score": min(100, (total_queries / 10) * 100) if total_queries > 0 else 0,
            "last_accessed": None  # Would track this in a full implementation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document analytics")