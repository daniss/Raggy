import asyncio
import logging
from typing import List, Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum
import uuid
from datetime import datetime

from app.rag import document_loader, document_splitter, retriever
from app.core.redis_cache import redis_cache
from app.db.supabase_client import save_document_info, update_document_status

logger = logging.getLogger(__name__)


class BatchStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class BatchItem:
    """Individual item in a batch processing job."""
    id: str
    filename: str
    content: bytes
    content_type: str
    metadata: Dict[str, Any]
    status: BatchStatus = BatchStatus.PENDING
    error_message: Optional[str] = None
    document_id: Optional[str] = None
    chunks_count: int = 0


@dataclass
class BatchJob:
    """Batch processing job containing multiple documents."""
    id: str
    user_id: Optional[str]
    items: List[BatchItem]
    created_at: datetime
    status: BatchStatus = BatchStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_chunks: int = 0
    error_count: int = 0


class BatchProcessor:
    """Service for processing multiple documents in batches."""
    
    def __init__(self, max_workers: int = 4, batch_size: int = 10):
        self.max_workers = max_workers
        self.batch_size = batch_size
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_jobs: Dict[str, BatchJob] = {}
        
    def create_batch_job(
        self, 
        files_data: List[Dict[str, Any]], 
        user_id: Optional[str] = None
    ) -> BatchJob:
        """Create a new batch job from file data."""
        job_id = str(uuid.uuid4())
        
        items = []
        for file_data in files_data:
            item = BatchItem(
                id=str(uuid.uuid4()),
                filename=file_data["filename"],
                content=file_data["content"],
                content_type=file_data["content_type"],
                metadata=file_data.get("metadata", {})
            )
            items.append(item)
        
        job = BatchJob(
            id=job_id,
            user_id=user_id,
            items=items,
            created_at=datetime.utcnow()
        )
        
        self.active_jobs[job_id] = job
        logger.info(f"Created batch job {job_id} with {len(items)} items")
        
        return job
    
    async def process_batch_async(self, job_id: str) -> BatchJob:
        """Process a batch job asynchronously."""
        if job_id not in self.active_jobs:
            raise ValueError(f"Batch job {job_id} not found")
        
        job = self.active_jobs[job_id]
        job.status = BatchStatus.PROCESSING
        job.started_at = datetime.utcnow()
        
        logger.info(f"Starting batch processing for job {job_id}")
        
        try:
            # Process items in smaller batches to avoid overwhelming the system
            batches = [
                job.items[i:i + self.batch_size] 
                for i in range(0, len(job.items), self.batch_size)
            ]
            
            for batch_items in batches:
                # Process each sub-batch concurrently
                tasks = [
                    self._process_single_item(item, job.user_id) 
                    for item in batch_items
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
            
            # Calculate final job status
            completed_items = [item for item in job.items if item.status == BatchStatus.COMPLETED]
            failed_items = [item for item in job.items if item.status == BatchStatus.FAILED]
            
            job.total_chunks = sum(item.chunks_count for item in completed_items)
            job.error_count = len(failed_items)
            
            if len(completed_items) == len(job.items):
                job.status = BatchStatus.COMPLETED
            elif len(completed_items) > 0:
                job.status = BatchStatus.PARTIAL
            else:
                job.status = BatchStatus.FAILED
            
            job.completed_at = datetime.utcnow()
            
            logger.info(
                f"Batch job {job_id} completed: {len(completed_items)}/{len(job.items)} "
                f"items processed successfully, {job.total_chunks} total chunks created"
            )
            
            return job
            
        except Exception as e:
            logger.error(f"Batch processing failed for job {job_id}: {e}")
            job.status = BatchStatus.FAILED
            job.completed_at = datetime.utcnow()
            raise e
    
    async def _process_single_item(self, item: BatchItem, user_id: Optional[str]) -> None:
        """Process a single document item."""
        try:
            logger.debug(f"Processing item {item.id}: {item.filename}")
            item.status = BatchStatus.PROCESSING
            
            # Save document info to database
            document_id = await save_document_info(
                filename=item.filename,
                content_type=item.content_type,
                size_bytes=len(item.content),
                file_path="",  # We don't store files, just process them
                user_id=user_id
            )
            item.document_id = document_id
            
            # Process document in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            chunks = await loop.run_in_executor(
                self.executor,
                self._process_document_sync,
                item
            )
            
            # Add chunks to vector store
            chunk_ids = retriever.add_documents(chunks)
            item.chunks_count = len(chunks)
            
            # Update document status
            await update_document_status(
                document_id=document_id,
                status="completed",
                chunks_count=len(chunks)
            )
            
            # Invalidate cache
            redis_cache.invalidate_document_cache(document_id)
            
            item.status = BatchStatus.COMPLETED
            logger.debug(f"Successfully processed item {item.id}: {len(chunks)} chunks")
            
        except Exception as e:
            logger.error(f"Failed to process item {item.id}: {e}")
            item.status = BatchStatus.FAILED
            item.error_message = str(e)
            
            # Update document status to error if document was created
            if item.document_id:
                await update_document_status(
                    document_id=item.document_id,
                    status="error",
                    error_message=str(e)
                )
    
    def _process_document_sync(self, item: BatchItem) -> List[Any]:
        """Synchronously process document (run in thread pool)."""
        # Load documents from bytes
        documents = document_loader.load_from_bytes(
            file_bytes=item.content,
            content_type=item.content_type,
            filename=item.filename,
            metadata={
                **item.metadata,
                "filename": item.filename,
                "document_id": item.document_id,
                "uploaded_by": item.metadata.get("user_id", "anonymous"),
                "upload_date": datetime.utcnow().isoformat(),
                "file_size": len(item.content),
                "batch_item_id": item.id
            }
        )
        
        # Split documents into chunks
        chunks = document_splitter.split_documents(documents)
        return chunks
    
    def get_job_status(self, job_id: str) -> Optional[BatchJob]:
        """Get the status of a batch job."""
        return self.active_jobs.get(job_id)
    
    def list_jobs(self, user_id: Optional[str] = None) -> List[BatchJob]:
        """List all batch jobs, optionally filtered by user."""
        jobs = list(self.active_jobs.values())
        if user_id:
            jobs = [job for job in jobs if job.user_id == user_id]
        return sorted(jobs, key=lambda x: x.created_at, reverse=True)
    
    def cleanup_completed_jobs(self, max_age_hours: int = 24) -> int:
        """Clean up completed jobs older than max_age_hours."""
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)
        
        jobs_to_remove = []
        for job_id, job in self.active_jobs.items():
            if (job.status in [BatchStatus.COMPLETED, BatchStatus.FAILED, BatchStatus.PARTIAL] and
                job.completed_at and job.completed_at.timestamp() < cutoff_time):
                jobs_to_remove.append(job_id)
        
        for job_id in jobs_to_remove:
            del self.active_jobs[job_id]
        
        logger.info(f"Cleaned up {len(jobs_to_remove)} completed batch jobs")
        return len(jobs_to_remove)


# Global batch processor instance
batch_processor = BatchProcessor()