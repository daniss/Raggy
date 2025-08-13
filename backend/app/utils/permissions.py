"""
Permission and role-based access control utilities.
Handles enterprise RBAC for multi-tenant organizations.
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status

from app.db.supabase_client import supabase_client
from app.core.permissions_matrix import (
    UserRole, Permission, PlanTier,
    get_user_permissions as get_permissions_from_roles,
    has_permission as check_permission_matrix,
    get_tier_limits, can_access_feature,
    get_visible_navigation, get_role_display_name,
    is_admin_role, can_manage_users
)

logger = logging.getLogger(__name__)

# =============================================================================
# USER MEMBERSHIP FUNCTIONS
# =============================================================================

async def get_user_membership(user_id: str, organization_id: str) -> Optional[Dict[str, Any]]:
    """Get user's membership in an organization."""
    try:
        result = supabase_client.table("organization_members").select(
            "*"
        ).eq("user_id", user_id).eq("organization_id", organization_id).eq("status", "active").single().execute()
        
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error getting user membership: {e}")
        return None

async def get_user_roles(user_id: str, organization_id: str) -> List[str]:
    """Get user's roles in an organization."""
    membership = await get_user_membership(user_id, organization_id)
    if not membership:
        return []
    
    # Check both 'roles' array and single 'role' field
    roles = membership.get("roles", [])
    if not roles and membership.get("role"):
        roles = [membership["role"]]
    
    return roles

# =============================================================================
# PERMISSION CHECKING FUNCTIONS
# =============================================================================

async def check_permission(
    user_id: str,
    org_id: str,
    permission: str,
    action: Optional[str] = None
) -> bool:
    """Check if user has permission for action in organization.
    
    Args:
        user_id: User ID to check
        org_id: Organization ID
        permission: Permission code (e.g., 'documents:upload') or resource name
        action: Optional action for legacy format
    
    Returns:
        True if user has permission, False otherwise
    """
    try:
        # Get user's roles
        user_roles = await get_user_roles(user_id, org_id)
        if not user_roles:
            return False
        
        # Convert to permission code format if needed
        if ":" in permission:
            # Already in permission code format
            perm_code = permission
        elif action:
            # Legacy format - convert to permission code
            perm_code = f"{permission}:{action}"
        else:
            # No action specified, check view permission by default
            perm_code = f"{permission}:view"
        
        # Try to match against Permission enum
        try:
            perm_enum = Permission(perm_code)
            return check_permission_matrix(user_roles, perm_enum)
        except ValueError:
            # Not a standard permission, check custom permissions
            pass
        
        # Check custom permissions from database
        membership = await get_user_membership(user_id, org_id)
        if membership and membership.get("permissions"):
            # Handle nested permission structure
            if action:
                resource_perms = membership["permissions"].get(permission, {})
                return resource_perms.get(action, False)
            else:
                # Direct permission check
                return membership["permissions"].get(permission, False)
        
        return False
        
    except Exception as e:
        logger.error(f"Error checking permission: {e}")
        return False

async def require_permission(user_id: str, organization_id: str, permission: str, action: Optional[str] = None):
    """Require specific permission or raise HTTPException."""
    has_perm = await check_permission(user_id, organization_id, permission, action)
    if not has_perm:
        perm_str = f"{permission}:{action}" if action else permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions: {perm_str} required"
        )

async def get_user_permissions(user_id: str, organization_id: str) -> Dict[str, Any]:
    """Get user's effective permissions in an organization."""
    try:
        # Get user's roles
        user_roles = await get_user_roles(user_id, organization_id)
        if not user_roles:
            return {}
        
        # Get standard permissions from roles
        standard_perms = get_permissions_from_roles(user_roles)
        
        # Convert to dict format for API response
        perm_dict = {
            "standard": [perm.value for perm in standard_perms],
            "custom": {}
        }
        
        # Add custom permissions from database
        membership = await get_user_membership(user_id, organization_id)
        if membership and membership.get("permissions"):
            perm_dict["custom"] = membership["permissions"]
        
        return perm_dict
        
    except Exception as e:
        logger.error(f"Error getting user permissions: {e}")
        return {}

# =============================================================================
# ROLE CHECKING FUNCTIONS
# =============================================================================

async def check_role(user_id: str, organization_id: str, required_role: str) -> bool:
    """Check if user has specific role."""
    user_roles = await get_user_roles(user_id, organization_id)
    return required_role.lower() in [r.lower() for r in user_roles]

async def require_role(user_id: str, organization_id: str, required_roles: List[str]):
    """Require user to have one of the specified roles or raise HTTPException."""
    user_roles = await get_user_roles(user_id, organization_id)
    
    # Check if user has any of the required roles
    has_role = any(
        role.lower() in [r.lower() for r in user_roles]
        for role in required_roles
    )
    
    if not has_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"One of these roles required: {', '.join(required_roles)}"
        )

async def is_admin(user_id: str, organization_id: str) -> bool:
    """Check if user has admin privileges."""
    user_roles = await get_user_roles(user_id, organization_id)
    return any(is_admin_role(role) for role in user_roles)

# =============================================================================
# ORGANIZATION ACCESS CONTROL
# =============================================================================

async def get_user_organizations(user_id: str) -> List[Dict[str, Any]]:
    """Get all organizations user has access to with their roles.
    
    Args:
        user_id: User ID to get organizations for
    
    Returns:
        List of organization dictionaries with user's role
    """
    try:
        result = supabase_client.table("organization_members").select(
            "organization_id, role, roles, status, permissions, "
            "organizations(id, name, slug, tier, plan, status)"
        ).eq("user_id", user_id).eq("status", "active").execute()
        
        organizations = []
        for member in result.data or []:
            org = member.get("organizations", {})
            user_roles = member.get("roles", [member.get("role", "user")])
            
            organizations.append({
                "id": member["organization_id"],
                "name": org.get("name", "Unknown"),
                "slug": org.get("slug", ""),
                "tier": org.get("tier", org.get("plan", "starter")),
                "status": org.get("status", "active"),
                "role": member.get("role", "user"),
                "roles": user_roles,
                "role_display": get_role_display_name(user_roles[0] if user_roles else "user"),
                "permissions": member.get("permissions", {}),
                "is_admin": any(is_admin_role(role) for role in user_roles)
            })
        
        return organizations
        
    except Exception as e:
        logger.error(f"Error getting user organizations: {e}")
        return []

async def verify_organization_access(user_id: str, organization_id: str) -> bool:
    """Verify user has access to organization."""
    membership = await get_user_membership(user_id, organization_id)
    return membership is not None

async def get_default_organization(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user's default/primary organization."""
    try:
        # Check user preferences first
        pref_result = supabase_client.table("user_preferences").select(
            "default_org_id"
        ).eq("user_id", user_id).single().execute()
        
        if pref_result.data and pref_result.data.get("default_org_id"):
            org_result = supabase_client.table("organizations").select(
                "*"
            ).eq("id", pref_result.data["default_org_id"]).single().execute()
            
            if org_result.data:
                return org_result.data
        
        # Fall back to first organization
        orgs = await get_user_organizations(user_id)
        return orgs[0] if orgs else None
        
    except Exception as e:
        logger.error(f"Error getting default organization: {e}")
        return None

# =============================================================================
# TIER AND FEATURE ACCESS
# =============================================================================

async def get_organization_tier(organization_id: str) -> str:
    """Get organization's subscription tier."""
    try:
        result = supabase_client.table("organizations").select(
            "tier"
        ).eq("id", organization_id).single().execute()
        
        if result.data:
            return result.data.get("tier", "starter")
        return "starter"
        
    except Exception as e:
        logger.error(f"Error getting organization tier: {e}")
        return "starter"

async def check_feature_access(organization_id: str, feature: str) -> bool:
    """Check if organization has access to a feature based on tier."""
    tier = await get_organization_tier(organization_id)
    return can_access_feature(tier, feature)

async def get_organization_limits(organization_id: str) -> Dict[str, Any]:
    """Get organization's usage limits based on tier."""
    tier = await get_organization_tier(organization_id)
    return get_tier_limits(tier)

async def get_navigation_items(user_id: str, organization_id: str) -> List[str]:
    """Get navigation items visible to user based on roles and tier."""
    user_roles = await get_user_roles(user_id, organization_id)
    tier = await get_organization_tier(organization_id)
    return get_visible_navigation(user_roles, tier)

# =============================================================================
# RESOURCE ACCESS CONTROL
# =============================================================================

async def check_document_access(user_id: str, document_id: str, action: str = "view") -> bool:
    """Check if user can access specific document."""
    try:
        # Get document's organization
        doc_result = supabase_client.table("documents").select(
            "organization_id"
        ).eq("id", document_id).single().execute()
        
        if not doc_result.data:
            return False
        
        organization_id = doc_result.data["organization_id"]
        
        # Check user's document permissions in that organization
        return await check_permission(user_id, organization_id, "documents", action)
        
    except Exception as e:
        logger.error(f"Error checking document access: {e}")
        return False

async def check_conversation_access(user_id: str, conversation_id: str, action: str = "view") -> bool:
    """Check if user can access specific conversation."""
    try:
        # Get conversation's organization
        conv_result = supabase_client.table("chat_conversations").select(
            "organization_id, user_id"
        ).eq("id", conversation_id).single().execute()
        
        if not conv_result.data:
            return False
        
        conversation = conv_result.data
        organization_id = conversation["organization_id"]
        
        # Users can always access their own conversations for reading
        if conversation.get("user_id") == user_id and action == "view":
            return True
        
        # Check organizational permissions
        return await check_permission(user_id, organization_id, "assistant", "ask")
        
    except Exception as e:
        logger.error(f"Error checking conversation access: {e}")
        return False

# =============================================================================
# QUOTA AND LIMIT CHECKING
# =============================================================================

async def check_quota(organization_id: str, resource: str, current_usage: int) -> Dict[str, Any]:
    """Check if organization is within quota for a resource."""
    try:
        limits = await get_organization_limits(organization_id)
        
        resource_mapping = {
            "documents": "document_limit",
            "tokens": "token_limit_month",
            "users": "max_users",
            "storage": "max_storage_mb"
        }
        
        limit_key = resource_mapping.get(resource)
        if not limit_key:
            return {"allowed": True, "limit": None, "current": current_usage}
        
        limit = limits.get(limit_key, 0)
        
        return {
            "allowed": current_usage < limit,
            "limit": limit,
            "current": current_usage,
            "percentage": (current_usage / limit * 100) if limit > 0 else 0,
            "remaining": max(0, limit - current_usage)
        }
        
    except Exception as e:
        logger.error(f"Error checking quota: {e}")
        return {"allowed": True, "limit": None, "current": current_usage}

async def enforce_quota(organization_id: str, resource: str, current_usage: int):
    """Enforce quota limits or raise HTTPException."""
    quota_check = await check_quota(organization_id, resource, current_usage)
    
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "quota_exceeded",
                "resource": resource,
                "limit": quota_check["limit"],
                "current": quota_check["current"],
                "message": f"Limite atteinte pour {resource}. Passez à un plan supérieur pour augmenter vos limites."
            }
        )

# =============================================================================
# AUDIT AND LOGGING
# =============================================================================

async def log_audit_event(
    organization_id: str,
    user_id: str,
    event_type: str,
    payload: Dict[str, Any]
):
    """Log an audit event for compliance tracking."""
    try:
        audit_data = {
            "org_id": organization_id,
            "actor_user_id": user_id,
            "event_type": event_type,
            "payload": payload
        }
        
        supabase_client.table("audit_logs").insert(audit_data).execute()
        
    except Exception as e:
        logger.error(f"Error logging audit event: {e}")