import uuid
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from app.models.schemas import ChatRequest, ChatResponse, Source
from app.core.deps import get_current_user, get_current_organization
from app.core.sentry_config import capture_exception, add_breadcrumb, set_context
from app.services.audit_logger import audit_logger
from app.core.redis_cache import redis_cache
from app.rag import retriever
from app.rag.qa_fast import fast_qa_chain as qa_chain
from app.db.supabase_client import log_chat_interaction, log_anonymous_interaction
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def chat(
    http_request: Request,
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_current_user),
    current_org: Optional[dict] = Depends(get_current_organization)
):
    """
    Process a chat question and return an AI-generated response with sources.
    """
    start_time = time.time()
    conversation_id = request.conversation_id or str(uuid.uuid4())
    organization_id = current_org.get("id") if current_org else None
    
    try:
        logger.info(f"Processing chat request: {request.question[:100]}...")
        
        # Add breadcrumb for tracking
        add_breadcrumb(
            message="Processing chat request",
            category="chat",
            data={
                "conversation_id": conversation_id,
                "question_length": len(request.question),
                "user_id": current_user.get("id") if current_user else "anonymous"
            }
        )
        
        # Note: Chat response caching disabled for legal consulting to ensure fresh, contextual responses
        
        # Generate response using RAG pipeline (organization-scoped)
        organization_id = current_org["id"] if current_org else None
        result = await qa_chain.arun(request.question, organization_id=organization_id)
        
        # Prepare response
        sources = [
            Source(
                content=source["content"],
                metadata=source["metadata"],
                score=source.get("score", 0.0)
            )
            for source in result["sources"]
        ]
        
        response = ChatResponse(
            answer=result["answer"],
            sources=sources,
            conversation_id=conversation_id,
            response_time=result["response_time"]
        )
        
        # Track QA metrics in background
        background_tasks.add_task(
            track_qa_metrics,
            query=request.question,
            answer=result["answer"],
            sources=result["sources"]
        )
        
        # Log all interactions for analytics
        # Note: Anonymous users need special handling due to RLS policies
        if current_user and organization_id:
            # Authenticated users: log normally
            background_tasks.add_task(
                log_chat_interaction,
                user_id=current_user.get("id"),
                question=request.question,
                answer=result["answer"],
                sources=result["sources"],
                response_time=result["response_time"],
                organization_id=organization_id
            )
        else:
            # Anonymous users: log for metrics but bypass RLS
            background_tasks.add_task(
                log_anonymous_interaction,
                question=request.question,
                response_time=result["response_time"],
                sources_count=len(result["sources"])
            )
            
        # Log audit event for chat interaction (only for authenticated users)
        if current_user:
            client_ip, user_agent = get_request_info(http_request)
            background_tasks.add_task(
                audit_logger.log_chat_event,
                organization_id=organization_id,
                user_id=current_user.get("id"),
                question=request.question,
                response_time=result["response_time"],
                sources_count=len(result["sources"]),
                ip_address=client_ip,
                user_agent=user_agent
            )
        
        # Note: Chat response caching disabled - legal consulting requires fresh, contextual responses
        
        logger.info(f"Chat request completed in {result['response_time']:.2f}s")
        return response
        
    except Exception as e:
        response_time = time.time() - start_time
        logger.error(f"Chat request failed: {e}")
        
        # Capture exception to Sentry with context
        set_context("chat_request", {
            "question": request.question[:100],
            "conversation_id": conversation_id,
            "user_id": current_user.get("id") if current_user else "anonymous",
            "response_time": response_time
        })
        capture_exception(e)
        
        # Return error response
        return ChatResponse(
            answer="Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer.",
            sources=[],
            conversation_id=conversation_id,
            response_time=response_time
        )


@router.get("/health")
async def chat_health():
    """
    Check the health of chat-related services.
    """
    try:
        # Test Supabase vector store connection
        stats = retriever.get_collection_stats()
        
        # Test Groq API connection
        groq_status = qa_chain.test_connection()
        
        return {
            "status": "healthy" if groq_status else "degraded",
            "vector_store": {
                "status": "connected",
                "documents": stats.get("total_documents", 0)
            },
            "groq_api": {
                "status": "connected" if groq_status else "disconnected"
            },
            "embedding_model": {
                "status": "loaded",
                "dimension": stats.get("embedding_dimension", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


@router.get("/stats")
async def chat_stats(current_user: dict = Depends(get_current_user)):
    """
    Get collection statistics (authenticated endpoint).
    """
    try:
        stats = retriever.get_collection_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")