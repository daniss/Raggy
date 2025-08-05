import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from app.core.deps import get_current_user
from app.services.background_jobs import job_manager, JobStatus, JobPriority
from app.services.task_handlers import (
    enqueue_cleanup_job, 
    enqueue_analytics_job, 
    enqueue_backup_job,
    register_all_task_handlers
)
from app.services.backup_service import backup_service
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["background-jobs"])

# Register task handlers on module import
register_all_task_handlers()


@router.get("/stats")
async def get_job_stats(current_user: dict = Depends(get_current_user)):
    """
    Get background job queue statistics.
    """
    try:
        stats = await job_manager.get_job_stats()
        return {
            "job_stats": stats,
            "manager_running": job_manager.running,
            "redis_connected": job_manager.redis_client is not None
        }
    except Exception as e:
        logger.error(f"Failed to get job stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job statistics")


@router.get("/")
async def list_jobs(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of jobs to return")
):
    """
    List background jobs.
    """
    try:
        # Validate status parameter
        job_status = None
        if status:
            try:
                job_status = JobStatus(status.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid status. Valid options: {[s.value for s in JobStatus]}"
                )
        
        jobs = await job_manager.list_jobs(status=job_status, limit=limit)
        
        # Convert jobs to dict format for JSON response
        job_list = []
        for job in jobs:
            job_dict = {
                "id": job.id,
                "task_name": job.task_name,
                "status": job.status.value,
                "priority": job.priority.value,
                "created_at": job.created_at.isoformat(),
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "failed_at": job.failed_at.isoformat() if job.failed_at else None,
                "retry_count": job.retry_count,
                "max_retries": job.max_retries,
                "error_message": job.error_message,
                "result": job.result
            }
            job_list.append(job_dict)
        
        return {
            "jobs": job_list,
            "total": len(job_list),
            "status_filter": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job list")


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get details for a specific background job.
    """
    try:
        job = await job_manager.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "id": job.id,
            "task_name": job.task_name,
            "payload": job.payload,
            "status": job.status.value,
            "priority": job.priority.value,
            "created_at": job.created_at.isoformat(),
            "scheduled_for": job.scheduled_for.isoformat() if job.scheduled_for else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "failed_at": job.failed_at.isoformat() if job.failed_at else None,
            "retry_count": job.retry_count,
            "max_retries": job.max_retries,
            "error_message": job.error_message,
            "result": job.result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job details")


@router.post("/cleanup")
async def schedule_cleanup_job(
    current_user: dict = Depends(get_current_user),
    max_age_days: int = Query(30, ge=1, le=365, description="Maximum age of documents to keep"),
    dry_run: bool = Query(True, description="Perform a dry run without actually deleting")
):
    """
    Schedule a cleanup job to remove old documents.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        job_id = await enqueue_cleanup_job(
            max_age_days=max_age_days,
            dry_run=dry_run,
            priority=JobPriority.LOW
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Cleanup job scheduled (max_age: {max_age_days} days, dry_run: {dry_run})"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to schedule cleanup job: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule cleanup job")


@router.post("/analytics")
async def schedule_analytics_job(
    current_user: dict = Depends(get_current_user),
    report_type: str = Query("usage", description="Type of report to generate"),
    start_date: str = Query(..., description="Start date (ISO format)"),
    end_date: str = Query(..., description="End date (ISO format)")
):
    """
    Schedule an analytics report generation job.
    """
    try:
        # Validate date format
        try:
            datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
        
        job_id = await enqueue_analytics_job(
            report_type=report_type,
            date_range={"start": start_date, "end": end_date},
            user_id=current_user.get("id") if current_user else "anonymous",
            priority=JobPriority.LOW
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Analytics job scheduled ({report_type} report)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to schedule analytics job: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule analytics job")


@router.post("/backup")
async def schedule_backup_job(
    current_user: dict = Depends(get_current_user),
    backup_type: str = Query("full", description="Type of backup (full, incremental)"),
    destination: str = Query("local", description="Backup destination")
):
    """
    Schedule a backup job for the vector store.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        job_id = await enqueue_backup_job(
            backup_type=backup_type,
            destination=destination,
            priority=JobPriority.LOW
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Backup job scheduled ({backup_type} backup to {destination})"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to schedule backup job: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule backup job")


@router.post("/worker/start")
async def start_worker(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start the background job worker.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if job_manager.running:
            return {"message": "Background job worker is already running"}
        
        # Start worker in background
        background_tasks.add_task(job_manager.start_worker)
        
        return {
            "success": True,
            "message": "Background job worker started"
        }
        
    except Exception as e:
        logger.error(f"Failed to start job worker: {e}")
        raise HTTPException(status_code=500, detail="Failed to start job worker")


@router.post("/worker/stop")
async def stop_worker(current_user: dict = Depends(get_current_user)):
    """
    Stop the background job worker.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if not job_manager.running:
            return {"message": "Background job worker is not running"}
        
        await job_manager.stop_worker()
        
        return {
            "success": True,
            "message": "Background job worker stopped"
        }
        
    except Exception as e:
        logger.error(f"Failed to stop job worker: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop job worker")


@router.delete("/cleanup")
async def cleanup_old_jobs(
    current_user: dict = Depends(get_current_user),
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age of completed jobs to keep")
):
    """
    Clean up old completed and failed jobs.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        cleaned_count = await job_manager.cleanup_old_jobs(max_age_hours=max_age_hours)
        
        return {
            "success": True,
            "cleaned_jobs": cleaned_count,
            "message": f"Cleaned up {cleaned_count} old jobs"
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup old jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup old jobs")


@router.post("/backup/create")
async def create_backup(
    current_user: dict = Depends(get_current_user),
    backup_name: Optional[str] = Query(None, description="Custom backup name"),
    include_vectors: bool = Query(True, description="Include vector store in backup"),
    include_metadata: bool = Query(True, description="Include document metadata in backup"),
    include_chat_logs: bool = Query(False, description="Include chat logs in backup")
):
    """
    Create a full system backup.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        backup_info = await backup_service.create_full_backup(
            backup_name=backup_name,
            include_vectors=include_vectors,
            include_metadata=include_metadata,
            include_chat_logs=include_chat_logs
        )
        
        return {
            "success": True,
            "backup_info": backup_info
        }
        
    except Exception as e:
        logger.error(f"Failed to create backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")


@router.get("/backup/list")
async def list_backups(current_user: dict = Depends(get_current_user)):
    """
    List all available backups.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        backups = await backup_service.list_backups()
        
        return {
            "backups": backups,
            "total_count": len(backups)
        }
        
    except Exception as e:
        logger.error(f"Failed to list backups: {e}")
        raise HTTPException(status_code=500, detail="Failed to list backups")


@router.post("/backup/restore/{backup_name}")
async def restore_backup(
    backup_name: str,
    current_user: dict = Depends(get_current_user),
    restore_vectors: bool = Query(True, description="Restore vector store"),
    restore_metadata: bool = Query(True, description="Restore document metadata"),
    dry_run: bool = Query(True, description="Perform a dry run without making changes")
):
    """
    Restore from a backup.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        restore_info = await backup_service.restore_backup(
            backup_name=backup_name,
            restore_vectors=restore_vectors,
            restore_metadata=restore_metadata,
            dry_run=dry_run
        )
        
        return {
            "success": True,
            "restore_info": restore_info
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Backup '{backup_name}' not found")
    except Exception as e:
        logger.error(f"Failed to restore backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")


@router.delete("/backup/{backup_name}")
async def delete_backup(
    backup_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a backup.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        success = await backup_service.delete_backup(backup_name)
        
        if success:
            return {
                "success": True,
                "message": f"Backup '{backup_name}' deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail=f"Backup '{backup_name}' not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete backup: {str(e)}")


@router.delete("/backup/cleanup")
async def cleanup_old_backups(
    current_user: dict = Depends(get_current_user),
    keep_count: int = Query(10, ge=1, le=50, description="Number of recent backups to keep")
):
    """
    Clean up old backups, keeping only the most recent ones.
    """
    try:
        # Check if user has admin privileges
        if current_user and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        deleted_count = await backup_service.cleanup_old_backups(keep_count=keep_count)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} old backups, kept {keep_count} most recent"
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup old backups: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup old backups")