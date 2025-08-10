import uuid
import logging
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Query, Request
from app.models.schemas import UploadResponse, DocumentInfo
from app.core.deps import get_current_user, get_demo_org_id
from app.core.validation import validate_file_type, validate_file_size, validate_filename, sanitize_filename, validate_search_query, validate_pagination_params
from app.core.redis_cache import redis_cache
from app.rag import document_loader, document_splitter, adaptive_splitter, retriever
from app.core.config import settings
from app.db.supabase_client import save_document_info, update_document_status, delete_document, get_documents_list
from app.rag.supabase_retriever import supabase_retriever
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
    Uses hardcoded demo organization for simplified single-client deployment.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        demo_org_id = get_demo_org_id()
        logger.info(f"Processing {len(files)} uploaded files for demo org: {demo_org_id}")
        
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
                
                # Save document info to Supabase with demo org ID
                document_id = await save_document_info(
                    filename=safe_filename,
                    content_type=file.content_type or "text/plain",
                    size_bytes=len(file_content),
                    file_path="",  # We don't store files, just process them
                    user_id=current_user.get("id") if current_user else None,
                    organization_id=demo_org_id
                )
                
                try:
                    # Process document directly for simplified demo
                    # Load document content
                    documents = await document_loader.load_from_content(
                        content=file_content,
                        filename=safe_filename,
                        content_type=file.content_type or "text/plain"
                    )
                    
                    # Split into chunks
                    all_chunks = []
                    for doc in documents:
                        if settings.use_adaptive_chunking:
                            chunks = adaptive_splitter.split_documents([doc])
                        else:
                            chunks = document_splitter.split_documents([doc])
                        all_chunks.extend(chunks)
                    
                    # Add to vector store
                    document_ids = await retriever.add_documents(all_chunks)
                    chunks_count = len(document_ids)
                    total_chunks += chunks_count
                    
                    # Update document status to completed
                    await update_document_status(
                        document_id=document_id,
                        status="completed"
                    )
                    
                    processed_files.append({
                        "filename": file.filename,
                        "chunks": chunks_count,
                        "document_ids": document_ids,
                        "document_id": document_id,
                        "status": "completed"
                    })
                    
                    logger.info(f"Successfully processed {file.filename} with {chunks_count} chunks")
                    
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
            message=f"Successfully processed {len(processed_files)} files with {total_chunks} chunks",
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
        
        demo_org_id = get_demo_org_id()
        
        # Get documents from database with pagination (demo org scoped)
        documents = await get_documents_list(
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            organization_id=demo_org_id
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
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a document and its chunks from the knowledge base.
    """
    try:
        logger.info(f"Delete request for document: {document_id}")
        
        demo_org_id = get_demo_org_id()
        
        # First, get the document info from Supabase (demo org scoped)
        from app.db.supabase_client import supabase_client
        result = supabase_client.table("documents").select("*").eq("id", document_id).eq("organization_id", demo_org_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
            
        target_document = result.data[0]
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


@router.post("/purge")
async def purge_demo_data(
    current_user: dict = Depends(get_current_user)
):
    """
    Purge all demo data and return proof of deletion.
    Essential for demo cleanup and client handover.
    """
    try:
        logger.info("Starting demo data purge...")
        
        demo_org_id = get_demo_org_id()
        
        # Get count before purge
        pre_stats = retriever.get_collection_stats()
        pre_count = pre_stats.get("total_vectors", 0)
        logger.info(f"Vector store has {pre_count} documents before purge")
        
        # Get document count from database
        from app.db.supabase_client import supabase_client
        db_result = supabase_client.table("documents").select("id", count="exact").eq("organization_id", demo_org_id).execute()
        db_doc_count = db_result.count or 0
        
        # Reset vector store collection
        reset_success = retriever.reset_collection()
        
        # Delete all documents from database for demo org
        delete_result = supabase_client.table("documents").delete().eq("organization_id", demo_org_id).execute()
        
        # Delete all document vectors for demo org
        vectors_delete_result = supabase_client.table("document_vectors").delete().eq("organization_id", demo_org_id).execute()
        
        # Clear all cached responses
        redis_cache.invalidate_all_cache()
        
        # Verify purge worked
        post_stats = retriever.get_collection_stats()
        post_count = post_stats.get("total_vectors", 0)
        logger.info(f"Vector store has {post_count} documents after purge")
        
        # Generate purge proof
        purge_timestamp = datetime.now(timezone.utc).isoformat()
        purge_proof = {
            "purge_timestamp": purge_timestamp,
            "demo_org_id": demo_org_id,
            "documents_purged": {
                "vector_store": pre_count - post_count,
                "database_documents": db_doc_count,
                "database_vectors": len(vectors_delete_result.data) if vectors_delete_result.data else 0
            },
            "verification": {
                "vector_store_empty": post_count == 0,
                "reset_success": reset_success
            },
            "user_id": current_user.get("id") if current_user else "anonymous",
            "purge_id": str(uuid.uuid4())
        }
        
        if reset_success and post_count == 0:
            logger.info(f"Successfully purged all demo data (removed {pre_count} documents)")
            return {
                "success": True,
                "message": "Demo data purged successfully",
                "proof": purge_proof
            }
        else:
            logger.error("Purge verification failed")
            return {
                "success": False,
                "message": "Purge completed but verification failed",
                "proof": purge_proof
            }
            
    except Exception as e:
        logger.error(f"Failed to purge demo data: {e}")
        raise HTTPException(status_code=500, detail="Purge operation failed")


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
            demo_org_id = get_demo_org_id()
            sample_results = supabase_client.table("document_vectors").select(
                "id, document_id, metadata"
            ).eq("organization_id", demo_org_id).limit(5).execute()
            
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
            "supported_formats": ALLOWED_FILE_TYPES,
            "demo_org_id": get_demo_org_id()
        }
        
    except Exception as e:
        logger.error(f"Failed to get upload stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")