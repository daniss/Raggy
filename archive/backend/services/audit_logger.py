"""
Comprehensive audit logging service for tracking user actions and system events.
"""
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum
from app.db.supabase_client import supabase_client


class AuditAction(Enum):
    """Audit action types."""
    # Authentication
    LOGIN = "login"
    LOGOUT = "logout"
    AUTH_FAILED = "auth_failed"
    
    # Organization management
    ORG_CREATE = "org_create"
    ORG_UPDATE = "org_update"
    ORG_DELETE = "org_delete"
    
    # Member management  
    MEMBER_INVITE = "member_invite"
    MEMBER_JOIN = "member_join"
    MEMBER_REMOVE = "member_remove"
    MEMBER_ROLE_CHANGE = "member_role_change"
    MEMBER_STATUS_CHANGE = "member_status_change"
    
    # Document management
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_DELETE = "document_delete"
    DOCUMENT_VIEW = "document_view"
    
    # Chat/RAG operations
    CHAT_QUERY = "chat_query"
    KNOWLEDGE_BASE_RESET = "knowledge_base_reset"
    
    # Security events
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PERMISSION_DENIED = "permission_denied"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    
    # System events
    SYSTEM_ERROR = "system_error"
    DATA_EXPORT = "data_export"
    SETTINGS_CHANGE = "settings_change"


class AuditResourceType(Enum):
    """Types of resources being audited."""
    USER = "user"
    ORGANIZATION = "organization" 
    MEMBER = "member"
    DOCUMENT = "document"
    CHAT = "chat"
    SYSTEM = "system"


class AuditLogger:
    """Service for logging audit events to the database."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    async def log_event(
        self,
        action: AuditAction,
        resource_type: AuditResourceType,
        organization_id: Optional[str] = None,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Log an audit event to the database.
        
        Args:
            action: The action being performed
            resource_type: Type of resource affected
            organization_id: ID of the organization (if applicable)
            user_id: ID of the user performing the action
            resource_id: ID of the specific resource affected
            old_values: Previous values (for updates/deletes)
            new_values: New values (for creates/updates)
            ip_address: Client IP address
            user_agent: Client user agent
            additional_data: Additional context data
            
        Returns:
            bool: True if logged successfully, False otherwise
        """
        try:
            # Prepare audit log entry
            audit_data = {
                "organization_id": organization_id,
                "user_id": user_id,
                "action": action.value,
                "resource_type": resource_type.value,
                "resource_id": resource_id,
                "old_values": old_values or {},
                "new_values": new_values or {},
                "ip_address": ip_address,
                "user_agent": user_agent
            }
            
            # Add additional data to new_values if provided
            if additional_data:
                audit_data["new_values"].update({"additional_data": additional_data})
            
            # Insert into audit_logs table
            result = supabase_client.table("audit_logs").insert(audit_data).execute()
            
            if result.data:
                self.logger.info(f"Audit event logged: {action.value} by user {user_id} on {resource_type.value} {resource_id}")
                return True
            else:
                self.logger.error(f"Failed to log audit event: {action.value}")
                return False
                
        except Exception as e:
            self.logger.error(f"Audit logging failed: {e}")
            return False
    
    async def log_auth_event(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """Log authentication-related events."""
        additional_data = {
            "success": success,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if error_message:
            additional_data["error_message"] = error_message
            
        return await self.log_event(
            action=action,
            resource_type=AuditResourceType.USER,
            user_id=user_id,
            resource_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data=additional_data
        )
    
    async def log_organization_event(
        self,
        action: AuditAction,
        organization_id: str,
        user_id: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log organization management events."""
        return await self.log_event(
            action=action,
            resource_type=AuditResourceType.ORGANIZATION,
            organization_id=organization_id,
            user_id=user_id,
            resource_id=organization_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def log_member_event(
        self,
        action: AuditAction,
        organization_id: str,
        user_id: str,
        member_id: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log member management events."""
        return await self.log_event(
            action=action,
            resource_type=AuditResourceType.MEMBER,
            organization_id=organization_id,
            user_id=user_id,
            resource_id=member_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def log_document_event(
        self,
        action: AuditAction,
        organization_id: str,
        user_id: str,
        document_id: str,
        filename: Optional[str] = None,
        size_bytes: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log document management events."""
        additional_data = {}
        if filename:
            additional_data["filename"] = filename
        if size_bytes:
            additional_data["size_bytes"] = size_bytes
            
        return await self.log_event(
            action=action,
            resource_type=AuditResourceType.DOCUMENT,
            organization_id=organization_id,
            user_id=user_id,
            resource_id=document_id,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data=additional_data if additional_data else None
        )
    
    async def log_chat_event(
        self,
        organization_id: str,
        user_id: str,
        question: str,
        response_time: Optional[float] = None,
        sources_count: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log chat/RAG query events."""
        additional_data = {
            "question_length": len(question),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if response_time:
            additional_data["response_time"] = response_time
        if sources_count:
            additional_data["sources_count"] = sources_count
            
        return await self.log_event(
            action=AuditAction.CHAT_QUERY,
            resource_type=AuditResourceType.CHAT,
            organization_id=organization_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data=additional_data
        )
    
    async def log_security_event(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log security-related events."""
        additional_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "high" if action in [
                AuditAction.UNAUTHORIZED_ACCESS,
                AuditAction.SUSPICIOUS_ACTIVITY
            ] else "medium"
        }
        
        if details:
            additional_data["details"] = details
            
        return await self.log_event(
            action=action,
            resource_type=AuditResourceType.SYSTEM,
            organization_id=organization_id,
            user_id=user_id,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data=additional_data
        )
    
    async def get_audit_logs(
        self,
        organization_id: str,
        user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[AuditResourceType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Retrieve audit logs with filtering options.
        
        Returns:
            Dict containing logs and pagination info
        """
        try:
            query = supabase_client.table("audit_logs").select("*").eq("organization_id", organization_id)
            
            # Apply filters
            if user_id:
                query = query.eq("user_id", user_id)
            if action:
                query = query.eq("action", action.value)
            if resource_type:
                query = query.eq("resource_type", resource_type.value)
            if start_date:
                query = query.gte("created_at", start_date.isoformat())
            if end_date:
                query = query.lte("created_at", end_date.isoformat())
            
            # Apply pagination and ordering
            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
            
            result = query.execute()
            
            # Get total count for pagination
            count_query = supabase_client.table("audit_logs").select("id", count="exact").eq("organization_id", organization_id)
            if user_id:
                count_query = count_query.eq("user_id", user_id)
            if action:
                count_query = count_query.eq("action", action.value)
            if resource_type:
                count_query = count_query.eq("resource_type", resource_type.value)
            if start_date:
                count_query = count_query.gte("created_at", start_date.isoformat())
            if end_date:
                count_query = count_query.lte("created_at", end_date.isoformat())
                
            count_result = count_query.execute()
            
            return {
                "logs": result.data or [],
                "total_count": count_result.count or 0,
                "page_size": limit,
                "offset": offset,
                "has_more": (count_result.count or 0) > offset + limit
            }
            
        except Exception as e:
            self.logger.error(f"Failed to retrieve audit logs: {e}")
            return {
                "logs": [],
                "total_count": 0,
                "page_size": limit,
                "offset": offset,
                "has_more": False,
                "error": str(e)
            }


# Global audit logger instance
audit_logger = AuditLogger()