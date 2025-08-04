"""
Organization-aware rate limiting with plan-based limits and Redis backend.
"""
import time
import json
import logging
from typing import Dict, Optional, Tuple
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.redis_cache import redis_cache
from app.services.audit_logger import audit_logger, AuditAction

logger = logging.getLogger(__name__)


class OrganizationRateLimiter:
    """Organization-aware rate limiter with Redis backend."""
    
    # Rate limits by plan (requests per minute)
    PLAN_LIMITS = {
        "free": {
            "requests_per_minute": 30,
            "uploads_per_hour": 5,
            "chat_requests_per_minute": 10,
            "document_size_mb": 5,
            "max_documents": 50
        },
        "pro": {
            "requests_per_minute": 300,
            "uploads_per_hour": 100,
            "chat_requests_per_minute": 100,
            "document_size_mb": 50,
            "max_documents": 1000
        },
        "enterprise": {
            "requests_per_minute": 1000,
            "uploads_per_hour": 500,
            "chat_requests_per_minute": 500,
            "document_size_mb": 200,
            "max_documents": 10000
        }
    }
    
    def __init__(self):
        self.redis = redis_cache
    
    def _get_rate_limit_key(self, organization_id: str, limit_type: str, window: str) -> str:
        """Generate Redis key for rate limiting."""
        timestamp = int(time.time())
        
        if window == "minute":
            timestamp = timestamp // 60 * 60
        elif window == "hour":
            timestamp = timestamp // 3600 * 3600
        
        return f"rate_limit:{organization_id}:{limit_type}:{timestamp}"
    
    def _get_fallback_key(self, ip_address: str, limit_type: str, window: str) -> str:
        """Generate fallback key for requests without organization context."""
        timestamp = int(time.time())
        
        if window == "minute":
            timestamp = timestamp // 60 * 60
        elif window == "hour":
            timestamp = timestamp // 3600 * 3600
        
        return f"rate_limit:ip:{ip_address}:{limit_type}:{timestamp}"
    
    async def is_allowed(
        self,
        organization_id: Optional[str],
        organization_plan: str,
        limit_type: str,
        ip_address: str,
        window: str = "minute"
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed under rate limit.
        
        Returns:
            Tuple of (is_allowed, limit_info)
        """
        try:
            # Get plan limits
            plan_limits = self.PLAN_LIMITS.get(organization_plan, self.PLAN_LIMITS["free"])
            
            # Determine the limit based on type and window
            if limit_type == "requests" and window == "minute":
                limit = plan_limits["requests_per_minute"]
            elif limit_type == "uploads" and window == "hour":
                limit = plan_limits["uploads_per_hour"]
            elif limit_type == "chat" and window == "minute":
                limit = plan_limits["chat_requests_per_minute"]
            else:
                # Default to general request limit
                limit = plan_limits["requests_per_minute"]
            
            # Use organization-specific key if available, otherwise fall back to IP
            if organization_id:
                key = self._get_rate_limit_key(organization_id, limit_type, window)
            else:
                key = self._get_fallback_key(ip_address, limit_type, window)
                # Use stricter limits for unauthenticated requests
                limit = min(limit, 10)  # Max 10 requests per minute for unauthenticated
            
            # Get current count from Redis
            try:
                current_count = await self.redis.get_int(key) or 0
            except:
                current_count = 0
            
            # Check if under limit
            if current_count >= limit:
                return False, {
                    "limit": limit,
                    "current": current_count,
                    "reset_time": self._get_reset_time(window),
                    "plan": organization_plan
                }
            
            # Increment counter with appropriate TTL
            ttl = 60 if window == "minute" else 3600  # 1 minute or 1 hour
            await self.redis.increment_with_ttl(key, ttl)
            
            return True, {
                "limit": limit,
                "current": current_count + 1,
                "reset_time": self._get_reset_time(window),
                "plan": organization_plan
            }
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # If Redis fails, allow the request but log the issue
            return True, {
                "limit": 0,
                "current": 0,
                "reset_time": int(time.time()) + 60,
                "plan": organization_plan,
                "error": "Rate limiting service unavailable"
            }
    
    def _get_reset_time(self, window: str) -> int:
        """Get the time when rate limit resets."""
        now = int(time.time())
        
        if window == "minute":
            return (now // 60 + 1) * 60
        elif window == "hour":
            return (now // 3600 + 1) * 3600
        
        return now + 60
    
    async def check_document_limits(
        self,
        organization_id: str,
        organization_plan: str,
        current_document_count: int,
        document_size_mb: float
    ) -> Tuple[bool, str]:
        """
        Check document-specific limits.
        
        Returns:
            Tuple of (is_allowed, error_message)
        """
        plan_limits = self.PLAN_LIMITS.get(organization_plan, self.PLAN_LIMITS["free"])
        
        # Check document count limit
        if current_document_count >= plan_limits["max_documents"]:
            return False, f"Document limit exceeded. Your {organization_plan} plan allows {plan_limits['max_documents']} documents maximum."
        
        # Check document size limit
        if document_size_mb > plan_limits["document_size_mb"]:
            return False, f"Document too large. Your {organization_plan} plan allows documents up to {plan_limits['document_size_mb']}MB."
        
        return True, ""
    
    async def get_organization_usage(
        self,
        organization_id: str,
        organization_plan: str
    ) -> Dict[str, any]:
        """
        Get current usage statistics for an organization.
        """
        try:
            current_minute = int(time.time()) // 60 * 60
            current_hour = int(time.time()) // 3600 * 3600
            
            # Get current usage
            requests_key = f"rate_limit:{organization_id}:requests:{current_minute}"
            uploads_key = f"rate_limit:{organization_id}:uploads:{current_hour}"
            chat_key = f"rate_limit:{organization_id}:chat:{current_minute}"
            
            requests_count = await self.redis.get_int(requests_key) or 0
            uploads_count = await self.redis.get_int(uploads_key) or 0
            chat_count = await self.redis.get_int(chat_key) or 0
            
            # Get plan limits
            plan_limits = self.PLAN_LIMITS.get(organization_plan, self.PLAN_LIMITS["free"])
            
            return {
                "plan": organization_plan,
                "current_usage": {
                    "requests_this_minute": requests_count,
                    "uploads_this_hour": uploads_count,
                    "chat_requests_this_minute": chat_count
                },
                "limits": plan_limits,
                "usage_percentage": {
                    "requests": round((requests_count / plan_limits["requests_per_minute"]) * 100, 1),
                    "uploads": round((uploads_count / plan_limits["uploads_per_hour"]) * 100, 1),
                    "chat": round((chat_count / plan_limits["chat_requests_per_minute"]) * 100, 1)
                },
                "reset_times": {
                    "requests": self._get_reset_time("minute"),
                    "uploads": self._get_reset_time("hour"),
                    "chat": self._get_reset_time("minute")
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get organization usage: {e}")
            return {
                "plan": organization_plan,
                "error": "Unable to retrieve usage statistics"
            }


# Global organization rate limiter instance
org_rate_limiter = OrganizationRateLimiter()


class OrganizationRateLimitMiddleware(BaseHTTPMiddleware):
    """Organization-aware rate limiting middleware."""
    
    def __init__(
        self,
        app,
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health", "/docs", "/openapi.json", "/", "/api/v1/organizations"
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Apply organization-aware rate limiting."""
        
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Determine rate limit type based on endpoint
        limit_type = self._get_limit_type(request.url.path, request.method)
        window = "hour" if limit_type == "uploads" else "minute"
        
        # Get organization context if available
        organization_id = None
        organization_plan = "free"  # Default plan
        
        try:
            # Try to extract organization from Authorization header
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                # This is a simplified approach - in production you'd want to verify the JWT
                # and extract organization info from it or from a session store
                # For now, we'll rely on the middleware being placed after authentication
                pass
        except:
            pass
        
        # Check rate limit
        is_allowed, limit_info = await org_rate_limiter.is_allowed(
            organization_id=organization_id,
            organization_plan=organization_plan,
            limit_type=limit_type,
            ip_address=client_ip,
            window=window
        )
        
        if not is_allowed:
            # Log rate limit exceeded event
            try:
                await audit_logger.log_security_event(
                    action=AuditAction.SUSPICIOUS_ACTIVITY,
                    organization_id=organization_id,
                    details=f"Rate limit exceeded: {limit_info['current']}/{limit_info['limit']} {limit_type} requests",
                    ip_address=client_ip,
                    user_agent=request.headers.get("user-agent", "")
                )
            except:
                pass  # Don't fail the request if audit logging fails
            
            logger.warning(
                f"Rate limit exceeded for {organization_id or client_ip}: "
                f"{limit_info['current']}/{limit_info['limit']} {limit_type} requests"
            )
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many {limit_type} requests. Plan: {limit_info['plan']}, Limit: {limit_info['limit']} per {window}",
                    "limit_info": limit_info
                },
                headers={
                    "X-RateLimit-Limit": str(limit_info["limit"]),
                    "X-RateLimit-Remaining": str(max(0, limit_info["limit"] - limit_info["current"])),
                    "X-RateLimit-Reset": str(limit_info["reset_time"]),
                    "X-RateLimit-Plan": limit_info["plan"],
                    "Retry-After": str(60 if window == "minute" else 3600)
                }
            )
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(limit_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit_info["limit"] - limit_info["current"]))
        response.headers["X-RateLimit-Reset"] = str(limit_info["reset_time"])
        response.headers["X-RateLimit-Plan"] = limit_info["plan"]
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address."""
        # Check for forwarded IP (from proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection IP
        return request.client.host if request.client else "unknown"
    
    def _get_limit_type(self, path: str, method: str) -> str:
        """Determine rate limit type based on endpoint."""
        if "/upload/" in path:
            return "uploads"
        elif "/chat/" in path:
            return "chat"
        else:
            return "requests"