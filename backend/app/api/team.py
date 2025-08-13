"""
Team management API endpoints.
Handles member invitations, role management, and team operations.
"""
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr

from app.core.deps import (
    require_auth, get_current_organization, require_permission_dep,
    require_quota_check, get_user_context
)
from app.db.supabase_client import supabase_client
from app.utils.permissions import log_audit_event
from app.core.permissions_matrix import UserRole, get_role_display_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])

# =============================================================================
# SCHEMAS
# =============================================================================

class InviteMemberRequest(BaseModel):
    email: EmailStr
    roles: List[str] = ["user"]
    send_email: bool = True
    custom_message: Optional[str] = None

class UpdateMemberRequest(BaseModel):
    roles: Optional[List[str]] = None
    status: Optional[str] = None

class MemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    name: Optional[str]
    roles: List[str]
    role_display: str
    status: str
    invited_at: datetime
    joined_at: Optional[datetime]
    last_active: Optional[datetime]
    invited_by: Optional[str]
    is_admin: bool

class TeamSummaryResponse(BaseModel):
    total_members: int
    active_members: int
    pending_invitations: int
    seat_limit: int
    seat_usage_percentage: float
    roles_breakdown: dict

# =============================================================================
# TEAM OVERVIEW
# =============================================================================

@router.get("/summary", response_model=TeamSummaryResponse)
async def get_team_summary(
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("team", "manage"))
):
    """Get team summary statistics."""
    try:
        # Get member counts
        members_result = supabase_client.table("organization_members").select(
            "id, status, role, roles", count="exact"
        ).eq("organization_id", current_org["id"]).execute()
        
        total_members = members_result.count or 0
        active_members = len([m for m in members_result.data if m["status"] == "active"])
        pending_invitations = len([m for m in members_result.data if m["status"] == "invited"])
        
        # Get seat limit from organization settings
        from app.utils.permissions import get_organization_limits
        limits = await get_organization_limits(current_org["id"])
        seat_limit = limits.get("max_users", 5)
        
        # Calculate roles breakdown
        roles_breakdown = {}
        for member in members_result.data:
            if member["status"] == "active":
                member_roles = member.get("roles", [member.get("role", "user")])
                for role in member_roles:
                    role_display = get_role_display_name(role)
                    roles_breakdown[role_display] = roles_breakdown.get(role_display, 0) + 1
        
        return TeamSummaryResponse(
            total_members=total_members,
            active_members=active_members,
            pending_invitations=pending_invitations,
            seat_limit=seat_limit,
            seat_usage_percentage=(active_members / seat_limit * 100) if seat_limit > 0 else 0,
            roles_breakdown=roles_breakdown
        )
        
    except Exception as e:
        logger.error(f"Error getting team summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get team summary"
        )

# =============================================================================
# MEMBER MANAGEMENT
# =============================================================================

@router.get("/members", response_model=List[MemberResponse])
async def get_team_members(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role_filter: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("team", "manage"))
):
    """Get organization members with filtering and pagination."""
    try:
        # Build query
        query = supabase_client.table("organization_members").select(
            "*, users!inner(id, email, name)"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if role_filter:
            query = query.contains("roles", [role_filter])
        if status_filter:
            query = query.eq("status", status_filter)
        if search:
            query = query.or_(f"users.email.ilike.%{search}%,users.name.ilike.%{search}%")
        
        # Apply pagination
        offset = (page - 1) * page_size
        result = query.range(offset, offset + page_size - 1).execute()
        
        # Transform response
        members = []
        for member in result.data:
            user = member["users"]
            member_roles = member.get("roles", [member.get("role", "user")])
            
            members.append(MemberResponse(
                id=member["id"],
                user_id=member["user_id"],
                email=user["email"],
                name=user.get("name"),
                roles=member_roles,
                role_display=get_role_display_name(member_roles[0] if member_roles else "user"),
                status=member["status"],
                invited_at=member["invited_at"],
                joined_at=member.get("joined_at"),
                last_active=member.get("last_active"),
                invited_by=member.get("invited_by"),
                is_admin=any(role in ["owner", "admin"] for role in member_roles)
            ))
        
        return members
        
    except Exception as e:
        logger.error(f"Error getting team members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get team members"
        )

@router.post("/members/invite")
async def invite_member(
    invitation: InviteMemberRequest,
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("team", "manage")),
    __: None = Depends(require_quota_check("users"))
):
    """Invite a new member to the organization."""
    try:
        # Check if user already exists
        existing_result = supabase_client.table("organization_members").select(
            "id"
        ).eq("organization_id", current_org["id"]).eq("users.email", invitation.email).execute()
        
        if existing_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member"
            )
        
        # Validate roles
        valid_roles = [role.value for role in UserRole]
        for role in invitation.roles:
            if role not in valid_roles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role: {role}"
                )
        
        # Create or get user
        user_result = supabase_client.table("users").select("id").eq("email", invitation.email).execute()
        
        if user_result.data:
            user_id = user_result.data[0]["id"]
        else:
            # Create user record
            new_user = supabase_client.table("users").insert({
                "email": invitation.email,
                "name": invitation.email.split("@")[0]
            }).execute()
            user_id = new_user.data[0]["id"]
        
        # Create invitation
        invitation_token = str(uuid4())
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        invitation_data = {
            "org_id": current_org["id"],
            "user_id": user_id,
            "email": invitation.email,
            "roles": invitation.roles,
            "invited_by": current_user["id"],
            "token": invitation_token,
            "expires_at": expires_at.isoformat()
        }
        
        invite_result = supabase_client.table("organization_invitations").insert(
            invitation_data
        ).execute()
        
        if not invite_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create invitation"
            )
        
        # Create membership record with invited status
        member_data = {
            "organization_id": current_org["id"],
            "user_id": user_id,
            "role": invitation.roles[0],  # Primary role
            "roles": invitation.roles,
            "status": "invited",
            "invited_by": current_user["id"],
            "invitation_token": invitation_token,
            "invitation_expires_at": expires_at.isoformat()
        }
        
        member_result = supabase_client.table("organization_members").insert(
            member_data
        ).execute()
        
        # Log audit event
        await log_audit_event(
            current_org["id"],
            current_user["id"],
            "user.invited",
            {
                "email": invitation.email,
                "roles": invitation.roles,
                "invitation_token": invitation_token
            }
        )
        
        # TODO: Send invitation email
        if invitation.send_email:
            logger.info(f"Would send invitation email to {invitation.email}")
        
        return {"message": "Invitation sent successfully", "invitation_id": invite_result.data[0]["id"]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inviting member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invite member"
        )

@router.put("/members/{member_id}")
async def update_member(
    member_id: str,
    update_data: UpdateMemberRequest,
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("team", "manage"))
):
    """Update organization member roles or status."""
    try:
        # Get current member data
        member_result = supabase_client.table("organization_members").select(
            "*"
        ).eq("id", member_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not member_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        member = member_result.data
        
        # Prevent self-modification of admin status
        if member["user_id"] == current_user["id"]:
            current_roles = member.get("roles", [member.get("role", "user")])
            if update_data.roles and "admin" in current_roles and "admin" not in update_data.roles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove your own admin status"
                )
        
        # Build update data
        update_fields = {}
        if update_data.roles:
            # Validate roles
            valid_roles = [role.value for role in UserRole]
            for role in update_data.roles:
                if role not in valid_roles:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid role: {role}"
                    )
            
            update_fields["roles"] = update_data.roles
            update_fields["role"] = update_data.roles[0]  # Primary role
        
        if update_data.status:
            update_fields["status"] = update_data.status
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updates provided"
            )
        
        # Update member
        result = supabase_client.table("organization_members").update(
            update_fields
        ).eq("id", member_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        # Log audit event
        await log_audit_event(
            current_org["id"],
            current_user["id"],
            "user.role.changed",
            {
                "member_id": member_id,
                "user_id": member["user_id"],
                "roles_before": member.get("roles", [member.get("role")]),
                "roles_after": update_data.roles,
                "status_before": member["status"],
                "status_after": update_data.status
            }
        )
        
        return {"message": "Member updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update member"
        )

@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("team", "manage"))
):
    """Remove member from organization."""
    try:
        # Get member data
        member_result = supabase_client.table("organization_members").select(
            "*"
        ).eq("id", member_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not member_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        member = member_result.data
        
        # Prevent self-removal
        if member["user_id"] == current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove yourself from the organization"
            )
        
        # Check if this is the last admin
        member_roles = member.get("roles", [member.get("role", "user")])
        if any(role in ["admin", "owner"] for role in member_roles):
            admin_count = supabase_client.table("organization_members").select(
                "id", count="exact"
            ).eq("organization_id", current_org["id"]).eq("status", "active").contains(
                "roles", ["admin"]
            ).execute()
            
            if admin_count.count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last admin"
                )
        
        # Remove member
        result = supabase_client.table("organization_members").delete().eq(
            "id", member_id
        ).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        # Log audit event
        await log_audit_event(
            current_org["id"],
            current_user["id"],
            "user.removed",
            {
                "member_id": member_id,
                "user_id": member["user_id"],
                "roles": member_roles
            }
        )
        
        return {"message": "Member removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove member"
        )