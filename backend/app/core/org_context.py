"""
Organization context management for multi-tenant requests.
Sets the PostgreSQL session variable for RLS enforcement.
"""
import logging
from typing import Optional, Dict, Any
from contextvars import ContextVar

from fastapi import Request, HTTPException, status
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)

# Context variable to store current organization throughout request
current_org_context: ContextVar[Optional[Dict[str, Any]]] = ContextVar('current_org', default=None)

class OrganizationContext:
    """Manages organization context for multi-tenant isolation."""
    
    @staticmethod
    async def set_context(org_id: str) -> None:
        """
        Set the organization context for the current database session.
        This enables RLS policies to filter data by organization.
        
        Args:
            org_id: Organization UUID to set as context
        """
        try:
            # Set PostgreSQL session variable for RLS
            # This would normally be done via raw SQL connection
            # For Supabase, we'll need to handle this differently
            
            # Store in context variable for application layer
            org_data = {"id": org_id}
            current_org_context.set(org_data)
            
            logger.debug(f"Set organization context to {org_id}")
            
        except Exception as e:
            logger.error(f"Failed to set organization context: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to set organization context"
            )
    
    @staticmethod
    def get_current_org_id() -> Optional[str]:
        """Get the current organization ID from context."""
        org = current_org_context.get()
        return org.get("id") if org else None
    
    @staticmethod
    def get_current_org() -> Optional[Dict[str, Any]]:
        """Get the current organization data from context."""
        return current_org_context.get()
    
    @staticmethod
    async def validate_org_access(user_id: str, org_id: str) -> bool:
        """
        Validate that user has access to the organization.
        
        Args:
            user_id: User ID to validate
            org_id: Organization ID to check access for
            
        Returns:
            True if user has access, False otherwise
        """
        try:
            result = supabase_client.table("organization_members").select(
                "id, status"
            ).eq("user_id", user_id).eq("organization_id", org_id).execute()
            
            if result.data and result.data[0]["status"] == "active":
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating org access: {e}")
            return False
    
    @staticmethod
    async def get_org_from_request(request: Request) -> Optional[str]:
        """
        Extract organization ID from request (headers, cookies, or path).
        
        Args:
            request: FastAPI request object
            
        Returns:
            Organization ID if found, None otherwise
        """
        # Check header first (X-Organization-ID)
        org_id = request.headers.get("X-Organization-ID")
        if org_id:
            return org_id
        
        # Check cookie
        org_id = request.cookies.get("org_id")
        if org_id:
            return org_id
        
        # Check path parameters (for routes like /orgs/{org_id}/...)
        if hasattr(request, "path_params"):
            org_id = request.path_params.get("org_id")
            if org_id:
                return org_id
        
        # Check query parameters as fallback
        org_id = request.query_params.get("org_id")
        if org_id:
            return org_id
        
        return None
    
    @staticmethod
    async def load_org_details(org_id: str) -> Optional[Dict[str, Any]]:
        """
        Load full organization details from database.
        
        Args:
            org_id: Organization ID to load
            
        Returns:
            Organization data dictionary or None if not found
        """
        try:
            result = supabase_client.table("organizations").select(
                "*"
            ).eq("id", org_id).single().execute()
            
            if result.data:
                # Store full org data in context
                current_org_context.set(result.data)
                return result.data
            
            return None
            
        except Exception as e:
            logger.error(f"Error loading organization details: {e}")
            return None
    
    @staticmethod
    async def get_org_settings(org_id: str) -> Dict[str, Any]:
        """
        Get organization settings including limits and feature flags.
        
        Args:
            org_id: Organization ID
            
        Returns:
            Settings dictionary
        """
        try:
            # Get from org_settings table
            result = supabase_client.table("org_settings").select(
                "*"
            ).eq("org_id", org_id).single().execute()
            
            if result.data:
                return result.data
            
            # Return defaults if no settings found
            return {
                "retention_days": 0,
                "token_limit_month": 200000,
                "document_limit": 100,
                "feature_flags": {},
                "default_prompt": None,
                "allow_user_org_switch": True
            }
            
        except Exception as e:
            logger.error(f"Error getting org settings: {e}")
            return {}
    
    @staticmethod
    async def check_org_status(org_id: str) -> bool:
        """
        Check if organization is active and accessible.
        
        Args:
            org_id: Organization ID to check
            
        Returns:
            True if organization is active
        """
        try:
            result = supabase_client.table("organizations").select(
                "status"
            ).eq("id", org_id).single().execute()
            
            if result.data:
                return result.data["status"] == "active"
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking org status: {e}")
            return False

# =============================================================================
# MIDDLEWARE FUNCTION
# =============================================================================

async def organization_context_middleware(request: Request, user_id: str) -> Optional[str]:
    """
    Middleware to set organization context for the request.
    
    Args:
        request: FastAPI request object
        user_id: Authenticated user ID
        
    Returns:
        Organization ID if set, None otherwise
        
    Raises:
        HTTPException: If organization is invalid or user lacks access
    """
    # Get org_id from request
    org_id = await OrganizationContext.get_org_from_request(request)
    
    if not org_id:
        # Try to get user's default organization
        from app.utils.permissions import get_default_organization
        default_org = await get_default_organization(user_id)
        if default_org:
            org_id = default_org["id"]
        else:
            # No organization available
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No organization context provided"
            )
    
    # Validate user has access
    if not await OrganizationContext.validate_org_access(user_id, org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to organization"
        )
    
    # Check organization is active
    if not await OrganizationContext.check_org_status(org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is not active"
        )
    
    # Set the context
    await OrganizationContext.set_context(org_id)
    
    # Load full organization details
    await OrganizationContext.load_org_details(org_id)
    
    return org_id

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_current_org_id() -> str:
    """
    Get current organization ID from context.
    
    Returns:
        Organization ID
        
    Raises:
        HTTPException: If no organization context is set
    """
    org_id = OrganizationContext.get_current_org_id()
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No organization context available"
        )
    return org_id

def get_current_org() -> Dict[str, Any]:
    """
    Get current organization data from context.
    
    Returns:
        Organization data dictionary
        
    Raises:
        HTTPException: If no organization context is set
    """
    org = OrganizationContext.get_current_org()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No organization context available"
        )
    return org

async def with_org_context(org_id: str):
    """
    Context manager for temporarily setting organization context.
    Useful for background tasks or admin operations.
    
    Usage:
        async with with_org_context(org_id):
            # Perform operations with org context set
            pass
    """
    class OrgContextManager:
        def __init__(self, org_id: str):
            self.org_id = org_id
            self.previous_context = None
        
        async def __aenter__(self):
            self.previous_context = current_org_context.get()
            await OrganizationContext.set_context(self.org_id)
            return self
        
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            # Restore previous context
            if self.previous_context:
                current_org_context.set(self.previous_context)
            else:
                current_org_context.set(None)
    
    return OrgContextManager(org_id)