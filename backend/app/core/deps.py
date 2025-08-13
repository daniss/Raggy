"""
Dependency injection for FastAPI endpoints.
Handles authentication, organization context, and permission checking.
"""
from typing import Generator, Optional, Dict, Any
import logging
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

from app.core.config import settings
from app.db.supabase_client import supabase_client
from app.core.org_context import (
    organization_context_middleware,
    get_current_org_id,
    get_current_org,
    OrganizationContext
)
from app.utils.permissions import (
    check_permission,
    require_permission,
    get_user_organizations,
    get_default_organization,
    get_navigation_items
)

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

# =============================================================================
# BASIC DEPENDENCIES
# =============================================================================

def get_supabase() -> Client:
    """Get Supabase client instance."""
    return supabase_client

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    supabase: Client = Depends(get_supabase)
) -> Optional[dict]:
    """Get current authenticated user from JWT token."""
    if not credentials:
        logger.error("❌ NO CREDENTIALS PROVIDED - Missing Authorization header")
        return None
    
    try:
        token = credentials.credentials
        logger.debug(f"Processing token: {token[:20]}... (length: {len(token)})")
        
        # Method 1: Try Supabase auth.get_user() (for user tokens)
        try:
            logger.debug("Attempting Supabase auth.get_user()")
            user_response = supabase.auth.get_user(token)
            logger.debug(f"Supabase response: {type(user_response)}")
            
            if hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user.model_dump()
                logger.info(f"Successfully authenticated user via Supabase: {user_data.get('email', 'unknown')}")
                return user_data
        except Exception as auth_error:
            logger.warning(f"Supabase auth.get_user failed: {type(auth_error).__name__}: {str(auth_error)}")
        
        # Method 2: Try JWT decoding for valid JWT format
        try:
            logger.debug("Attempting JWT decoding")
            import jwt
            
            # First check if it's a valid JWT format (3 parts separated by dots)
            if token.count('.') != 2:
                logger.warning(f"Invalid JWT format: {token[:20]}... (expected 3 parts, got {token.count('.') + 1})")
                return None
            
            # Decode without signature verification for development
            payload = jwt.decode(token, options={"verify_signature": False})
            logger.debug(f"JWT payload keys: {list(payload.keys())}")
            
            user_id = payload.get("sub")
            email = payload.get("email")
            
            if not user_id:
                logger.warning("No user ID found in JWT payload")
                return None
            
            # Return user data from JWT payload
            user_data = {
                "id": user_id,
                "email": email,
                "name": payload.get("name", payload.get("user_metadata", {}).get("name")),
                "created_at": payload.get("created_at"),
                "aud": payload.get("aud"),
                "role": payload.get("role")
            }
            
            logger.info(f"Successfully decoded JWT for user: {email}")
            return user_data
            
        except jwt.DecodeError as jwt_error:
            logger.warning(f"JWT decode failed: {jwt_error}")
        except Exception as fallback_error:
            logger.warning(f"JWT fallback failed: {fallback_error}")
        
        return None
        
    except Exception as e:
        logger.error(f"Authentication failed: {type(e).__name__}: {str(e)}")
        if credentials:
            logger.error(f"Failed token (first 50 chars): {credentials.credentials[:50]}...")
        return None

async def require_auth(
    current_user: Optional[dict] = Depends(get_current_user)
) -> dict:
    """Require authentication for protected endpoints."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

# =============================================================================
# ORGANIZATION CONTEXT DEPENDENCIES
# =============================================================================

async def get_current_organization(
    request: Request,
    current_user: dict = Depends(require_auth)
) -> Dict[str, Any]:
    """
    Get current organization context for the request.
    Sets organization context for RLS enforcement.
    """
    try:
        # Set organization context through middleware
        org_id = await organization_context_middleware(request, current_user["id"])
        
        # Return the organization data from context
        return get_current_org()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization context: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load organization context"
        )

async def get_org_from_path(
    org_id: str,
    current_user: dict = Depends(require_auth)
) -> Dict[str, Any]:
    """
    Get organization from path parameter.
    For routes like /api/v1/orgs/{org_id}/...
    """
    # Validate user has access to this organization
    if not await OrganizationContext.validate_org_access(current_user["id"], org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to organization"
        )
    
    # Set organization context
    await OrganizationContext.set_context(org_id)
    org_data = await OrganizationContext.load_org_details(org_id)
    
    if not org_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return org_data

# =============================================================================
# PERMISSION DEPENDENCIES
# =============================================================================

def require_permission_dep(permission: str, action: Optional[str] = None):
    """
    Create a dependency that requires a specific permission.
    
    Usage:
        @router.get("/documents")
        async def get_documents(
            _: None = Depends(require_permission_dep("documents", "view"))
        ):
            ...
    """
    async def check_perm(
        current_user: dict = Depends(require_auth),
        current_org: dict = Depends(get_current_organization)
    ):
        await require_permission(
            current_user["id"],
            current_org["id"],
            permission,
            action
        )
        return None
    
    return check_perm

def require_role_dep(roles: list):
    """
    Create a dependency that requires specific roles.
    
    Usage:
        @router.post("/admin")
        async def admin_endpoint(
            _: None = Depends(require_role_dep(["admin", "owner"]))
        ):
            ...
    """
    from app.utils.permissions import require_role
    
    async def check_role(
        current_user: dict = Depends(require_auth),
        current_org: dict = Depends(get_current_organization)
    ):
        await require_role(
            current_user["id"],
            current_org["id"],
            roles
        )
        return None
    
    return check_role

async def require_admin(
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization)
) -> dict:
    """Require admin role for protected admin endpoints."""
    from app.utils.permissions import is_admin
    
    if not await is_admin(current_user["id"], current_org["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user

# =============================================================================
# QUOTA AND LIMITS DEPENDENCIES
# =============================================================================

def require_quota_check(resource: str):
    """
    Create a dependency that checks quotas before allowing an operation.
    
    Usage:
        @router.post("/documents")
        async def upload_document(
            _: None = Depends(require_quota_check("documents"))
        ):
            ...
    """
    from app.utils.permissions import enforce_quota
    
    async def check_quota(
        current_org: dict = Depends(get_current_organization)
    ):
        # Get current usage for the resource
        current_usage = await get_current_usage(current_org["id"], resource)
        await enforce_quota(current_org["id"], resource, current_usage)
        return None
    
    return check_quota

async def get_current_usage(org_id: str, resource: str) -> int:
    """Get current usage count for a resource."""
    try:
        if resource == "documents":
            result = supabase_client.table("documents").select(
                "id", count="exact"
            ).eq("organization_id", org_id).execute()
            return result.count or 0
        
        elif resource == "users":
            result = supabase_client.table("organization_members").select(
                "id", count="exact"
            ).eq("organization_id", org_id).eq("status", "active").execute()
            return result.count or 0
        
        elif resource == "tokens":
            # Get current month usage
            from datetime import datetime
            month_ym = datetime.now().strftime("%Y%m")
            result = supabase_client.table("usage_monthly").select(
                "tokens_input, tokens_output"
            ).eq("org_id", org_id).eq("month_ym", month_ym).single().execute()
            
            if result.data:
                return (result.data.get("tokens_input", 0) + 
                       result.data.get("tokens_output", 0))
            return 0
        
        return 0
        
    except Exception as e:
        logger.error(f"Error getting current usage for {resource}: {e}")
        return 0

# =============================================================================
# USER CONTEXT DEPENDENCIES
# =============================================================================

async def get_user_context(
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get comprehensive user context including permissions and navigation.
    Useful for API endpoints that need full user context.
    """
    try:
        # Get user's organizations
        user_orgs = await get_user_organizations(current_user["id"])
        
        # Get navigation items for current org
        nav_items = await get_navigation_items(current_user["id"], current_org["id"])
        
        # Get user's permissions in current org
        from app.utils.permissions import get_user_permissions
        permissions = await get_user_permissions(current_user["id"], current_org["id"])
        
        return {
            "user": current_user,
            "organization": current_org,
            "organizations": user_orgs,
            "permissions": permissions,
            "navigation": nav_items
        }
        
    except Exception as e:
        logger.error(f"Error building user context: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load user context"
        )

# =============================================================================
# LEGACY COMPATIBILITY
# =============================================================================

def get_demo_org_id() -> str:
    """Get the hardcoded demo organization ID for backward compatibility."""
    return getattr(settings, 'demo_org_id', 'demo-org-12345')

async def get_demo_organization() -> dict:
    """Get demo organization for backward compatibility."""
    return {
        "id": get_demo_org_id(),
        "name": "Demo Organization",
        "slug": "demo-org",
        "tier": "starter",
        "status": "active"
    }

# =============================================================================
# SPECIALIZED DEPENDENCIES
# =============================================================================

async def get_org_settings(
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """Get organization settings for the current organization."""
    return await OrganizationContext.get_org_settings(current_org["id"])

async def verify_feature_access(feature: str):
    """
    Create a dependency that verifies feature access based on tier.
    
    Usage:
        @router.get("/analytics")
        async def get_analytics(
            _: None = Depends(verify_feature_access("advanced_analytics"))
        ):
            ...
    """
    from app.utils.permissions import check_feature_access
    
    async def check_feature(
        current_org: dict = Depends(get_current_organization)
    ):
        if not await check_feature_access(current_org["id"], feature):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Feature '{feature}' requires a higher plan tier"
            )
        return None
    
    return check_feature