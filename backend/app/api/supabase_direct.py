"""
Direct Supabase queries for dashboard real data.
These endpoints provide real data from the database tables.
"""
from fastapi import APIRouter, HTTPException, Depends
from app.core.deps import get_current_user, get_current_organization, require_auth
from app.db.supabase_client import get_supabase_client
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/supabase", tags=["supabase-direct"])


@router.get("/overview")
async def get_dashboard_overview(
    current_user: dict = Depends(require_auth)
):
    """Get dashboard overview with real data from Supabase tables."""
    try:
        # Get user's organization from organization_members table
        supabase = get_supabase_client()
        membership_result = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", current_user["id"]).eq("status", "active").limit(1).execute()
        
        organization_id = None
        if membership_result.data:
            organization_id = membership_result.data[0]["organization_id"]
        
        # Get token usage from chat_logs
        token_query = supabase.table("chat_logs").select("response_time, created_at")
        if organization_id:
            token_query = token_query.eq("organization_id", organization_id)
        
        # Get data from last 30 days
        month_ago = datetime.now() - timedelta(days=30)
        token_data = token_query.gte("created_at", month_ago.isoformat()).execute()
        
        # Calculate approximate tokens (rough estimate based on response times and message count)
        total_messages = len(token_data.data)
        estimated_tokens = total_messages * 150  # Rough estimate: 150 tokens per message
        
        # Get latency data
        latency_values = [row.get("response_time", 0) for row in token_data.data if row.get("response_time")]
        avg_latency = sum(latency_values) / len(latency_values) if latency_values else 0
        p95_latency = sorted(latency_values)[int(len(latency_values) * 0.95)] if latency_values else 0
        
        # Get satisfaction from feedback (if available)
        # For now, we'll use a placeholder since feedback might not be implemented
        satisfaction = 4.2  # Placeholder
        
        return {
            "kpi_tokens_month": {
                "value": estimated_tokens,
                "trend": 15,  # Placeholder positive trend
                "label": f"{total_messages} conversations ce mois"
            },
            "kpi_latency": {
                "p50": avg_latency,
                "p95": p95_latency,
                "trend": -5  # Placeholder improvement
            },
            "kpi_satisfaction": {
                "value": satisfaction,
                "trend": 8,
                "count": total_messages
            },
            "recent_activity": []  # Will be populated from documents and conversations
        }
        
    except Exception as e:
        logger.error(f"Failed to get dashboard overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard data")


@router.get("/documents")
async def get_documents_real(
    current_user: dict = Depends(require_auth)
):
    """Get real documents from documents table."""
    try:
        # Get user's organization from organization_members table
        supabase = get_supabase_client()
        membership_result = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", current_user["id"]).eq("status", "active").limit(1).execute()
        
        organization_id = None
        if membership_result.data:
            organization_id = membership_result.data[0]["organization_id"]
        
        query = supabase.table("documents").select(
            "id, filename, size_bytes, status, upload_date, chunks_count"
        )
        
        if organization_id:
            query = query.eq("organization_id", organization_id)
        
        result = query.order("upload_date", desc=True).limit(100).execute()
        
        documents = []
        for doc in result.data:
            # Convert size_bytes from bytes to MB
            size_mb = (doc.get("size_bytes", 0) or 0) / (1024 * 1024)
            
            # Map database status to frontend expected values
            db_status = doc.get("status", "unknown")
            frontend_status = "ready" if db_status == "completed" else db_status
            
            documents.append({
                "id": doc["id"],
                "filename": doc["filename"],
                "size_mb": round(size_mb, 2),
                "status": frontend_status,
                "embedding_version": "v1.0",  # Placeholder
                "chunks": doc.get("chunks_count", 0) or 0,
                "duplicates": 0,  # Placeholder
                "updated_at": doc["upload_date"]
            })
        
        return documents
        
    except Exception as e:
        logger.error(f"Failed to get documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to load documents")


@router.get("/conversations")
async def get_conversations_real(
    current_user: dict = Depends(require_auth)
):
    """Get real conversations from chat_conversations table."""
    try:
        # Get user's organization from organization_members table
        supabase = get_supabase_client()
        membership_result = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", current_user["id"]).eq("status", "active").limit(1).execute()
        
        organization_id = None
        if membership_result.data:
            organization_id = membership_result.data[0]["organization_id"]
        
        # Get conversations with message count
        query = supabase.table("chat_conversations").select(
            "id, created_at, updated_at"
        )
        
        if organization_id:
            query = query.eq("organization_id", organization_id)
            
        conversations_result = query.order("updated_at", desc=True).limit(50).execute()
        
        conversations = []
        for conv in conversations_result.data:
            # Get message count for this conversation
            messages_query = supabase.table("chat_messages").select(
                "id", count="exact"
            ).eq("conversation_id", conv["id"])
            
            messages_result = messages_query.execute()
            message_count = messages_result.count or 0
            
            # Get average response time from chat_logs
            logs_query = supabase.table("chat_logs").select("response_time").eq(
                "conversation_id", conv["id"]
            )
            logs_result = logs_query.execute()
            
            response_times = [log.get("response_time", 0) for log in logs_result.data if log.get("response_time")]
            avg_latency = sum(response_times) / len(response_times) if response_times else 0
            
            conversations.append({
                "conversation_id": conv["id"],
                "messages": message_count,
                "avg_latency": round(avg_latency, 2),
                "csat": None,  # Placeholder for customer satisfaction
                "updated_at": conv["updated_at"]
            })
        
        return conversations
        
    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to load conversations")


@router.get("/stats")
async def get_stats_real(
    current_user: Optional[dict] = Depends(get_current_user),
    current_org: Optional[dict] = Depends(get_current_organization)
):
    """Get real statistics from database."""
    try:
        organization_id = current_org.get("id") if current_org and isinstance(current_org, dict) else None
        
        # Document stats
        supabase = get_supabase_client()
        doc_query = supabase.table("documents").select("id, size_bytes", count="exact")
        if organization_id:
            doc_query = doc_query.eq("organization_id", organization_id)
        
        doc_result = doc_query.execute()
        total_docs = doc_result.count or 0
        total_size = sum(doc.get("size_bytes", 0) or 0 for doc in doc_result.data)
        
        # Vector stats (approximate)
        vector_query = supabase.table("document_vectors").select("id", count="exact")
        if organization_id:
            vector_query = vector_query.eq("organization_id", organization_id)
            
        vector_result = vector_query.execute()
        total_vectors = vector_result.count or 0
        
        # Conversation stats
        conv_query = supabase.table("chat_conversations").select("id", count="exact")
        if organization_id:
            conv_query = conv_query.eq("organization_id", organization_id)
            
        conv_result = conv_query.execute()
        total_conversations = conv_result.count or 0
        
        return {
            "total_docs": total_docs,
            "total_vectors": total_vectors,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "total_conversations": total_conversations,
            "duplicate_rate": 0.0  # Placeholder
        }
        
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to load statistics")