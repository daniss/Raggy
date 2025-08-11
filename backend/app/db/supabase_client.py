from supabase import create_client, Client
from app.core.config import settings
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)


# Global Supabase client instance (lazy initialized)
_supabase_client = None


def get_supabase_client() -> Client:
    """Get the global Supabase client instance (lazy initialization)."""
    global _supabase_client
    
    if _supabase_client is None:
        try:
            _supabase_client = create_client(
                supabase_url=settings.supabase_url,
                supabase_key=settings.supabase_service_key
            )
            logger.info("Supabase client created successfully")
        except Exception as e:
            logger.error(f"Failed to create Supabase client: {e}")
            raise
    
    return _supabase_client


# For backward compatibility
def create_supabase_client() -> Client:
    """Create and configure Supabase client (deprecated - use get_supabase_client)."""
    return get_supabase_client()


# For backward compatibility with existing code
supabase_client = None


def _get_client():
    """Internal getter that always returns the current client."""
    global supabase_client
    if supabase_client is None:
        supabase_client = get_supabase_client()
    return supabase_client


async def log_chat_interaction(
    user_id: str,
    question: str,
    answer: str,
    sources: list,
    response_time: float,
    organization_id: Optional[str] = None
) -> None:
    """Log chat interaction to Supabase."""
    try:
        data = {
            "user_id": user_id,
            "question": question,
            "answer": answer,
            "sources": sources,
            "response_time": response_time,
            "organization_id": organization_id,
            "created_at": "now()"
        }
        
        result = _get_client().table("chat_logs").insert(data).execute()
        logger.info(f"Logged chat interaction for user {user_id}")
        
    except Exception as e:
        logger.error(f"Failed to log chat interaction: {e}")


async def log_anonymous_interaction(
    question: str,
    response_time: float,
    sources_count: int
) -> None:
    """Log anonymous chat interaction for analytics (bypasses RLS)."""
    try:
        # Log anonymous interactions to a simple metrics table or just log locally
        logger.info(f"ANONYMOUS_CHAT: question_length={len(question)}, response_time={response_time:.2f}s, sources={sources_count}")
        
        # For now, we'll use application logging since RLS prevents anonymous inserts
        # In production, consider a separate metrics collection system
        
    except Exception as e:
        logger.error(f"Failed to log anonymous interaction: {e}")


async def get_analytics_data(days: int = 30, organization_id: Optional[str] = None) -> Dict[str, Any]:
    """Get comprehensive analytics data from chat logs."""
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get chat logs for the period (organization-scoped)
        query = _get_client().table("chat_logs").select("*")
        query = query.gte("created_at", start_date.isoformat())
        query = query.lte("created_at", end_date.isoformat())
        if organization_id:
            query = query.eq("organization_id", organization_id)
        query = query.order("created_at", desc=True)
        
        result = query.execute()
        logs = result.data
        
        if not logs:
            return {
                "total_queries": 0,
                "unique_users": 0,
                "avg_response_time": 0,
                "success_rate": 0,
                "recent_queries": [],
                "popular_topics": [],
                "daily_stats": []
            }
        
        # Calculate metrics
        total_queries = len(logs)
        unique_users = len(set(log.get("user_id") for log in logs if log.get("user_id")))
        successful_queries = [log for log in logs if log.get("response_time") is not None]
        avg_response_time = sum(log["response_time"] for log in successful_queries) / len(successful_queries) if successful_queries else 0
        success_rate = (len(successful_queries) / total_queries * 100) if total_queries > 0 else 0
        
        # Get satisfaction ratings
        satisfaction_ratings = [log.get("satisfaction_rating") for log in logs if log.get("satisfaction_rating")]
        avg_satisfaction = sum(satisfaction_ratings) / len(satisfaction_ratings) if satisfaction_ratings else 0
        
        # Get recent document uploads for activity feed
        recent_docs = []
        try:
            docs_query = _get_client().table("documents").select(
                "filename, upload_date, status, uploaded_by"
            ).gte("upload_date", start_date.isoformat()).lte(
                "upload_date", end_date.isoformat()
            )
            if organization_id:
                docs_query = docs_query.eq("organization_id", organization_id)
            docs_query = docs_query.order("upload_date", desc=True).limit(5)
            
            docs_result = docs_query.execute()
            recent_docs = docs_result.data or []
        except Exception as e:
            logger.warning(f"Failed to fetch recent documents: {e}")

        return {
            "total_queries": total_queries,
            "unique_users": unique_users,
            "avg_response_time": round(avg_response_time, 2),
            "success_rate": round(success_rate, 1),
            "avg_satisfaction": round(avg_satisfaction, 1),
            "recent_queries": logs[:10],
            "recent_documents": recent_docs,
            "popular_topics": [],
            "daily_stats": []
        }
        
    except Exception as e:
        logger.error(f"Failed to get analytics data: {e}")
        return {
            "total_queries": 0,
            "unique_users": 0,
            "avg_response_time": 0,
            "success_rate": 0,
            "recent_queries": [],
            "recent_documents": [],
            "popular_topics": [],
            "daily_stats": []
        }


async def get_documents_list(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    organization_id: Optional[str] = None
) -> Dict[str, Any]:
    """Get paginated list of uploaded documents.""" 
    try:
        # Build query
        query = _get_client().table("documents").select(
            "id, filename, content_type, size_bytes, chunks_count, status, upload_date, error_message",
            count="exact"  # Get total count for pagination
        )
        
        # Apply filters
        if search:
            query = query.ilike("filename", f"%{search}%")
        if status:
            query = query.eq("status", status)
        if organization_id:
            query = query.eq("organization_id", organization_id)
            
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order("upload_date", desc=True).range(offset, offset + page_size - 1)
        
        # Execute query
        result = query.execute()
        
        # Calculate pagination metadata
        total_count = result.count if hasattr(result, 'count') else 0
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
        
        return {
            "documents": result.data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get documents list: {e}")
        return {
            "documents": [],
            "pagination": {
                "page": 1,
                "page_size": page_size,
                "total_count": 0,
                "total_pages": 0,
                "has_next": False,
                "has_prev": False
            }
        }


async def save_document_info(
    filename: str,
    content_type: str,
    size_bytes: int,
    file_path: str,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    content_hash: Optional[str] = None
) -> str:
    """Save document information to database with duplicate detection."""
    try:
        # Check for duplicate if content_hash is provided
        if content_hash and organization_id:
            existing = _get_client().table("documents").select("id, filename").eq(
                "organization_id", organization_id
            ).eq("content_hash", content_hash).execute()
            
            if existing.data:
                logger.info(f"Duplicate document detected: {filename} matches existing '{existing.data[0]['filename']}'")
                # Return existing document ID to indicate duplicate
                return existing.data[0]["id"]
        
        document_id = str(uuid.uuid4())
        
        data = {
            "id": document_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "file_path": file_path,
            "content_hash": content_hash,  # Store hash for future duplicate detection
            "status": "processing",
            "uploaded_by": user_id,
            "organization_id": organization_id
        }
        
        result = _get_client().table("documents").insert(data).execute()
        logger.info(f"Saved document info: {filename}")
        
        return document_id
        
    except Exception as e:
        logger.error(f"Failed to save document info: {e}")
        raise


async def update_document_status(
    document_id: str,
    status: str,
    chunks_count: Optional[int] = None,
    error_message: Optional[str] = None
) -> None:
    """Update document processing status."""
    try:
        update_data = {"status": status}
        
        if chunks_count is not None:
            update_data["chunks_count"] = chunks_count
        if error_message is not None:
            update_data["error_message"] = error_message
            
        result = _get_client().table("documents").update(update_data).eq("id", document_id).execute()
        logger.info(f"Updated document {document_id} status to {status}")
        
    except Exception as e:
        logger.error(f"Failed to update document status: {e}")


async def delete_document(document_id: str) -> None:
    """Delete document from database."""
    try:
        # Delete the document itself
        result = _get_client().table("documents").delete().eq("id", document_id).execute()
        logger.info(f"Deleted document {document_id}, affected rows: {len(result.data) if result.data else 0}")
        
        # Also delete associated document vectors from the vector table
        vector_result = _get_client().table("document_vectors").delete().eq("document_id", document_id).execute()
        logger.info(f"Deleted {len(vector_result.data) if vector_result.data else 0} vector entries for document {document_id}")
        
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise


async def get_system_settings() -> Dict[str, Any]:
    """Get all system settings."""
    try:
        result = _get_client().table("system_settings").select("*").execute()
        
        settings_dict = {}
        for setting in result.data:
            category = setting["category"]
            key = setting["key"]
            value = setting["value"]
            
            if category not in settings_dict:
                settings_dict[category] = {}
            settings_dict[category][key] = value
            
        return settings_dict
        
    except Exception as e:
        logger.error(f"Failed to get system settings: {e}")
        return {}


async def update_system_setting(category: str, key: str, value: Any) -> None:
    """Update a system setting."""
    try:
        data = {
            "category": category,
            "key": key,
            "value": value
        }
        
        result = _get_client().table("system_settings").upsert(data).execute()
        logger.info(f"Updated setting {category}.{key}")
        
    except Exception as e:
        logger.error(f"Failed to update system setting: {e}")
        raise