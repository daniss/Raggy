from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.core.config import settings
from app.db.supabase_client import supabase_client


security = HTTPBearer(auto_error=False)


def get_supabase() -> Client:
    """Get Supabase client instance."""
    return supabase_client


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    supabase: Client = Depends(get_supabase)
) -> Optional[dict]:
    """Get current authenticated user from JWT token."""
    if not credentials:
        return None
    
    try:
        # Verify JWT token with Supabase
        user_response = supabase.auth.get_user(credentials.credentials)
        if user_response.user:
            return user_response.user.model_dump()
        return None
    except Exception as e:
        # Log security-relevant authentication failures
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Authentication failed: {type(e).__name__}")
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


def get_demo_org_id() -> str:
    """Get the hardcoded demo organization ID."""
    return getattr(settings, 'demo_org_id', 'demo-org-12345')


async def get_current_organization(
    current_user: Optional[dict] = Depends(get_current_user)
) -> str:
    """Get current organization ID. For demo mode, always return demo org."""
    # In demo/MVP mode, always return the demo organization
    return get_demo_org_id()


async def require_admin(
    current_user: dict = Depends(require_auth)
) -> dict:
    """Require admin role for protected admin endpoints."""
    # In demo mode, all authenticated users are considered admins
    return current_user