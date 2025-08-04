"""Rate limiting middleware and utilities."""

import time
from typing import Dict, Optional
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """Simple in-memory rate limiter for development/small deployments."""
    
    def __init__(self):
        self.requests: Dict[str, list] = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """Check if request is allowed under rate limit."""
        now = time.time()
        
        # Clean old requests
        if key in self.requests:
            self.requests[key] = [
                req_time for req_time in self.requests[key] 
                if now - req_time < window
            ]
        else:
            self.requests[key] = []
        
        # Check if under limit
        if len(self.requests[key]) >= limit:
            return False
        
        # Add current request
        self.requests[key].append(now)
        return True
    
    def get_reset_time(self, key: str, window: int) -> Optional[int]:
        """Get the time when rate limit resets."""
        if key not in self.requests or not self.requests[key]:
            return None
        
        oldest_request = min(self.requests[key])
        return int(oldest_request + window)


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    def __init__(
        self,
        app,
        calls: int = 100,  # Number of calls
        period: int = 60,  # Time period in seconds
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Get client identifier
        client_ip = self.get_client_ip(request)
        
        # Check rate limit
        if not rate_limiter.is_allowed(client_ip, self.calls, self.period):
            reset_time = rate_limiter.get_reset_time(client_ip, self.period)
            
            logger.warning(f"Rate limit exceeded for {client_ip}")
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Limit: {self.calls} requests per {self.period} seconds",
                    "reset_time": reset_time
                },
                headers={
                    "X-RateLimit-Limit": str(self.calls),
                    "X-RateLimit-Period": str(self.period),
                    "X-RateLimit-Reset": str(reset_time) if reset_time else "0",
                    "Retry-After": str(self.period)
                }
            )
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(self.calls)
        response.headers["X-RateLimit-Period"] = str(self.period)
        
        return response
    
    def get_client_ip(self, request: Request) -> str:
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


def create_rate_limit_middleware(
    calls_per_minute: int = 100,
    exclude_paths: Optional[list] = None
) -> RateLimitMiddleware:
    """Factory function to create rate limit middleware."""
    return RateLimitMiddleware(
        app=None,  # Will be set by FastAPI
        calls=calls_per_minute,
        period=60,  # 1 minute
        exclude_paths=exclude_paths
    )