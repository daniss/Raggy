"""
User management API endpoints.
Handles user profile and organization membership.
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from app.models.enterprise_schemas import (
    OrganizationInfo, SuccessResponse, PlanType, OrganizationStatus,
    OrganizationSettings, OrganizationBranding
)
from app.core.deps import get_current_user, require_auth
from app.db.supabase_client import get_supabase_client

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)

@router.get("/me/organizations", response_model=List[OrganizationInfo])
async def get_user_organizations(
    current_user=Depends(require_auth)
):
    """Get all organizations the current user belongs to."""
    try:
        # Get user's organization memberships
        supabase = get_supabase_client()
        memberships_result = supabase.table("organization_members").select(
            "organizations!inner(*)"
        ).eq("user_id", current_user["id"]).eq("status", "active").execute()
        
        if not memberships_result.data:
            return []
        
        organizations = []
        for membership in memberships_result.data:
            org = membership["organizations"]
            
            # Get member and document counts for each org
            member_count = supabase.table("organization_members").select(
                "id", count="exact"
            ).eq("organization_id", org["id"]).eq("status", "active").execute()
            
            document_count = supabase.table("documents").select(
                "id", count="exact"
            ).eq("organization_id", org["id"]).execute()
            
            # Create settings and branding objects
            settings_data = org.get("settings", {})
            branding_data = org.get("branding", {})
            
            organizations.append(OrganizationInfo(
                id=org["id"],
                name=org["name"],
                slug=org["slug"],
                description=org.get("description"),
                plan=PlanType(org.get("tier") or org.get("plan", "starter")),  # Use tier first, fallback to plan
                status=OrganizationStatus(org.get("status", "active")),
                settings=OrganizationSettings(**settings_data) if settings_data else OrganizationSettings(),
                branding=OrganizationBranding(**branding_data) if branding_data else OrganizationBranding(),
                created_at=org["created_at"],
                member_count=member_count.count or 0,
                document_count=document_count.count or 0,
                trial_ends_at=org.get("trial_ends_at")
            ))
        
        return organizations
        
    except Exception as e:
        logger.error(f"Error getting user organizations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user organizations")

@router.get("/me/profile")
async def get_user_profile(
    current_user=Depends(require_auth)
):
    """Get current user profile information."""
    try:
        # Get user details
        supabase = get_supabase_client()
        user_result = supabase.table("users").select(
            "id, email, name, created_at, updated_at"
        ).eq("id", current_user["id"]).single().execute()
        
        if not user_result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user_result.data
        
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")

@router.put("/me/profile", response_model=SuccessResponse)
async def update_user_profile(
    name: str = None,
    current_user=Depends(require_auth)
):
    """Update current user profile."""
    try:
        update_data = {}
        if name:
            update_data["name"] = name
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        supabase = get_supabase_client()
        result = supabase.table("users").update(
            update_data
        ).eq("id", current_user["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return SuccessResponse(message="Profile updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")