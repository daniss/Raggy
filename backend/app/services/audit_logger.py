"""
Audit logging service for tracking user actions and system events.
"""
import json
import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel


logger = logging.getLogger(__name__)


class AuditAction(Enum):
    """Audit action types."""
    UPLOAD_DOCUMENT = "upload_document"
    DELETE_DOCUMENT = "delete_document"
    CHAT_QUERY = "chat_query"
    DEMO_ACCESS = "demo_access"
    PURGE_DATA = "purge_data"
    USER_LOGIN = "user_login"
    SYSTEM_ERROR = "system_error"


class AuditEvent(BaseModel):
    """Audit event data model."""
    timestamp: datetime
    action: AuditAction
    user_id: Optional[str]
    organization_id: Optional[str]
    details: Dict[str, Any]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogger:
    """Audit logging service."""
    
    def __init__(self):
        self.logger = logging.getLogger("audit")
        # Set up structured logging for audit events
        self.logger.setLevel(logging.INFO)
    
    async def log_event(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """Log an audit event."""
        event = AuditEvent(
            timestamp=datetime.utcnow(),
            action=action,
            user_id=user_id,
            organization_id=organization_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Log as structured JSON
        audit_data = {
            "timestamp": event.timestamp.isoformat(),
            "action": event.action.value,
            "user_id": event.user_id,
            "organization_id": event.organization_id,
            "details": event.details,
            "ip_address": event.ip_address,
            "user_agent": event.user_agent
        }
        
        self.logger.info(f"AUDIT: {json.dumps(audit_data)}")
    
    async def log_document_event(
        self,
        action: AuditAction,
        filename: str,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        file_size: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """Log a document-related audit event."""
        details = {
            "filename": filename,
            "file_size": file_size
        }
        
        await self.log_event(
            action=action,
            user_id=user_id,
            organization_id=organization_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def log_chat_event(
        self,
        question: str,
        response_time: float,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        sources_count: int = 0,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """Log a chat interaction audit event."""
        details = {
            "question_length": len(question),
            "question_preview": question[:100] if len(question) > 100 else question,
            "response_time": response_time,
            "conversation_id": conversation_id,
            "sources_count": sources_count
        }
        
        await self.log_event(
            action=AuditAction.CHAT_QUERY,
            user_id=user_id,
            organization_id=organization_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )


# Global audit logger instance
audit_logger = AuditLogger()