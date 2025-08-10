import uuid
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from app.models.schemas import ChatRequest, ChatResponse, Source
from app.core.deps import get_current_user, get_demo_org_id
from app.core.sentry_config import capture_exception, add_breadcrumb, set_context
from app.core.audit_middleware import get_request_info
from app.services.audit_logger import audit_logger
from app.core.redis_cache import redis_cache
from app.rag.enhanced_retriever import enhanced_retriever
from app.rag.llm_providers import llm_provider
from app.api.metrics import track_qa_metrics
from app.db.supabase_client import log_chat_interaction, log_anonymous_interaction
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def chat(
    http_request: Request,
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Process a chat question and return an AI-generated response with sources.
    """
    start_time = time.time()
    conversation_id = request.conversation_id or str(uuid.uuid4())
    demo_org_id = get_demo_org_id()
    
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
        
        # Generate response using enhanced RAG pipeline (organization-scoped)
        demo_org_id = get_demo_org_id()
        
        # Get documents with confidence scoring
        docs_with_confidence = await enhanced_retriever.similarity_search_with_confidence(
            request.question,
            k=settings.retrieval_k,
            organization_id=demo_org_id,
            min_confidence=10.0
        )
        
        if not docs_with_confidence:
            result = {
                "answer": "Désolé, je n'ai trouvé aucun document pertinent pour répondre à votre question.",
                "sources": [],
                "response_time": time.time() - start_time
            }
        else:
            # Build context from retrieved documents
            from app.rag.prompts import ENTERPRISE_RAG_SYSTEM_PROMPT
            system_prompt = ENTERPRISE_RAG_SYSTEM_PROMPT
            
            context_parts = []
            for i, (doc, confidence) in enumerate(docs_with_confidence[:5], 1):
                source_info = ""
                if "filename" in doc.metadata:
                    source_info = f" (Source: {doc.metadata['filename']}"
                    if "page" in doc.metadata:
                        source_info += f", page {doc.metadata['page']}"
                    source_info += f", confiance: {confidence:.1f}%)"
                
                content = doc.page_content[:1500] if len(doc.page_content) > 1500 else doc.page_content
                context_parts.append(f"Document {i}{source_info}:\n{content}\n")
            
            context = "\n".join(context_parts)
            user_prompt = f"""Contexte documentaire:
{context}

Question de l'utilisateur: {request.question}

Réponse:"""
            
            # Generate response using enhanced LLM provider
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            answer = await llm_provider.generate_response(
                messages=messages,
                stream=False,
                temperature=settings.llm_temperature,
                max_tokens=settings.max_tokens
            )
            
            result = {
                "answer": answer,
                "sources": [
                    {
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                        "score": doc.metadata.get("similarity", 0.0),
                        "confidence": confidence
                    }
                    for doc, confidence in docs_with_confidence
                ],
                "response_time": time.time() - start_time
            }
        
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
        
        # Log all interactions for analytics (simplified for demo)
        if current_user:
            # Authenticated users: log normally with demo org
            background_tasks.add_task(
                log_chat_interaction,
                user_id=current_user.get("id"),
                question=request.question,
                answer=result["answer"],
                sources=result["sources"],
                response_time=result["response_time"],
                organization_id=demo_org_id
            )
        else:
            # Anonymous users: log for metrics but bypass RLS
            background_tasks.add_task(
                log_anonymous_interaction,
                question=request.question,
                response_time=result["response_time"],
                sources_count=len(result["sources"])
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
        # Test enhanced vector store connection
        stats = enhanced_retriever.get_collection_stats()
        
        # Test LLM provider connection
        llm_status = llm_provider.test_connection()
        
        return {
            "status": "healthy" if llm_status else "degraded",
            "vector_store": {
                "status": "connected",
                "documents": stats.get("total_documents", 0),
                "vectors": stats.get("total_vectors", 0)
            },
            "llm_provider": {
                "status": "connected" if llm_status else "disconnected",
                "provider": llm_provider.provider_name,
                "model": llm_provider.model_name
            },
            "embedding_provider": {
                "status": "loaded",
                "provider": enhanced_retriever.embedding_provider.__class__.__name__,
                "model": enhanced_retriever.embedding_provider.model_name,
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
        stats = enhanced_retriever.get_collection_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")