"""Lightweight request info utilities used for audit logging.

Provides a helper to extract client IP and user-agent from a FastAPI Request.
"""
from typing import Tuple
from fastapi import Request


def get_request_info(request: Request) -> Tuple[str, str]:
    """Return (ip, user_agent) for the incoming request.

    Prefers X-Forwarded-For when present (behind proxies/load balancers).
    """
    # Try common proxy header first
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        ip = xff.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"

    user_agent = request.headers.get("user-agent", "unknown")
    return ip, user_agent
