"""
Audit logs API endpoints.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from app.core.deps import get_current_user, get_current_organization, require_admin
from app.services.audit_logger import audit_logger, AuditAction, AuditResourceType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    request: Request,
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization),
    action: Optional[str] = Query(None, description="Filter by action"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(50, ge=1, le=1000, description="Number of logs to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Get audit logs for the organization (admin only).
    """
    try:
        # Parse dates if provided
        start_datetime = None
        end_datetime = None
        
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format.")
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format.")
        
        # Parse enum values if provided
        action_enum = None
        if action:
            try:
                action_enum = AuditAction(action)
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid action. Valid values: {[a.value for a in AuditAction]}"
                )
        
        resource_type_enum = None
        if resource_type:
            try:
                resource_type_enum = AuditResourceType(resource_type)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid resource_type. Valid values: {[r.value for r in AuditResourceType]}"
                )
        
        # Get audit logs
        result = await audit_logger.get_audit_logs(
            organization_id=current_org["id"],
            user_id=user_id,
            action=action_enum,
            resource_type=resource_type_enum,
            start_date=start_datetime,
            end_date=end_datetime,
            limit=limit,
            offset=offset
        )
        
        # Log the audit log access
        client_ip, user_agent = get_request_info(request)
        await audit_logger.log_event(
            action=AuditAction.DATA_EXPORT,
            resource_type=AuditResourceType.SYSTEM,
            organization_id=current_org["id"],
            user_id=current_user["id"],
            ip_address=client_ip,
            user_agent=user_agent,
            additional_data={
                "audit_logs_accessed": len(result["logs"]),
                "filters": {
                    "action": action,
                    "resource_type": resource_type,
                    "user_id": user_id,
                    "date_range": f"{start_date} to {end_date}" if start_date or end_date else None
                }
            }
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audit logs")


@router.get("/actions")
async def get_audit_actions(
    current_user: dict = Depends(require_admin)
):
    """
    Get list of available audit actions for filtering.
    """
    return {
        "actions": [action.value for action in AuditAction],
        "resource_types": [resource.value for resource in AuditResourceType]
    }


@router.get("/summary")
async def get_audit_summary(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization),
    days: int = Query(30, ge=1, le=365, description="Number of days to summarize")
):
    """
    Get audit summary statistics for the organization.
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all logs for the period
        result = await audit_logger.get_audit_logs(
            organization_id=current_org["id"],
            start_date=start_date,
            limit=10000  # Get a large number for summary
        )
        
        logs = result["logs"]
        
        # Calculate summary statistics
        summary = {
            "total_events": len(logs),
            "date_range": {
                "start": start_date.isoformat(),
                "end": datetime.utcnow().isoformat(),
                "days": days
            },
            "events_by_action": {},
            "events_by_resource": {},
            "events_by_user": {},
            "security_events": 0,
            "recent_events": logs[:10] if logs else []
        }
        
        # Group by action
        for log in logs:
            action = log["action"]
            summary["events_by_action"][action] = summary["events_by_action"].get(action, 0) + 1
        
        # Group by resource type
        for log in logs:
            resource_type = log["resource_type"]
            summary["events_by_resource"][resource_type] = summary["events_by_resource"].get(resource_type, 0) + 1
        
        # Group by user (for users with events)
        for log in logs:
            user_id = log.get("user_id")
            if user_id:
                summary["events_by_user"][user_id] = summary["events_by_user"].get(user_id, 0) + 1
        
        # Count security events
        security_actions = [
            AuditAction.AUTH_FAILED.value,
            AuditAction.PERMISSION_DENIED.value,
            AuditAction.UNAUTHORIZED_ACCESS.value,
            AuditAction.SUSPICIOUS_ACTIVITY.value
        ]
        
        for log in logs:
            if log["action"] in security_actions:
                summary["security_events"] += 1
        
        return summary
        
    except Exception as e:
        logger.error(f"Failed to generate audit summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate audit summary")


@router.get("/security-events")
async def get_security_events(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of events")
):
    """
    Get recent security-related audit events.
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all logs for the period
        result = await audit_logger.get_audit_logs(
            organization_id=current_org["id"],
            start_date=start_date,
            limit=limit * 2  # Get more to filter
        )
        
        logs = result["logs"]
        
        # Filter for security events
        security_actions = [
            AuditAction.AUTH_FAILED.value,
            AuditAction.PERMISSION_DENIED.value,
            AuditAction.UNAUTHORIZED_ACCESS.value,
            AuditAction.SUSPICIOUS_ACTIVITY.value,
            AuditAction.SYSTEM_ERROR.value
        ]
        
        security_events = [
            log for log in logs 
            if log["action"] in security_actions
        ][:limit]
        
        return {
            "security_events": security_events,
            "total_count": len(security_events),
            "date_range": {
                "start": start_date.isoformat(),
                "end": datetime.utcnow().isoformat(),
                "days": days
            },
            "event_counts": {
                action: len([e for e in security_events if e["action"] == action])
                for action in security_actions
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to retrieve security events: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve security events")