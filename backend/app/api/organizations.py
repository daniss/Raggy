import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request
from app.models.schemas import (
    OrganizationCreate, OrganizationInfo, MemberInfo, 
    InviteMemberRequest, UpdateMemberRequest, UserRole, MemberStatus
)
from app.core.deps import get_current_user, get_current_organization, require_admin
from app.core.audit_middleware import get_request_info
from app.services.audit_logger import audit_logger, AuditAction
from app.db.supabase_client import supabase_client
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["organizations"])


def validate_slug(slug: str) -> bool:
    """Validate organization slug format."""
    # Reserved words that cannot be used as slugs
    reserved_words = {
        'api', 'www', 'admin', 'root', 'support', 'help', 'about', 'contact',
        'docs', 'blog', 'status', 'health', 'ping', 'test', 'staging', 'prod',
        'production', 'dev', 'development', 'mail', 'email', 'ftp', 'ssh'
    }
    
    # Basic format validation
    if not re.match(r'^[a-z0-9-]+$', slug):
        return False
        
    # Length validation
    if len(slug) < 3 or len(slug) > 50:
        return False
        
    # Cannot start or end with hyphen
    if slug.startswith('-') or slug.endswith('-'):
        return False
        
    # Cannot be a reserved word
    if slug.lower() in reserved_words:
        return False
        
    # Cannot contain consecutive hyphens
    if '--' in slug:
        return False
        
    return True


@router.post("/", response_model=OrganizationInfo)
async def create_organization(
    request: Request,
    org_data: OrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new organization and make the current user an admin.
    """
    try:
        # Validate slug format
        if not validate_slug(org_data.slug):
            raise HTTPException(
                status_code=400,
                detail="Invalid slug format. Must be 3-50 characters, lowercase letters, numbers, and hyphens only. Cannot start/end with hyphens or use reserved words."
            )
        
        # Check if slug is already taken
        existing = supabase_client.table("organizations").select("id").eq("slug", org_data.slug).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Organization slug already exists")
        
        # Create organization with atomic operation
        org_id = str(uuid.uuid4())
        
        try:
            # Create organization
            org_result = supabase_client.table("organizations").insert({
                "id": org_id,
                "name": org_data.name,
                "slug": org_data.slug,
                "description": org_data.description
            }).execute()
            
            if not org_result.data:
                raise HTTPException(status_code=500, detail="Failed to create organization")
            
            # Add current user as admin
            try:
                member_result = supabase_client.table("organization_members").insert({
                    "organization_id": org_id,
                    "user_id": current_user["id"],
                    "role": UserRole.ADMIN,
                    "status": MemberStatus.ACTIVE
                }).execute()
                
                if not member_result.data:
                    raise Exception("Failed to create membership")
                    
            except Exception as member_error:
                # Cleanup: delete the organization if member creation fails
                logger.error(f"Member creation failed, cleaning up organization {org_id}: {member_error}")
                try:
                    supabase_client.table("organizations").delete().eq("id", org_id).execute()
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup organization {org_id}: {cleanup_error}")
                raise HTTPException(status_code=500, detail="Failed to add user to organization")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Organization creation failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to create organization")
        
        # Return organization info
        org = org_result.data[0]
        
        # Log audit event
        client_ip, user_agent = get_request_info(request)
        await audit_logger.log_organization_event(
            action=AuditAction.ORG_CREATE,
            organization_id=org_id,
            user_id=current_user["id"],
            new_values={
                "name": org_data.name,
                "slug": org_data.slug,
                "description": org_data.description
            },
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        return OrganizationInfo(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            description=org["description"],
            plan=org["plan"],
            member_count=1,
            document_count=0,
            created_at=org["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating organization: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/current", response_model=OrganizationInfo)
async def get_current_organization_endpoint(
    current_org: dict = Depends(get_current_organization)
):
    """
    Get current user's organization information.
    """
    try:
        # Optimize: Get counts in a single query using RPC function or aggregation
        try:
            # Try to use a single query with aggregation
            counts_result = supabase_client.rpc(
                "get_organization_counts",
                {"org_id": current_org["id"]}
            ).execute()
            
            if counts_result.data:
                member_count = counts_result.data.get("member_count", 0)
                document_count = counts_result.data.get("document_count", 0)
            else:
                raise Exception("RPC function not available")
                
        except Exception:
            # Fallback to separate queries if RPC not available
            logger.info("Using fallback separate queries for organization counts")
            member_count_result = supabase_client.table("organization_members").select("id", count="exact").eq("organization_id", current_org["id"]).execute()
            document_count_result = supabase_client.table("documents").select("id", count="exact").eq("organization_id", current_org["id"]).execute()
            member_count = member_count_result.count or 0
            document_count = document_count_result.count or 0
        
        return OrganizationInfo(
            id=current_org["id"],
            name=current_org["name"],
            slug=current_org["slug"],
            description=current_org.get("description"),
            plan=current_org.get("plan", "free"),
            member_count=member_count,
            document_count=document_count,
            created_at=current_org["created_at"]
        )
        
    except Exception as e:
        logger.error(f"Error getting organization: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/members", response_model=List[MemberInfo])
async def get_organization_members(
    current_org: dict = Depends(get_current_organization)
):
    """
    Get all members of the current organization.
    """
    try:
        result = supabase_client.table("organization_members").select(
            "id, user_id, role, status, joined_at, invited_at, users!organization_members_user_id_fkey(email, name)"
        ).eq("organization_id", current_org["id"]).execute()
        
        members = []
        for member in result.data:
            user_data = member["users"]
            members.append(MemberInfo(
                id=member["id"],
                user_id=member["user_id"],
                email=user_data["email"],
                name=user_data.get("name"),
                role=member["role"],
                status=member["status"],
                joined_at=member.get("joined_at"),
                invited_at=member.get("invited_at")
            ))
        
        return members
        
    except Exception as e:
        logger.error(f"Error getting organization members: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/members/invite")
async def invite_member(
    request: Request,
    invite_data: InviteMemberRequest,
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Invite a new member to the organization (admin only).
    """
    try:
        # Check if user already exists
        user_result = supabase_client.table("users").select("id").eq("email", invite_data.email).execute()
        
        if user_result.data:
            # User exists, check if already a member
            user_id = user_result.data[0]["id"]
            existing_member = supabase_client.table("organization_members").select("id").eq("organization_id", current_org["id"]).eq("user_id", user_id).execute()
            
            if existing_member.data:
                raise HTTPException(status_code=400, detail="User is already a member of this organization")
            
            # Add existing user as member
            supabase_client.table("organization_members").insert({
                "organization_id": current_org["id"],
                "user_id": user_id,
                "role": invite_data.role,
                "status": MemberStatus.ACTIVE,
                "invited_by": current_user["id"]
            }).execute()
            
        else:
            # User doesn't exist, create invitation (for now just return success)
            # In a real implementation, you'd send an email invitation
            logger.info(f"Would send invitation email to {invite_data.email}")
        
        # Log audit event
        client_ip, user_agent = get_request_info(request)
        await audit_logger.log_member_event(
            action=AuditAction.MEMBER_INVITE,
            organization_id=current_org["id"],
            user_id=current_user["id"],
            member_id=user_id if user_result.data else "pending",
            new_values={
                "email": invite_data.email,
                "role": invite_data.role,
                "invited_by": current_user["id"]
            },
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        return {"message": "Member invited successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inviting member: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/members/{member_id}")
async def update_member(
    member_id: str,
    update_data: UpdateMemberRequest,
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Update a member's role or status (admin only).
    """
    try:
        # Check if member exists in this organization
        member_result = supabase_client.table("organization_members").select("*").eq("id", member_id).eq("organization_id", current_org["id"]).execute()
        
        if not member_result.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        member = member_result.data[0]
        
        # Prevent user from demoting themselves if they're the only admin
        if member["user_id"] == current_user["id"] and update_data.role == UserRole.MEMBER:
            admin_count = supabase_client.table("organization_members").select("id", count="exact").eq("organization_id", current_org["id"]).eq("role", UserRole.ADMIN).execute()
            
            if admin_count.count <= 1:
                raise HTTPException(status_code=400, detail="Cannot demote the only admin")
        
        # Update member
        update_fields = {}
        if update_data.role is not None:
            update_fields["role"] = update_data.role
        if update_data.status is not None:
            update_fields["status"] = update_data.status
        
        if update_fields:
            supabase_client.table("organization_members").update(update_fields).eq("id", member_id).execute()
        
        return {"message": "Member updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Remove a member from the organization (admin only).
    """
    try:
        # Check if member exists in this organization
        member_result = supabase_client.table("organization_members").select("*").eq("id", member_id).eq("organization_id", current_org["id"]).execute()
        
        if not member_result.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        member = member_result.data[0]
        
        # Prevent user from removing themselves if they're the only admin
        if member["user_id"] == current_user["id"]:
            admin_count = supabase_client.table("organization_members").select("id", count="exact").eq("organization_id", current_org["id"]).eq("role", UserRole.ADMIN).execute()
            
            if admin_count.count <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the only admin")
        
        # Remove member
        supabase_client.table("organization_members").delete().eq("id", member_id).execute()
        
        return {"message": "Member removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")