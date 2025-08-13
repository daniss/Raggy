"""
Organization and team management API endpoints.
Handles multi-tenant organization management, member invitations, and permissions.
"""
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.enterprise_schemas import (
    OrganizationInfo, OrganizationCreate, OrganizationUpdate,
    MemberInfo, InviteMemberRequest, UpdateMemberRequest,
    OrganizationQuotas, SuccessResponse, PaginatedResponse,
    MemberRole, MemberStatus, OrganizationStatus
)
from app.core.deps import get_current_user, get_current_organization
from app.db.supabase_client import supabase_client
from app.core.config import settings
from app.services.email_service import send_invitation_email
from app.utils.permissions import check_permission, require_role

router = APIRouter(prefix="/organizations", tags=["organizations"])
logger = logging.getLogger(__name__)
security = HTTPBearer()

# =============================================================================
# ORGANIZATION MANAGEMENT
# =============================================================================

@router.get("/current", response_model=OrganizationInfo)
async def get_current_organization(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get current organization information."""
    try:
        # Get organization details with stats
        org_query = supabase_client.table("organizations").select(
            "*, organization_members!inner(user_id)"
        ).eq("id", current_org["id"]).single()
        
        org_result = org_query.execute()
        if not org_result.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = org_result.data
        
        # Get member and document counts
        member_count = supabase_client.table("organization_members").select(
            "id", count="exact"
        ).eq("organization_id", current_org["id"]).eq("status", "active").execute()
        
        document_count = supabase_client.table("documents").select(
            "id", count="exact"
        ).eq("organization_id", current_org["id"]).execute()
        
        return OrganizationInfo(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            description=org.get("description"),
            plan=org["plan"],
            status=org["status"],
            settings=org.get("settings", {}),
            branding=org.get("branding", {}),
            created_at=org["created_at"],
            member_count=member_count.count or 0,
            document_count=document_count.count or 0,
            trial_ends_at=org.get("trial_ends_at")
        )
        
    except Exception as e:
        logger.error(f"Error getting organization: {e}")
        raise HTTPException(status_code=500, detail="Failed to get organization")

@router.put("/current", response_model=SuccessResponse)
async def update_current_organization(
    update_data: OrganizationUpdate,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Update current organization."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build update data
        update_fields = {}
        if update_data.name:
            update_fields["name"] = update_data.name
        if update_data.description is not None:
            update_fields["description"] = update_data.description
        if update_data.settings:
            update_fields["settings"] = update_data.settings.dict()
        if update_data.branding:
            update_fields["branding"] = update_data.branding.dict()
        
        update_fields["updated_at"] = datetime.utcnow().isoformat()
        
        # Update organization
        result = supabase_client.table("organizations").update(
            update_fields
        ).eq("id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return SuccessResponse(message="Organization updated successfully")
        
    except Exception as e:
        logger.error(f"Error updating organization: {e}")
        raise HTTPException(status_code=500, detail="Failed to update organization")

@router.get("/quotas", response_model=OrganizationQuotas)
async def get_organization_quotas(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization usage quotas and limits."""
    try:
        # Get usage statistics using the database function
        usage_result = supabase_client.rpc(
            "get_organization_usage_stats", 
            {"org_id": current_org["id"]}
        ).execute()
        
        if not usage_result.data:
            # Fallback to manual calculation
            usage_data = {
                "documents": {"current": 0, "limit": 100, "percentage": 0},
                "members": {"current": 0, "limit": 5, "percentage": 0},
                "tokens": {"current": 0, "limit": 50000, "percentage": 0},
                "storage": {"current": 0, "limit": 1000, "percentage": 0}
            }
        else:
            usage_data = usage_result.data
        
        # Transform to quota format
        quotas = OrganizationQuotas(
            organization_id=current_org["id"],
            documents={
                "resource": "documents",
                "current": usage_data["documents"]["current"],
                "limit": usage_data["documents"]["limit"],
                "percentage": usage_data["documents"]["percentage"],
                "exceeded": usage_data["documents"]["current"] >= usage_data["documents"]["limit"]
            },
            users={
                "resource": "users",
                "current": usage_data["members"]["current"],
                "limit": usage_data["members"]["limit"],
                "percentage": usage_data["members"]["percentage"],
                "exceeded": usage_data["members"]["current"] >= usage_data["members"]["limit"]
            },
            tokens={
                "resource": "tokens",
                "current": usage_data["tokens"]["current"],
                "limit": usage_data["tokens"]["limit"],
                "percentage": usage_data["tokens"]["percentage"],
                "exceeded": usage_data["tokens"]["current"] >= usage_data["tokens"]["limit"]
            },
            storage={
                "resource": "storage",
                "current": usage_data["storage"]["current"],
                "limit": usage_data["storage"]["limit"],
                "percentage": usage_data["storage"]["percentage"],
                "exceeded": usage_data["storage"]["current"] >= usage_data["storage"]["limit"]
            },
            updated_at=datetime.utcnow()
        )
        
        return quotas
        
    except Exception as e:
        logger.error(f"Error getting quotas: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quota information")

# =============================================================================
# MEMBER MANAGEMENT
# =============================================================================

@router.get("/members", response_model=PaginatedResponse)
async def get_organization_members(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    role: Optional[MemberRole] = Query(None, description="Filter by role"),
    status: Optional[MemberStatus] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by email or name"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization members with pagination and filtering."""
    try:
        # Build query
        query = supabase_client.table("organization_members").select(
            "*, users!inner(email, name)",
            count="exact"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if role:
            query = query.eq("role", role.value)
        if status:
            query = query.eq("status", status.value)
        if search:
            # Simple search implementation - can be enhanced with full-text search
            query = query.or_(f"users.email.ilike.%{search}%,users.name.ilike.%{search}%")
        
        # Get total count
        count_result = query.execute()
        total = count_result.count or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        members_result = query.range(offset, offset + page_size - 1).execute()
        
        # Transform data
        members = []
        for member in members_result.data:
            user = member["users"]
            members.append(MemberInfo(
                id=member["id"],
                user_id=member["user_id"],
                email=user["email"],
                name=user.get("name"),
                role=member["role"],
                status=member["status"],
                permissions=member.get("permissions", {}),
                invited_at=member["invited_at"],
                joined_at=member.get("joined_at"),
                last_active=member.get("last_active"),
                invited_by=member.get("invited_by")
            ))
        
        return PaginatedResponse(
            items=members,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting members: {e}")
        raise HTTPException(status_code=500, detail="Failed to get organization members")

@router.post("/members/invite", response_model=SuccessResponse)
async def invite_member(
    invitation: InviteMemberRequest,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Invite a new member to the organization."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Check if user already exists
        existing_member = supabase_client.table("organization_members").select(
            "id"
        ).eq("organization_id", current_org["id"]).eq(
            "users.email", invitation.email
        ).execute()
        
        if existing_member.data:
            raise HTTPException(status_code=400, detail="User already a member")
        
        # Check quota limits
        quotas = await get_organization_quotas(current_user, current_org)
        if quotas.users.exceeded:
            raise HTTPException(status_code=400, detail="User limit exceeded")
        
        # Create invitation
        invitation_token = str(uuid4())
        expires_at = datetime.utcnow() + timedelta(days=7)  # 7-day expiration
        
        # Check if user exists in system
        user_result = supabase_client.table("users").select(
            "id, email"
        ).eq("email", invitation.email).execute()
        
        user_id = None
        if user_result.data:
            user_id = user_result.data[0]["id"]
        else:
            # Create pending user record
            new_user_result = supabase_client.table("users").insert({
                "email": invitation.email,
                "name": invitation.email.split("@")[0]  # Default name from email
            }).execute()
            if new_user_result.data:
                user_id = new_user_result.data[0]["id"]
        
        if not user_id:
            raise HTTPException(status_code=500, detail="Failed to create user record")
        
        # Create membership record
        member_data = {
            "organization_id": current_org["id"],
            "user_id": user_id,
            "role": invitation.role.value,
            "status": "invited",
            "invited_by": current_user["id"],
            "invitation_token": invitation_token,
            "invitation_expires_at": expires_at.isoformat()
        }
        
        if invitation.custom_permissions:
            member_data["permissions"] = invitation.custom_permissions.dict()
        
        member_result = supabase_client.table("organization_members").insert(
            member_data
        ).execute()
        
        if not member_result.data:
            raise HTTPException(status_code=500, detail="Failed to create invitation")
        
        # Send invitation email if requested
        if invitation.send_email:
            try:
                await send_invitation_email(
                    email=invitation.email,
                    organization_name=current_org["name"],
                    inviter_name=current_user.get("name", "Team member"),
                    invitation_token=invitation_token,
                    expires_at=expires_at
                )
            except Exception as e:
                logger.warning(f"Failed to send invitation email: {e}")
                # Continue - invitation is created, email failure is not critical
        
        return SuccessResponse(message="Invitation sent successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inviting member: {e}")
        raise HTTPException(status_code=500, detail="Failed to send invitation")

@router.put("/members/{member_id}", response_model=SuccessResponse)
async def update_member(
    member_id: str,
    update_data: UpdateMemberRequest,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Update organization member."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Prevent self-modification of admin status
        member = supabase_client.table("organization_members").select(
            "user_id, role"
        ).eq("id", member_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not member.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if member.data["user_id"] == current_user["id"] and update_data.role:
            if member.data["role"] == "admin" and update_data.role != MemberRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
        
        # Build update data
        update_fields = {}
        if update_data.role:
            update_fields["role"] = update_data.role.value
        if update_data.status:
            update_fields["status"] = update_data.status.value
        if update_data.permissions:
            update_fields["permissions"] = update_data.permissions.dict()
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Update member
        result = supabase_client.table("organization_members").update(
            update_fields
        ).eq("id", member_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        return SuccessResponse(message="Member updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member: {e}")
        raise HTTPException(status_code=500, detail="Failed to update member")

@router.delete("/members/{member_id}", response_model=SuccessResponse)
async def remove_member(
    member_id: str,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Remove member from organization."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Prevent self-removal
        member = supabase_client.table("organization_members").select(
            "user_id, role"
        ).eq("id", member_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not member.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if member.data["user_id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot remove yourself")
        
        # Check if this is the last admin
        if member.data["role"] == "admin":
            admin_count = supabase_client.table("organization_members").select(
                "id", count="exact"
            ).eq("organization_id", current_org["id"]).eq("role", "admin").eq("status", "active").execute()
            
            if admin_count.count <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the last admin")
        
        # Remove member
        result = supabase_client.table("organization_members").delete().eq(
            "id", member_id
        ).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        return SuccessResponse(message="Member removed successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove member")

# =============================================================================
# API KEY MANAGEMENT
# =============================================================================

@router.get("/api-keys", response_model=List[dict])
async def get_organization_api_keys(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization API keys."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get API keys for the organization
        result = supabase_client.table("api_keys").select(
            "id, name, key_prefix, permissions, status, created_at, last_used_at, expires_at"
        ).eq("organization_id", current_org["id"]).execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error getting API keys: {e}")
        raise HTTPException(status_code=500, detail="Failed to get API keys")

@router.post("/api-keys", response_model=SuccessResponse)
async def create_api_key(
    name: str,
    permissions: List[str],
    expires_at: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Create a new API key."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        import secrets
        
        # Generate API key
        api_key = f"rg_{secrets.token_urlsafe(32)}"
        key_prefix = api_key[:12] + "..."
        
        # Create API key record
        api_key_data = {
            "organization_id": current_org["id"],
            "name": name,
            "key_hash": api_key,  # In production, hash this
            "key_prefix": key_prefix,
            "permissions": permissions,
            "status": "active",
            "created_by": current_user["id"],
            "created_at": datetime.utcnow().isoformat()
        }
        
        if expires_at:
            api_key_data["expires_at"] = expires_at
        
        result = supabase_client.table("api_keys").insert(api_key_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create API key")
        
        return SuccessResponse(
            message="API key created successfully",
            data={"api_key": api_key, "key_id": result.data[0]["id"]}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to create API key")

@router.delete("/api-keys/{key_id}", response_model=SuccessResponse)
async def delete_api_key(
    key_id: str,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Delete an API key."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "settings", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        result = supabase_client.table("api_keys").delete().eq(
            "id", key_id
        ).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found")
        
        return SuccessResponse(message="API key deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete API key")

# =============================================================================
# INVITATION MANAGEMENT
# =============================================================================

@router.post("/invitations/{invitation_token}/accept", response_model=SuccessResponse)
async def accept_invitation(
    invitation_token: str,
    current_user=Depends(get_current_user)
):
    """Accept organization invitation."""
    try:
        # Find and validate invitation
        invitation = supabase_client.table("organization_members").select(
            "*, organizations(name)"
        ).eq("invitation_token", invitation_token).eq("status", "invited").single().execute()
        
        if not invitation.data:
            raise HTTPException(status_code=404, detail="Invalid or expired invitation")
        
        invitation_data = invitation.data
        
        # Check expiration
        expires_at = datetime.fromisoformat(invitation_data["invitation_expires_at"])
        if datetime.utcnow() > expires_at:
            raise HTTPException(status_code=400, detail="Invitation has expired")
        
        # Update invitation status
        update_result = supabase_client.table("organization_members").update({
            "status": "active",
            "joined_at": datetime.utcnow().isoformat(),
            "invitation_token": None,
            "invitation_expires_at": None
        }).eq("invitation_token", invitation_token).execute()
        
        if not update_result.data:
            raise HTTPException(status_code=500, detail="Failed to accept invitation")
        
        return SuccessResponse(
            message=f"Welcome to {invitation_data['organizations']['name']}!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to accept invitation")

@router.post("/invitations/{invitation_token}/decline", response_model=SuccessResponse)
async def decline_invitation(
    invitation_token: str
):
    """Decline organization invitation."""
    try:
        # Remove invitation
        result = supabase_client.table("organization_members").delete().eq(
            "invitation_token", invitation_token
        ).eq("status", "invited").execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Invalid invitation")
        
        return SuccessResponse(message="Invitation declined")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to decline invitation")