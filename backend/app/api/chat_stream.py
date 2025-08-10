"""Streaming chat endpoint for real-time responses."""

import uuid
import time
import json
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest
from app.core.deps import get_current_user, get_demo_org_id
from app.core.sentry_config import capture_exception, add_breadcrumb
from app.core.redis_cache import redis_cache
from app.rag.enhanced_retriever import enhanced_retriever
from app.rag.llm_providers import llm_provider
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


async def generate_stream_response(
    question: str,
    organization_id: Optional[str],
    conversation_id: str
) -> AsyncGenerator[str, None]:
    """Generate streaming response for chat."""
    
    start_time = time.time()
    
    try:
        # Send initial acknowledgment
        yield f"data: {json.dumps({'type': 'start', 'conversation_id': conversation_id})}\n\n"
        
        # Note: Chat response caching disabled for legal consulting to ensure fresh, contextual responses
        
        # Enhanced document retrieval with confidence scoring
        yield f"data: {json.dumps({'type': 'status', 'message': 'Recherche de documents avec scoring de confiance...'})}\n\n"
        
        docs_with_confidence = await enhanced_retriever.similarity_search_with_confidence(
            question, 
            k=5,  # Reduced for speed
            organization_id=organization_id,
            min_confidence=10.0  # Minimum 10% confidence
        )
        
        docs = [doc for doc, confidence in docs_with_confidence]
        
        if not docs:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Aucun document trouvé avec confiance suffisante'})}\n\n"
        else:
            avg_confidence = sum(conf for _, conf in docs_with_confidence) / len(docs_with_confidence) if docs_with_confidence else 0
            yield f"data: {json.dumps({'type': 'status', 'message': f'{len(docs)} documents trouvés (confiance moyenne: {avg_confidence:.1f}%)'})}\n\n"
        
        # Build prompt
        # Import optimized streaming prompt
        from app.rag.prompts import STREAMING_RAG_PROMPT
        system_prompt = STREAMING_RAG_PROMPT
        
        context = "\n\n".join([
            f"Document {i+1}: {doc.page_content[:500]}"
            for i, doc in enumerate(docs[:3])  # Only top 3 for speed
        ])
        
        user_prompt = f"Contexte:\n{context}\n\nQuestion: {question}\n\nRéponse:"
        
        # Stream LLM response using enhanced provider
        yield f"data: {json.dumps({'type': 'status', 'message': f'Génération de la réponse via {llm_provider.provider_name}...'})}\n\n"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # Use enhanced LLM provider with streaming
        full_answer = ""
        stream = await llm_provider.generate_response(
            messages=messages,
            stream=True,
            temperature=0.0,
            max_tokens=settings.max_tokens
        )
        
        async for content in stream:
            if content:
                full_answer += content
                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
        
        # Send enhanced sources with confidence scores
        sources = []
        for i, (doc, confidence) in enumerate(docs_with_confidence[:3]):
            source_data = {
                "content": doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content,
                "metadata": doc.metadata,
                "similarity": doc.metadata.get("similarity", 0.0),
                "confidence": confidence,
                "rank": i + 1,
                "extraction_method": doc.metadata.get("extraction_method", "unknown"),
                "filename": doc.metadata.get("filename", "unknown"),
                "chunk_info": {
                    "index": doc.metadata.get("chunk_index", 0),
                    "total": doc.metadata.get("total_chunks", 1),
                    "size": doc.metadata.get("chunk_size", len(doc.page_content))
                }
            }
            
            # Add page info if available
            if "page" in doc.metadata:
                source_data["page"] = doc.metadata["page"]
            
            sources.append(source_data)
        
        # Send sources with enhanced metadata
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'total_sources': len(sources), 'avg_confidence': avg_confidence if docs_with_confidence else 0})}\n\n"
        
        # Send provider information
        provider_info = {
            "llm_provider": llm_provider.provider_name,
            "llm_model": llm_provider.model_name,
            "embedding_provider": enhanced_retriever.embedding_provider.__class__.__name__,
            "embedding_model": enhanced_retriever.embedding_provider.model_name
        }
        yield f"data: {json.dumps({'type': 'provider_info', 'providers': provider_info})}\n\n"
        
        # Note: Chat response caching disabled - legal consulting requires fresh, contextual responses
        
        # Send completion
        response_time = time.time() - start_time
        yield f"data: {json.dumps({'type': 'complete', 'response_time': response_time})}\n\n"
        
        logger.info(f"Streaming response completed in {response_time:.2f}s")
        
    except Exception as e:
        logger.error(f"Streaming chat failed: {e}")
        capture_exception(e)
        yield f"data: {json.dumps({'type': 'error', 'message': 'Une erreur est survenue'})}\n\n"


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    http_request: Request,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Stream chat responses in real-time for faster perceived response times.
    
    Returns Server-Sent Events (SSE) stream with:
    - type: 'start' - Initial acknowledgment
    - type: 'status' - Status updates during processing  
    - type: 'token' - Individual tokens as they're generated
    - type: 'sources' - Document sources used
    - type: 'complete' - Final completion with timing
    - type: 'error' - Error messages
    """
    
    conversation_id = request.conversation_id or str(uuid.uuid4())
    demo_org_id = get_demo_org_id()
    
    add_breadcrumb(
        message="Processing streaming chat request",
        category="chat_stream",
        data={
            "conversation_id": conversation_id,
            "question_length": len(request.question),
            "user_id": current_user.get("id") if current_user else "anonymous"
        }
    )
    
    return StreamingResponse(
        generate_stream_response(
            request.question,
            demo_org_id,
            conversation_id
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )