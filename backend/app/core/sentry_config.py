"""Enhanced Sentry configuration for error tracking."""

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
import logging

# Optional SQLAlchemy integration
try:
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_sentry():
    """Initialize Sentry with enhanced configuration."""
    if not settings.sentry_dsn:
        logger.info("Sentry DSN not configured, skipping initialization")
        return
    
    try:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            
            # Integrations
            integrations=[
                FastApiIntegration(
                    transaction_style="endpoint",
                    failed_request_status_codes=[500, 503],
                    auto_enabling=True,
                ),
                LoggingIntegration(
                    level=logging.INFO,  # Capture info and above as breadcrumbs
                    event_level=logging.ERROR  # Send errors as events
                ),
            ] + ([SqlalchemyIntegration()] if SQLALCHEMY_AVAILABLE else []),
            
            # Performance monitoring
            traces_sample_rate=0.1 if settings.environment == "production" else 1.0,
            profiles_sample_rate=0.1 if settings.environment == "production" else 1.0,
            
            # Release tracking
            release=settings.api_version,
            
            # Additional options
            attach_stacktrace=True,
            send_default_pii=False,  # Don't send personally identifiable information
            
            # Before send hook for data scrubbing
            before_send=before_send_filter,
            
            # Custom tags
            tags={
                "api_version": settings.api_version,
                "environment": settings.environment,
            },
        )
        
        logger.info(f"Sentry initialized for environment: {settings.environment}")
        
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")


def before_send_filter(event, hint):
    """Filter sensitive data before sending to Sentry."""
    # Remove sensitive headers
    if "request" in event and "headers" in event["request"]:
        sensitive_headers = ["authorization", "x-api-key", "cookie", "x-supabase-auth"]
        for header in sensitive_headers:
            if header in event["request"]["headers"]:
                event["request"]["headers"][header] = "[FILTERED]"
    
    # Remove sensitive query parameters
    if "request" in event and "query_string" in event["request"]:
        # Add logic to filter sensitive query params if needed
        pass
    
    # Remove sensitive data from extra context
    if "extra" in event:
        sensitive_keys = ["password", "token", "secret", "api_key"]
        for key in list(event["extra"].keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                event["extra"][key] = "[FILTERED]"
    
    return event


def capture_message(message: str, level: str = "info", **kwargs):
    """Capture a message to Sentry with additional context."""
    if settings.sentry_dsn:
        sentry_sdk.capture_message(message, level=level, **kwargs)


def capture_exception(error: Exception, **kwargs):
    """Capture an exception to Sentry with additional context."""
    if settings.sentry_dsn:
        sentry_sdk.capture_exception(error, **kwargs)


def add_breadcrumb(message: str, category: str = "custom", level: str = "info", data: dict = None):
    """Add a breadcrumb for better error context."""
    if settings.sentry_dsn:
        sentry_sdk.add_breadcrumb(
            message=message,
            category=category,
            level=level,
            data=data or {}
        )


def set_user_context(user_id: str, email: str = None, username: str = None):
    """Set user context for error tracking."""
    if settings.sentry_dsn:
        sentry_sdk.set_user({
            "id": user_id,
            "email": email,
            "username": username
        })


def set_tag(key: str, value: str):
    """Set a custom tag for categorizing errors."""
    if settings.sentry_dsn:
        sentry_sdk.set_tag(key, value)


def set_context(key: str, value: dict):
    """Set custom context for errors."""
    if settings.sentry_dsn:
        sentry_sdk.set_context(key, value)