"""
Enhanced dependency injection utilities for multi-tenant FastAPI application.
Handles authentication, organization context, and permission checking.
"""
import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime

from app.core.config import settings
from app.db.supabase_client import supabase_client
from app.utils.permissions import get_user_membership, verify_organization_access

logger = logging.getLogger(__name__)
security = HTTPBearer()

# =============================================================================
# AUTHENTICATION DEPENDENCIES
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current authenticated user from JWT token."""
    try:
        # Decode JWT token
        token = credentials.credentials
        
        try:
            # Verify with Supabase JWT
            payload = jwt.decode(
                token, 
                settings.supabase_jwt_secret or "your-jwt-secret", 
                algorithms=["HS256"],
                options={"verify_exp": True}
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Get user ID from token
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Get user from database
        user_result = supabase_client.table("users").select(
            "id, email, name, created_at"
        ).eq("id", user_id).single().execute()
        
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return user_result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, None otherwise."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

# =============================================================================
# ORGANIZATION CONTEXT DEPENDENCIES
# =============================================================================

async def get_current_organization(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-ID")
) -> Dict[str, Any]:
    """Get current organization context."""
    try:
        organization_id = None
        
        # 1. Check explicit header
        if x_organization_id:
            organization_id = x_organization_id
        
        # 2. Check URL path parameter (if present)
        if not organization_id and hasattr(request, 'path_params'):
            organization_id = request.path_params.get('organization_id')
        
        # 3. Check query parameter
        if not organization_id:
            organization_id = request.query_params.get('organization_id')
        
        # 4. Fall back to user's default organization
        if not organization_id:
            from app.utils.permissions import get_default_organization
            default_org = await get_default_organization(current_user["id"])
            if default_org:
                organization_id = default_org["id"]
        
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization context required. Please specify organization ID."
            )
        
        # Verify user has access to organization
        has_access = await verify_organization_access(current_user["id"], organization_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to organization"
            )
        
        # Get organization details
        org_result = supabase_client.table("organizations").select(
            "*"
        ).eq("id", organization_id).single().execute()
        
        if not org_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        organization = org_result.data
        
        # Check organization status
        if organization["status"] not in ["active", "trial"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Organization is {organization['status']}"
            )
        
        return organization
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization context: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to determine organization context"
        )

async def get_optional_organization(
    request: Request,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-ID")
) -> Optional[Dict[str, Any]]:
    """Get organization context if user is authenticated."""
    if not current_user:
        return None
    
    try:
        return await get_current_organization(request, current_user, x_organization_id)
    except HTTPException:
        return None

# =============================================================================
# PERMISSION DEPENDENCIES
# =============================================================================

def require_permission(category: str, action: str):
    """Dependency factory that requires specific permission."""
    async def permission_dependency(
        current_user: Dict[str, Any] = Depends(get_current_user),
        current_org: Dict[str, Any] = Depends(get_current_organization)
    ):
        from app.utils.permissions import require_permission as check_required_permission
        await check_required_permission(current_user["id"], current_org["id"], category, action)
        return {"user": current_user, "organization": current_org}
    
    return permission_dependency

def require_role(required_role: str):
    """Dependency factory that requires specific role."""
    async def role_dependency(
        current_user: Dict[str, Any] = Depends(get_current_user),
        current_org: Dict[str, Any] = Depends(get_current_organization)
    ):
        from app.utils.permissions import require_role as check_required_role
        from app.models.enterprise_schemas import MemberRole
        await check_required_role(current_user["id"], current_org["id"], MemberRole(required_role))
        return {"user": current_user, "organization": current_org}
    
    return role_dependency

# =============================================================================
# RESOURCE ACCESS DEPENDENCIES
# =============================================================================

async def get_accessible_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    current_org: Dict[str, Any] = Depends(get_current_organization)
) -> Dict[str, Any]:
    """Get document if user has access."""
    try:
        # Check if document exists and belongs to organization
        doc_result = supabase_client.table("documents").select(
            "*"
        ).eq("id", document_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not doc_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check document access permission
        from app.utils.permissions import check_document_access
        has_access = await check_document_access(current_user["id"], document_id, "read")
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to document"
            )
        
        return doc_result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accessible document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to access document"
        )

async def get_accessible_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    current_org: Dict[str, Any] = Depends(get_current_organization)
) -> Dict[str, Any]:
    """Get conversation if user has access."""
    try:
        # Check if conversation exists and belongs to organization
        conv_result = supabase_client.table("chat_conversations").select(
            "*"
        ).eq("id", conversation_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not conv_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        # Check conversation access permission
        from app.utils.permissions import check_conversation_access
        has_access = await check_conversation_access(current_user["id"], conversation_id, "read")
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to conversation"
            )
        
        return conv_result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accessible conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to access conversation"
        )

# =============================================================================
# QUOTA AND LIMIT DEPENDENCIES
# =============================================================================

async def check_quota_limits(
    resource_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    current_org: Dict[str, Any] = Depends(get_current_organization)
):
    """Check if organization has quota available for resource."""
    try:
        # Get current usage and limits
        settings = current_org.get("settings", {})
        
        quota_checks = {
            "documents": {
                "table": "documents",
                "limit_key": "maxDocuments",
                "default_limit": 100
            },
            "users": {
                "table": "organization_members",
                "limit_key": "maxUsers", 
                "default_limit": 5,
                "extra_filter": ("status", "active")
            }
        }
        
        if resource_type not in quota_checks:
            return  # No quota check needed for this resource
        
        check_config = quota_checks[resource_type]
        
        # Get current usage
        query = supabase_client.table(check_config["table"]).select(
            "id", count="exact"
        ).eq("organization_id", current_org["id"])
        
        if "extra_filter" in check_config:
            filter_column, filter_value = check_config["extra_filter"]
            query = query.eq(filter_column, filter_value)
        
        usage_result = query.execute()
        current_usage = usage_result.count or 0
        
        # Get limit
        limit = settings.get(check_config["limit_key"], check_config["default_limit"])
        
        # Check if quota exceeded
        if current_usage >= limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{resource_type.title()} quota exceeded. Current: {current_usage}, Limit: {limit}"
            )
        
        return {
            "current": current_usage,
            "limit": limit,
            "remaining": limit - current_usage,
            "percentage": (current_usage / limit * 100) if limit > 0 else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking quota limits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check quota limits"
        )

# =============================================================================
# AUDIT AND LOGGING DEPENDENCIES
# =============================================================================

async def get_request_context(
    request: Request,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """Get request context for audit logging."""
    return {
        "user_id": current_user["id"] if current_user else None,
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "method": request.method,
        "url": str(request.url),
        "timestamp": datetime.utcnow()
    }

# =============================================================================
# DEMO MODE DEPENDENCIES (for backward compatibility)
# =============================================================================

async def get_demo_organization() -> Dict[str, Any]:
    """Get demo organization for demo mode endpoints."""
    try:
        # Get or create demo organization
        demo_org_result = supabase_client.table("organizations").select(
            "*"
        ).eq("slug", "demo-org-12345").single().execute()
        
        if demo_org_result.data:
            return demo_org_result.data
        
        # Create demo organization if it doesn't exist
        demo_org_data = {
            "name": "Demo Organization",
            "slug": "demo-org-12345",
            "description": "Demo organization for prospects",
            "plan": "starter",
            "status": "trial",
            "settings": {
                "dataResidency": "eu",
                "hdsCompliant": False,
                "maxDocuments": 100,
                "maxUsers": 1,
                "maxTokensPerMonth": 10000,
                "maxStorageMB": 500
            }
        }
        
        create_result = supabase_client.table("organizations").insert(
            demo_org_data
        ).execute()
        
        if create_result.data:
            return create_result.data[0]
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create demo organization"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting demo organization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo mode unavailable"
        )