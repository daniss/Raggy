import uuid
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from app.models.schemas import ChatRequest, ChatResponse, Source
from app.core.deps import get_current_user, get_current_organization
from app.core.sentry_config import capture_exception, add_breadcrumb, set_context
from app.core.audit_middleware import get_request_info
from app.services.audit_logger import audit_logger
from app.core.redis_cache import redis_cache
from app.rag import qa_chain, retriever
from app.db.supabase_client import log_chat_interaction
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
        
        # Check cache first with organization context
        cache_key = f"{request.question}:{organization_id}" if organization_id else request.question
        cached_response = redis_cache.get_chat_response(cache_key)
        if cached_response:
            logger.info(f"Cache hit for question: {request.question[:50]}...")
            add_breadcrumb(
                message="Cache hit",
                category="cache",
                data={"question": request.question[:50]}
            )
            
            # Update response time and conversation ID
            cached_response["conversation_id"] = conversation_id
            cached_response["response_time"] = time.time() - start_time
            cached_response["from_cache"] = True
            
            return ChatResponse(**cached_response)
        
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
        
        # Log interaction asynchronously if user is authenticated
        if current_user:
            background_tasks.add_task(
                log_chat_interaction,
                user_id=current_user.get("id", "anonymous"),
                question=request.question,
                answer=result["answer"],
                sources=result["sources"],
                response_time=result["response_time"],
                organization_id=organization_id
            )
            
            # Log audit event for chat interaction
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
        
        # Cache the response for future requests with organization context
        cache_data = response.model_dump()
        cache_data.pop("from_cache", None)  # Remove cache flag
        redis_cache.set_chat_response(
            question=cache_key,
            response=cache_data,
            expire_minutes=30  # Cache for 30 minutes
        )
        
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