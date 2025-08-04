import asyncio
import json
import logging
import uuid
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from enum import Enum
import redis
from dataclasses import dataclass, asdict

from app.core.config import settings

logger = logging.getLogger(__name__)


class JobStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class JobPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4


@dataclass
class BackgroundJob:
    """Background job definition."""
    id: str
    task_name: str
    payload: Dict[str, Any]
    status: JobStatus
    priority: JobPriority
    created_at: datetime
    scheduled_for: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    result: Optional[Dict[str, Any]] = None


class BackgroundJobManager:
    """Redis-based background job manager."""
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.redis_url
        self.redis_client = None
        self.task_handlers: Dict[str, Callable] = {}
        self.running = False
        
        # Redis keys
        self.queue_key = "background_jobs:queue"
        self.processing_key = "background_jobs:processing"
        self.completed_key = "background_jobs:completed"
        self.failed_key = "background_jobs:failed"
        self.job_key_prefix = "background_jobs:job:"
        
        self._connect_redis()
    
    def _connect_redis(self):
        """Initialize Redis connection."""
        if self.redis_url:
            try:
                self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
                self.redis_client.ping()
                logger.info("Connected to Redis for background jobs")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis for background jobs: {e}")
                self.redis_client = None
        else:
            logger.warning("Redis URL not configured, background jobs will be processed in-memory")
    
    def register_task(self, task_name: str, handler: Callable):
        """Register a task handler."""
        self.task_handlers[task_name] = handler
        logger.info(f"Registered task handler: {task_name}")
    
    async def enqueue_job(
        self,
        task_name: str,
        payload: Dict[str, Any],
        priority: JobPriority = JobPriority.NORMAL,
        schedule_for: Optional[datetime] = None,
        max_retries: int = 3
    ) -> str:
        """Enqueue a background job."""
        job_id = str(uuid.uuid4())
        
        job = BackgroundJob(
            id=job_id,
            task_name=task_name,
            payload=payload,
            status=JobStatus.QUEUED,
            priority=priority,
            created_at=datetime.utcnow(),
            scheduled_for=schedule_for,
            max_retries=max_retries
        )
        
        if self.redis_client:
            # Store job data
            await self._store_job(job)
            
            # Add to queue with priority
            priority_score = priority.value * 1000 + int(datetime.utcnow().timestamp())
            self.redis_client.zadd(self.queue_key, {job_id: priority_score})
            
            logger.info(f"Enqueued job {job_id}: {task_name}")
        else:
            # Fallback: process immediately if Redis not available
            logger.warning(f"Redis not available, processing job {job_id} immediately")
            await self._process_job_immediate(job)
        
        return job_id
    
    async def _store_job(self, job: BackgroundJob):
        """Store job data in Redis."""
        if self.redis_client:
            job_data = asdict(job)
            # Convert datetime objects to ISO strings
            for key, value in job_data.items():
                if isinstance(value, datetime):
                    job_data[key] = value.isoformat() if value else None
                elif isinstance(value, (JobStatus, JobPriority)):
                    job_data[key] = value.value
            
            self.redis_client.setex(
                f"{self.job_key_prefix}{job.id}",
                86400,  # 24 hours TTL
                json.dumps(job_data)
            )
    
    async def get_job(self, job_id: str) -> Optional[BackgroundJob]:
        """Get job by ID."""
        if not self.redis_client:
            return None
        
        job_data = self.redis_client.get(f"{self.job_key_prefix}{job_id}")
        if not job_data:
            return None
        
        data = json.loads(job_data)
        
        # Convert back from ISO strings
        for key, value in data.items():
            if key.endswith('_at') and value:
                data[key] = datetime.fromisoformat(value)
            elif key == 'status':
                data[key] = JobStatus(value)
            elif key == 'priority':
                data[key] = JobPriority(value)
        
        return BackgroundJob(**data)
    
    async def start_worker(self):
        """Start the background job worker."""
        if not self.redis_client:
            logger.warning("Redis not available, background job worker cannot start")
            return
        
        self.running = True
        logger.info("Starting background job worker")
        
        while self.running:
            try:
                # Get next job from queue
                job_data = self.redis_client.bzpopmin(self.queue_key, timeout=5)
                
                if job_data:
                    _, job_id, _ = job_data
                    job = await self.get_job(job_id)
                    
                    if job:
                        await self._process_job(job)
                
            except Exception as e:
                logger.error(f"Error in background job worker: {e}")
                await asyncio.sleep(1)
    
    async def stop_worker(self):
        """Stop the background job worker."""
        self.running = False
        logger.info("Stopping background job worker")
    
    async def _process_job(self, job: BackgroundJob):
        """Process a single job."""
        logger.info(f"Processing job {job.id}: {job.task_name}")
        
        # Check if job should be processed now
        if job.scheduled_for and job.scheduled_for > datetime.utcnow():
            # Reschedule for later
            delay = (job.scheduled_for - datetime.utcnow()).total_seconds()
            priority_score = job.priority.value * 1000 + int(job.scheduled_for.timestamp())
            self.redis_client.zadd(self.queue_key, {job.id: priority_score})
            logger.info(f"Job {job.id} rescheduled for {job.scheduled_for}")
            return
        
        # Mark job as processing
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.utcnow()
        await self._store_job(job)
        
        # Move to processing set
        self.redis_client.sadd(self.processing_key, job.id)
        
        try:
            # Get task handler
            handler = self.task_handlers.get(job.task_name)
            if not handler:
                raise ValueError(f"No handler registered for task: {job.task_name}")
            
            # Execute task
            result = await handler(job.payload)
            
            # Mark as completed
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.result = result
            
            await self._store_job(job)
            
            # Move to completed set
            self.redis_client.srem(self.processing_key, job.id)
            self.redis_client.sadd(self.completed_key, job.id)
            
            logger.info(f"Job {job.id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job.id} failed: {e}")
            
            # Handle failure and retry
            job.retry_count += 1
            job.error_message = str(e)
            
            if job.retry_count <= job.max_retries:
                # Retry with exponential backoff
                retry_delay = min(300, 2 ** job.retry_count)  # Max 5 minutes
                job.scheduled_for = datetime.utcnow() + timedelta(seconds=retry_delay)
                job.status = JobStatus.RETRYING
                
                await self._store_job(job)
                
                # Add back to queue for retry
                priority_score = job.priority.value * 1000 + int(job.scheduled_for.timestamp())
                self.redis_client.zadd(self.queue_key, {job.id: priority_score})
                
                logger.info(f"Job {job.id} scheduled for retry {job.retry_count}/{job.max_retries} in {retry_delay}s")
            else:
                # Mark as permanently failed
                job.status = JobStatus.FAILED
                job.failed_at = datetime.utcnow()
                
                await self._store_job(job)
                
                # Move to failed set
                self.redis_client.srem(self.processing_key, job.id)
                self.redis_client.sadd(self.failed_key, job.id)
                
                logger.error(f"Job {job.id} permanently failed after {job.retry_count} retries")
    
    async def _process_job_immediate(self, job: BackgroundJob):
        """Process job immediately (fallback when Redis not available)."""
        try:
            handler = self.task_handlers.get(job.task_name)
            if not handler:
                logger.error(f"No handler for task: {job.task_name}")
                return
            
            result = await handler(job.payload)
            logger.info(f"Job {job.id} completed immediately: {job.task_name}")
            
        except Exception as e:
            logger.error(f"Job {job.id} failed immediately: {e}")
    
    async def get_job_stats(self) -> Dict[str, int]:
        """Get job queue statistics."""
        if not self.redis_client:
            return {"error": "Redis not available"}
        
        return {
            "queued": self.redis_client.zcard(self.queue_key),
            "processing": self.redis_client.scard(self.processing_key),
            "completed": self.redis_client.scard(self.completed_key),
            "failed": self.redis_client.scard(self.failed_key)
        }
    
    async def list_jobs(
        self, 
        status: Optional[JobStatus] = None,
        limit: int = 50
    ) -> List[BackgroundJob]:
        """List jobs by status."""
        if not self.redis_client:
            return []
        
        jobs = []
        
        if status == JobStatus.QUEUED:
            job_ids = self.redis_client.zrange(self.queue_key, 0, limit-1)
        elif status == JobStatus.PROCESSING:
            job_ids = self.redis_client.smembers(self.processing_key)
        elif status == JobStatus.COMPLETED:
            job_ids = self.redis_client.smembers(self.completed_key)
        elif status == JobStatus.FAILED:
            job_ids = self.redis_client.smembers(self.failed_key)
        else:
            # Get all jobs
            job_ids = set()
            job_ids.update(self.redis_client.zrange(self.queue_key, 0, -1))
            job_ids.update(self.redis_client.smembers(self.processing_key))
            job_ids.update(self.redis_client.smembers(self.completed_key))
            job_ids.update(self.redis_client.smembers(self.failed_key))
        
        for job_id in list(job_ids)[:limit]:
            job = await self.get_job(job_id)
            if job:
                jobs.append(job)
        
        return sorted(jobs, key=lambda x: x.created_at, reverse=True)
    
    async def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Clean up old completed and failed jobs."""
        if not self.redis_client:
            return 0
        
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        cleaned_count = 0
        
        for job_set in [self.completed_key, self.failed_key]:
            job_ids = self.redis_client.smembers(job_set)
            
            for job_id in job_ids:
                job = await self.get_job(job_id)
                if job and (
                    (job.completed_at and job.completed_at < cutoff_time) or
                    (job.failed_at and job.failed_at < cutoff_time)
                ):
                    # Remove from set and delete job data
                    self.redis_client.srem(job_set, job_id)
                    self.redis_client.delete(f"{self.job_key_prefix}{job_id}")
                    cleaned_count += 1
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old background jobs")
        
        return cleaned_count


# Global job manager instance
job_manager = BackgroundJobManager()