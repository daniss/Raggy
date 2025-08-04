"""
Middleware for capturing request information for audit logging.
"""
import logging
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.services.audit_logger import audit_logger, AuditAction


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware to capture request information for audit logging."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and capture audit information."""
        
        # Capture request information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        path = request.url.path
        method = request.method
        
        # Store in request state for use in endpoints
        request.state.client_ip = client_ip
        request.state.user_agent = user_agent
        
        try:
            response = await call_next(request)
            
            # Log certain types of requests automatically
            await self._log_automatic_events(request, response, client_ip, user_agent)
            
            return response
            
        except Exception as e:
            # Log system errors
            self.logger.error(f"Request failed: {method} {path} - {str(e)}")
            
            # Try to log error to audit log if possible
            try:
                await audit_logger.log_security_event(
                    action=AuditAction.SYSTEM_ERROR,
                    details=f"{method} {path}: {str(e)}",
                    ip_address=client_ip,
                    user_agent=user_agent
                )
            except:
                pass  # Don't fail the request if audit logging fails
            
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request headers."""
        # Check for forwarded headers first (for reverse proxies)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Take the first IP in the chain
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        if request.client:
            return request.client.host
        
        return "unknown"
    
    async def _log_automatic_events(
        self, 
        request: Request, 
        response: Response, 
        client_ip: str, 
        user_agent: str
    ):
        """Log certain events automatically based on request patterns."""
        
        path = request.url.path
        method = request.method
        status_code = response.status_code
        
        # Log authentication failures (401/403 responses)
        if status_code in [401, 403]:
            try:
                user_id = None
                if hasattr(request.state, "user") and request.state.user:
                    user_id = request.state.user.get("id")
                
                action = AuditAction.AUTH_FAILED if status_code == 401 else AuditAction.PERMISSION_DENIED
                
                await audit_logger.log_security_event(
                    action=action,
                    user_id=user_id,
                    details=f"{method} {path} returned {status_code}",
                    ip_address=client_ip,
                    user_agent=user_agent
                )
            except Exception as e:
                self.logger.warning(f"Failed to log security event: {e}")
        
        # Log suspicious activity patterns
        if self._is_suspicious_request(request, status_code):
            try:
                await audit_logger.log_security_event(
                    action=AuditAction.SUSPICIOUS_ACTIVITY,
                    details=f"Suspicious request: {method} {path} from {client_ip}",
                    ip_address=client_ip,
                    user_agent=user_agent
                )
            except Exception as e:
                self.logger.warning(f"Failed to log suspicious activity: {e}")
    
    def _is_suspicious_request(self, request: Request, status_code: int) -> bool:
        """Detect potentially suspicious request patterns."""
        
        path = request.url.path.lower()
        method = request.method
        
        # Check for common attack patterns
        suspicious_patterns = [
            # Directory traversal attempts
            "../", "..\\", "%2e%2e",
            # SQL injection attempts  
            "union select", "drop table", "exec(", "script>",
            # XSS attempts
            "<script", "javascript:", "onerror=",
            # Common exploit paths
            "/admin", "/wp-admin", "/phpmyadmin", "/.env", "/config"
        ]
        
        # Check for suspicious patterns in path
        for pattern in suspicious_patterns:
            if pattern in path:
                return True
        
        # Check for suspicious user agents
        user_agent = request.headers.get("user-agent", "").lower()
        suspicious_agents = [
            "sqlmap", "nikto", "nmap", "masscan", "zap", "burp"
        ]
        
        for agent in suspicious_agents:
            if agent in user_agent:
                return True
        
        # Multiple 404s might indicate scanning
        if status_code == 404 and method == "GET":
            # This would require rate limiting logic to detect patterns
            # For now, just log paths that don't exist in our API
            api_paths = ["/api/", "/docs", "/redoc", "/openapi.json"]
            if not any(api_path in path for api_path in api_paths):
                return True
        
        return False


def get_request_info(request: Request) -> tuple[str, str]:
    """Helper function to get client IP and user agent from request."""
    client_ip = getattr(request.state, "client_ip", "unknown")
    user_agent = getattr(request.state, "user_agent", "")
    return client_ip, user_agent