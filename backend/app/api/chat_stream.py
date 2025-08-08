"""Streaming chat endpoint for real-time responses."""

import uuid
import time
import json
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest
from app.core.deps import get_current_user, get_current_organization
from app.core.sentry_config import capture_exception, add_breadcrumb
from app.core.redis_cache import redis_cache
from app.rag.fast_retriever import fast_retriever
from groq import Groq
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
        
        # Retrieve documents quickly
        yield f"data: {json.dumps({'type': 'status', 'message': 'Recherche de documents...'})}\n\n"
        
        docs = fast_retriever.similarity_search(
            question, 
            k=5,  # Reduced for speed
            organization_id=organization_id
        )
        
        if not docs:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Aucun document trouvé'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'status', 'message': f'{len(docs)} documents trouvés'})}\n\n"
        
        # Build prompt
        # Import optimized streaming prompt
        from app.rag.prompts import STREAMING_RAG_PROMPT
        system_prompt = STREAMING_RAG_PROMPT
        
        context = "\n\n".join([
            f"Document {i+1}: {doc.page_content[:500]}"
            for i, doc in enumerate(docs[:3])  # Only top 3 for speed
        ])
        
        user_prompt = f"Contexte:\n{context}\n\nQuestion: {question}\n\nRéponse:"
        
        # Stream LLM response
        yield f"data: {json.dumps({'type': 'status', 'message': 'Génération de la réponse...'})}\n\n"
        
        client = Groq(api_key=settings.groq_api_key)
        
        stream = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0,
            max_tokens=settings.max_tokens,
            stream=True
        )
        
        full_answer = ""
        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_answer += content
                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
        
        # Send sources
        sources = [
            {
                "content": doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content,
                "metadata": doc.metadata,
                "score": doc.metadata.get("similarity", 0.0)
            }
            for doc in docs[:3]
        ]
        
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        
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
    current_user: Optional[dict] = Depends(get_current_user),
    current_org: Optional[dict] = Depends(get_current_organization)
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
    organization_id = current_org.get("id") if current_org else None
    
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
            organization_id,
            conversation_id
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )