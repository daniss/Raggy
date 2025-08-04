import logging
from typing import Dict, Any, List
from datetime import datetime

from app.rag import document_loader, document_splitter, retriever
from app.core.redis_cache import redis_cache
from app.db.supabase_client import save_document_info, update_document_status
from app.services.background_jobs import job_manager, JobPriority

logger = logging.getLogger(__name__)


async def process_single_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Background task handler for processing a single document.
    
    Expected payload:
    {
        "filename": str,
        "content": bytes (base64 encoded),
        "content_type": str,
        "user_id": str,
        "metadata": dict
    }
    """
    try:
        logger.info(f"Processing document: {payload['filename']}")
        
        # Decode content if base64 encoded
        import base64
        if isinstance(payload['content'], str):
            content = base64.b64decode(payload['content'])
        else:
            content = payload['content']
        
        # Save document info to database
        document_id = await save_document_info(
            filename=payload['filename'],
            content_type=payload['content_type'],
            size_bytes=len(content),
            file_path="",  # We don't store files, just process them
            user_id=payload.get('user_id')
        )
        
        # Load documents from bytes
        documents = document_loader.load_from_bytes(
            file_bytes=content,
            content_type=payload['content_type'],
            filename=payload['filename'],
            metadata={
                **payload.get('metadata', {}),
                "filename": payload['filename'],
                "document_id": document_id,
                "uploaded_by": payload.get('user_id', 'anonymous'),
                "upload_date": datetime.utcnow().isoformat(),
                "file_size": len(content)
            }
        )
        
        # Split documents into chunks
        chunks = document_splitter.split_documents(documents)
        
        # Add chunks to vector store
        chunk_ids = retriever.add_documents(chunks)
        
        # Update document status
        await update_document_status(
            document_id=document_id,
            status="completed",
            chunks_count=len(chunks)
        )
        
        # Invalidate cache
        redis_cache.invalidate_document_cache(document_id)
        
        result = {
            "document_id": document_id,
            "chunks_count": len(chunks),
            "chunk_ids": chunk_ids,
            "status": "completed"
        }
        
        logger.info(f"Successfully processed document {payload['filename']}: {len(chunks)} chunks")
        return result
        
    except Exception as e:
        logger.error(f"Failed to process document {payload.get('filename', 'unknown')}: {e}")
        
        # Update document status to error if document was created
        document_id = payload.get('document_id')
        if document_id:
            await update_document_status(
                document_id=document_id,
                status="error",
                error_message=str(e)
            )
        
        raise e


async def process_batch_documents(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Background task handler for processing multiple documents in a batch.
    
    Expected payload:
    {
        "files": [
            {
                "filename": str,
                "content": bytes (base64 encoded),
                "content_type": str,
                "metadata": dict
            }
        ],
        "user_id": str,
        "batch_id": str
    }
    """
    try:
        files = payload['files']
        user_id = payload.get('user_id')
        batch_id = payload.get('batch_id')
        
        logger.info(f"Processing batch {batch_id} with {len(files)} documents")
        
        results = []
        total_chunks = 0
        failed_count = 0
        
        for file_data in files:
            try:
                # Create individual document processing job
                document_payload = {
                    **file_data,
                    "user_id": user_id,
                    "batch_id": batch_id
                }
                
                # Process document
                result = await process_single_document(document_payload)
                results.append({
                    "filename": file_data['filename'],
                    "status": "completed",
                    "result": result
                })
                total_chunks += result['chunks_count']
                
            except Exception as e:
                logger.error(f"Failed to process file {file_data['filename']} in batch {batch_id}: {e}")
                results.append({
                    "filename": file_data['filename'],
                    "status": "failed",
                    "error": str(e)
                })
                failed_count += 1
        
        batch_result = {
            "batch_id": batch_id,
            "total_files": len(files),
            "successful_files": len(files) - failed_count,
            "failed_files": failed_count,
            "total_chunks": total_chunks,
            "results": results,
            "status": "completed" if failed_count == 0 else "partial"
        }
        
        logger.info(
            f"Batch {batch_id} completed: {len(files) - failed_count}/{len(files)} "
            f"files processed successfully, {total_chunks} total chunks"
        )
        
        return batch_result
        
    except Exception as e:
        logger.error(f"Batch processing failed for batch {payload.get('batch_id', 'unknown')}: {e}")
        raise e


async def cleanup_old_documents(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Background task handler for cleaning up old documents.
    
    Expected payload:
    {
        "max_age_days": int,
        "dry_run": bool
    }
    """
    try:
        max_age_days = payload.get('max_age_days', 30)
        dry_run = payload.get('dry_run', True)
        
        logger.info(f"Starting document cleanup (max_age: {max_age_days} days, dry_run: {dry_run})")
        
        # This would implement document cleanup logic
        # For now, just return a placeholder result
        
        result = {
            "documents_found": 0,
            "documents_deleted": 0,
            "dry_run": dry_run,
            "status": "completed"
        }
        
        logger.info(f"Document cleanup completed: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Document cleanup failed: {e}")
        raise e


async def generate_analytics_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Background task handler for generating analytics reports.
    
    Expected payload:
    {
        "report_type": str,
        "date_range": {"start": str, "end": str},
        "user_id": str
    }
    """
    try:
        report_type = payload.get('report_type', 'usage')
        date_range = payload.get('date_range', {})
        user_id = payload.get('user_id')
        
        logger.info(f"Generating {report_type} report for user {user_id}")
        
        # This would implement report generation logic
        # For now, just return a placeholder result
        
        result = {
            "report_type": report_type,
            "user_id": user_id,
            "date_range": date_range,
            "generated_at": datetime.utcnow().isoformat(),
            "report_data": {},
            "status": "completed"
        }
        
        logger.info(f"Analytics report generated: {report_type}")
        return result
        
    except Exception as e:
        logger.error(f"Analytics report generation failed: {e}")
        raise e


async def backup_vector_store(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Background task handler for backing up the vector store.
    
    Expected payload:
    {
        "backup_type": str,
        "destination": str,
        "backup_name": str (optional),
        "include_vectors": bool,
        "include_metadata": bool,
        "include_chat_logs": bool
    }
    """
    try:
        from app.services.backup_service import backup_service
        
        backup_type = payload.get('backup_type', 'full')
        backup_name = payload.get('backup_name')
        include_vectors = payload.get('include_vectors', True)
        include_metadata = payload.get('include_metadata', True)
        include_chat_logs = payload.get('include_chat_logs', False)
        
        logger.info(f"Starting {backup_type} backup")
        
        # Create the actual backup using the backup service
        backup_info = await backup_service.create_full_backup(
            backup_name=backup_name,
            include_vectors=include_vectors,
            include_metadata=include_metadata,
            include_chat_logs=include_chat_logs
        )
        
        result = {
            "backup_type": backup_type,
            "backup_info": backup_info,
            "status": "completed"
        }
        
        logger.info(f"Vector store backup completed: {backup_info['backup_name']}")
        return result
        
    except Exception as e:
        logger.error(f"Vector store backup failed: {e}")
        raise e


def register_all_task_handlers():
    """Register all task handlers with the job manager."""
    job_manager.register_task("process_single_document", process_single_document)
    job_manager.register_task("process_batch_documents", process_batch_documents)
    job_manager.register_task("cleanup_old_documents", cleanup_old_documents)
    job_manager.register_task("generate_analytics_report", generate_analytics_report)
    job_manager.register_task("backup_vector_store", backup_vector_store)
    
    logger.info("All background task handlers registered")


# Helper functions for creating common background jobs

async def enqueue_document_processing(
    filename: str,
    content: bytes,
    content_type: str,
    user_id: str,
    metadata: Dict[str, Any] = None,
    priority: JobPriority = JobPriority.NORMAL
) -> str:
    """Helper to enqueue a single document processing job."""
    import base64
    
    payload = {
        "filename": filename,
        "content": base64.b64encode(content).decode('utf-8'),
        "content_type": content_type,
        "user_id": user_id,
        "metadata": metadata or {}
    }
    
    return await job_manager.enqueue_job(
        task_name="process_single_document",
        payload=payload,
        priority=priority
    )


async def enqueue_batch_processing(
    files_data: List[Dict[str, Any]],
    user_id: str,
    batch_id: str,
    priority: JobPriority = JobPriority.NORMAL
) -> str:
    """Helper to enqueue a batch document processing job."""
    import base64
    
    # Encode file contents as base64
    encoded_files = []
    for file_data in files_data:
        encoded_file = file_data.copy()
        if isinstance(encoded_file['content'], bytes):
            encoded_file['content'] = base64.b64encode(encoded_file['content']).decode('utf-8')
        encoded_files.append(encoded_file)
    
    payload = {
        "files": encoded_files,
        "user_id": user_id,
        "batch_id": batch_id
    }
    
    return await job_manager.enqueue_job(
        task_name="process_batch_documents",
        payload=payload,
        priority=priority
    )


async def enqueue_cleanup_job(
    max_age_days: int = 30,
    dry_run: bool = True,
    priority: JobPriority = JobPriority.LOW
) -> str:
    """Helper to enqueue a document cleanup job."""
    payload = {
        "max_age_days": max_age_days,
        "dry_run": dry_run
    }
    
    return await job_manager.enqueue_job(
        task_name="cleanup_old_documents",
        payload=payload,
        priority=priority
    )


async def enqueue_analytics_job(
    report_type: str,
    date_range: Dict[str, str],
    user_id: str,
    priority: JobPriority = JobPriority.LOW
) -> str:
    """Helper to enqueue an analytics report generation job."""
    payload = {
        "report_type": report_type,
        "date_range": date_range,
        "user_id": user_id
    }
    
    return await job_manager.enqueue_job(
        task_name="generate_analytics_report",
        payload=payload,
        priority=priority
    )


async def enqueue_backup_job(
    backup_type: str = "full",
    destination: str = "local",
    priority: JobPriority = JobPriority.LOW
) -> str:
    """Helper to enqueue a backup job."""
    payload = {
        "backup_type": backup_type,
        "destination": destination
    }
    
    return await job_manager.enqueue_job(
        task_name="backup_vector_store",
        payload=payload,
        priority=priority
    )