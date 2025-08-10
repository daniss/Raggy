"""
Organization usage and rate limiting API endpoints.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from app.core.deps import get_current_user, get_current_organization, require_admin
from app.core.org_rate_limiting import org_rate_limiter
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/current")
async def get_current_usage(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get current usage statistics for the organization.
    """
    try:
        organization_id = current_org["id"]
        organization_plan = current_org.get("plan", "free")
        
        # Get rate limiting usage
        usage_stats = await org_rate_limiter.get_organization_usage(
            organization_id=organization_id,
            organization_plan=organization_plan
        )
        
        # Get document count from database
        doc_count_result = supabase_client.table("documents").select(
            "id", count="exact"
        ).eq("organization_id", organization_id).execute()
        
        current_documents = doc_count_result.count or 0
        
        # Get plan limits
        plan_limits = org_rate_limiter.PLAN_LIMITS.get(organization_plan, org_rate_limiter.PLAN_LIMITS["free"])
        
        # Add document usage
        usage_stats["document_usage"] = {
            "current_documents": current_documents,
            "max_documents": plan_limits["max_documents"],
            "usage_percentage": round((current_documents / plan_limits["max_documents"]) * 100, 1),
            "max_document_size_mb": plan_limits["document_size_mb"]
        }
        
        # Add organization info
        usage_stats["organization"] = {
            "id": organization_id,
            "name": current_org["name"],
            "plan": organization_plan
        }
        
        return usage_stats
        
    except Exception as e:
        logger.error(f"Failed to get usage statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve usage statistics")


@router.get("/limits")
async def get_plan_limits(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get detailed plan limits and features.
    """
    try:
        organization_plan = current_org.get("plan", "free")
        plan_limits = org_rate_limiter.PLAN_LIMITS.get(organization_plan, org_rate_limiter.PLAN_LIMITS["free"])
        
        return {
            "plan": organization_plan,
            "limits": plan_limits,
            "features": {
                "api_access": True,
                "chat_support": True,
                "document_upload": True,
                "analytics": organization_plan in ["pro", "enterprise"],
                "audit_logs": organization_plan in ["pro", "enterprise"],
                "priority_support": organization_plan == "enterprise",
                "custom_integrations": organization_plan == "enterprise"
            },
            "all_plans": {
                plan: limits for plan, limits in org_rate_limiter.PLAN_LIMITS.items()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get plan limits: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve plan limits")


@router.post("/validate-upload")
async def validate_upload_request(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization),
    file_size_mb: float = 0,
    files_count: int = 1
):
    """
    Validate if an upload request would be allowed under current limits.
    """
    try:
        organization_id = current_org["id"]
        organization_plan = current_org.get("plan", "free")
        
        # Get current document count
        doc_count_result = supabase_client.table("documents").select(
            "id", count="exact"
        ).eq("organization_id", organization_id).execute()
        
        current_documents = doc_count_result.count or 0
        
        # Check if upload would exceed limits
        validation_results = []
        
        for i in range(files_count):
            is_allowed, error_message = await org_rate_limiter.check_document_limits(
                organization_id=organization_id,
                organization_plan=organization_plan,
                current_document_count=current_documents + i,
                document_size_mb=file_size_mb
            )
            
            validation_results.append({
                "file_index": i + 1,
                "allowed": is_allowed,
                "error_message": error_message if not is_allowed else None
            })
            
            if not is_allowed:
                break  # Stop checking if we hit a limit
        
        # Overall validation
        all_allowed = all(result["allowed"] for result in validation_results)
        
        return {
            "allowed": all_allowed,
            "files_count": files_count,
            "file_size_mb": file_size_mb,
            "current_documents": current_documents,
            "validation_results": validation_results,
            "plan": organization_plan
        }
        
    except Exception as e:
        logger.error(f"Failed to validate upload request: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate upload request")


@router.get("/history")
async def get_usage_history(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization),
    days: int = 30
):
    """
    Get usage history for the organization (admin only).
    Note: This would require storing historical usage data.
    For now, returns current usage only.
    """
    try:
        # In a production system, you would store historical usage data
        # For now, return current usage as a placeholder
        current_usage = await get_current_usage(current_user, current_org)
        
        return {
            "message": "Historical usage data not yet implemented",
            "current_usage": current_usage,
            "note": "This endpoint will provide historical usage trends once usage logging is implemented"
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve usage history")


@router.get("/quotas")
async def get_quota_status(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get quota status with warnings for approaching limits.
    """
    try:
        # Get current usage
        usage_stats = await get_current_usage(current_user, current_org)
        
        # Calculate warnings
        warnings = []
        
        # Check each usage type for warnings (>80% = warning, >95% = critical)
        usage_percentages = usage_stats.get("usage_percentage", {})
        
        for usage_type, percentage in usage_percentages.items():
            if percentage >= 95:
                warnings.append({
                    "type": "critical",
                    "message": f"{usage_type.replace('_', ' ').title()} usage is at {percentage}% - limit will be reached soon",
                    "usage_type": usage_type,
                    "percentage": percentage
                })
            elif percentage >= 80:
                warnings.append({
                    "type": "warning", 
                    "message": f"{usage_type.replace('_', ' ').title()} usage is at {percentage}% - approaching limit",
                    "usage_type": usage_type,
                    "percentage": percentage
                })
        
        # Check document usage
        doc_usage = usage_stats.get("document_usage", {})
        doc_percentage = doc_usage.get("usage_percentage", 0)
        
        if doc_percentage >= 95:
            warnings.append({
                "type": "critical",
                "message": f"Document storage is at {doc_percentage}% - limit will be reached soon",
                "usage_type": "documents",
                "percentage": doc_percentage
            })
        elif doc_percentage >= 80:
            warnings.append({
                "type": "warning",
                "message": f"Document storage is at {doc_percentage}% - approaching limit", 
                "usage_type": "documents",
                "percentage": doc_percentage
            })
        
        return {
            "quota_status": "healthy" if not warnings else ("critical" if any(w["type"] == "critical" for w in warnings) else "warning"),
            "warnings": warnings,
            "usage_summary": usage_stats,
            "recommendations": [
                "Consider upgrading your plan if you're approaching limits",
                "Monitor usage regularly to avoid service interruptions",
                "Contact support if you need temporary limit increases"
            ] if warnings else []
        }
        
    except Exception as e:
        logger.error(f"Failed to get quota status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve quota status")