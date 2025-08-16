"""
FastAPI RAG Service - Main Application
=====================================
RAG-only service for document indexing and question answering with streaming.
Strictly separated from business logic (auth, teams, documents CRUD stay in Next.js).
"""

import os
import asyncio
import logging
import base64
from typing import AsyncGenerator, Dict, Any, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from security import SecurityManager
from providers import SupabaseProvider, EmbeddingProvider, LLMProvider

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for request/response
class IndexRequest(BaseModel):
    """Request model for document indexing"""
    org_id: str = Field(..., description="Organization ID")
    document_id: str = Field(..., description="Document ID to index")
    correlation_id: Optional[str] = Field(None, description="Request correlation ID")

class AskRequest(BaseModel):
    """Request model for RAG questions"""
    org_id: str = Field(..., description="Organization ID")
    message: str = Field(..., description="User question")
    options: Dict[str, Any] = Field(default_factory=dict, description="Query options")
    correlation_id: Optional[str] = Field(None, description="Request correlation ID")

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    providers: Dict[str, str]
    database: str

# Global providers - initialized at startup
security_manager: SecurityManager = None
supabase_provider: SupabaseProvider = None
embedding_provider: EmbeddingProvider = None
llm_provider: LLMProvider = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global security_manager, supabase_provider, embedding_provider, llm_provider
    
    try:
        # Initialize providers
        logger.info("Initializing RAG service providers...")
        
        security_manager = SecurityManager()
        supabase_provider = SupabaseProvider()
        embedding_provider = EmbeddingProvider()
        llm_provider = LLMProvider()
        
        # Test connections
        await supabase_provider.test_connection()
        await embedding_provider.test_connection()
        await llm_provider.test_connection()
        
        logger.info("RAG service initialized successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize RAG service: {e}")
        raise
    finally:
        # Cleanup if needed
        logger.info("RAG service shutting down")

# Initialize FastAPI app
app = FastAPI(
    title="RAG Service",
    description="Document indexing and question answering service with encryption",
    version="1.0.0",
    lifespan=lifespan
)

# Configuration CORS stricte - uniquement si ENABLE_CORS=true
if os.getenv('ENABLE_CORS', 'false').lower() == 'true':
    from fastapi.middleware.cors import CORSMiddleware
    
    allowed_origins = [
        os.getenv('NEXT_APP_URL', 'http://localhost:3000'),
        os.getenv('FRONTEND_URL', 'http://localhost:3000')
    ]
    
    # Filtrer les origins vides
    allowed_origins = [origin for origin in allowed_origins if origin]
    
    logger.info(f"CORS activé pour les origins: {allowed_origins}")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,  # Pas de cookies
        allow_methods=["POST"],   # Uniquement POST pour /rag/ask et /rag/index
        allow_headers=[
            "Content-Type", 
            "X-Request-ID",
            "Authorization"  # Pour futures authentifications
        ],
        max_age=3600  # Cache preflight 1h
    )
else:
    logger.info("CORS désactivé - seules les requêtes depuis le BFF Next.js sont autorisées")

@app.get("/rag/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db_status = await supabase_provider.test_connection()
        
        return HealthResponse(
            status="healthy",
            version="1.0.0",
            providers={
                "embedding": embedding_provider.get_provider_info(),
                "llm": llm_provider.get_provider_info(),
                "database": "supabase-connected"
            },
            database=db_status
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.post("/rag/index")
async def index_document(request: IndexRequest):
    """
    Index a document for RAG retrieval
    Asynchronous processing - returns immediately, indexing happens in background
    """
    try:
        logger.info(f"Starting indexing for document {request.document_id} (org: {request.org_id})")
        
        # Start indexing task in background
        asyncio.create_task(
            _process_document_indexing(
                request.org_id, 
                request.document_id,
                request.correlation_id or "no-correlation"
            )
        )
        
        return {
            "status": "accepted",
            "message": f"Document {request.document_id} queued for indexing",
            "org_id": request.org_id,
            "document_id": request.document_id
        }
        
    except Exception as e:
        logger.error(f"Indexing request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/ask")
async def ask_question(request: AskRequest):
    """
    Ask a question with RAG retrieval and streaming response
    Returns Server-Sent Events stream compatible with existing frontend
    """
    try:
        logger.info(f"Processing question for org {request.org_id}: {request.message[:50]}...")
        
        # Create streaming response
        return StreamingResponse(
            _stream_rag_response(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            }
        )
        
    except Exception as e:
        logger.error(f"Question processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def _process_document_indexing(org_id: str, document_id: str, correlation_id: str):
    """
    Background task for document indexing
    1. Fetch document from Supabase Storage
    2. Extract text and chunk it
    3. Generate embeddings
    4. Encrypt chunks and store with embeddings
    """
    try:
        logger.info(f"[{correlation_id}] Starting indexing pipeline for document {document_id}")
        
        # Step 1: Fetch document content
        document_content = await supabase_provider.fetch_document_content(org_id, document_id)
        if not document_content:
            logger.error(f"[{correlation_id}] Document content not found")
            return
        
        # Step 2: Extract text and create chunks
        chunks = await _extract_and_chunk_text(document_content, document_id)
        logger.info(f"[{correlation_id}] Created {len(chunks)} chunks")
        
        # Step 3: Generate embeddings for all chunks
        texts = [chunk['text'] for chunk in chunks]
        embeddings = await embedding_provider.embed_texts(texts)
        
        # Step 4: Encrypt and store chunks with embeddings
        await _encrypt_and_store_chunks(
            org_id, document_id, chunks, embeddings, correlation_id
        )
        
        # Step 5: Mark document as indexed
        await supabase_provider.mark_document_indexed(document_id)
        
        logger.info(f"[{correlation_id}] Document indexing completed successfully")
        
    except Exception as e:
        logger.error(f"[{correlation_id}] Indexing pipeline failed: {e}")
        await supabase_provider.mark_document_error(document_id, str(e))

async def _stream_rag_response(request: AskRequest) -> AsyncGenerator[str, None]:
    """
    Generate streaming RAG response
    1. Embed user question
    2. Retrieve relevant chunks
    3. Decrypt retrieved chunks
    4. Generate streaming LLM response with citations
    """
    correlation_id = request.correlation_id or "no-correlation"
    
    try:
        logger.info(f"[{correlation_id}] Starting RAG pipeline")
        
        # Step 1: Embed the user question
        question_embedding = await embedding_provider.embed_query(request.message)
        
        # Step 2: Retrieve top-K similar chunks
        k = request.options.get('k', 8)
        chunks = await supabase_provider.search_similar_chunks(
            request.org_id, question_embedding, k
        )
        
        if not chunks:
            # No relevant context found
            yield 'data: {"type": "token", "text": "Je ne trouve pas d\'informations pertinentes dans vos documents pour répondre à cette question."}\n\n'
            yield 'data: {"type": "done"}\n\n'
            return
        
        # Step 3: Decrypt retrieved chunks
        decrypted_chunks = await _decrypt_chunks(request.org_id, chunks, correlation_id)
        
        # Step 3.5: Enrich chunks with document metadata
        document_ids = list(set(chunk.get('document_id') for chunk in decrypted_chunks if chunk.get('document_id')))
        documents_metadata = await supabase_provider.get_documents_metadata(document_ids)
        
        # Add document metadata to chunks
        for chunk in decrypted_chunks:
            doc_id = chunk.get('document_id')
            if doc_id and doc_id in documents_metadata:
                doc_meta = documents_metadata[doc_id]
                chunk['document_title'] = doc_meta.get('title', doc_meta.get('filename', f"Document {doc_id[:8]}..."))
                chunk['document_filename'] = doc_meta.get('filename')
        
        # Step 4: Build context for LLM
        context = _build_context_from_chunks(decrypted_chunks)
        
        logger.info(f"[{correlation_id}] Built context from {len(decrypted_chunks)} chunks, context length: {len(context)}")
        if len(context) < 100:
            logger.warning(f"[{correlation_id}] Context seems short: '{context[:200]}'")
        
        # Step 5: Stream LLM response
        model = "fast" if request.options.get("fast_mode") else "quality"
        
        async for event in llm_provider.stream_chat_completion(
            user_message=request.message,
            context=context,
            model=model,
            correlation_id=correlation_id
        ):
            yield f"data: {event}\n\n"
        
        # Step 6: Send citations if enabled
        if request.options.get("citations", True):
            citations = _build_citations_from_chunks(decrypted_chunks)
            yield f'data: {{"type": "citations", "items": {citations}}}\n\n'
        
        # Step 7: Send usage information
        yield f'data: {{"type": "usage", "tokens_input": {len(request.message)}, "tokens_output": 500, "model": "{model}"}}\n\n'
        
        # Final done event
        yield 'data: {"type": "done"}\n\n'
        
    except Exception as e:
        logger.error(f"[{correlation_id}] RAG streaming failed: {e}")
        yield f'data: {{"type": "error", "message": "Une erreur est survenue lors du traitement de votre demande."}}\n\n'

async def _extract_and_chunk_text(document_content: bytes, document_id: str) -> list:
    """
    Extract text from document and create chunks
    Basic implementation - can be extended with specialized parsers
    """
    # Simple text extraction (extend this based on mime type)
    try:
        text = document_content.decode('utf-8')
    except UnicodeDecodeError:
        # Try with error handling
        text = document_content.decode('utf-8', errors='ignore')
    
    # Basic chunking with overlap (convert tokens to characters: 1 token ≈ 4 chars)
    chunk_size_tokens = int(os.getenv('CHUNK_SIZE', '800'))
    print(f"Using chunk size: {chunk_size_tokens} tokens")
    overlap_tokens = int(os.getenv('CHUNK_OVERLAP', '150'))
    
    # Convert tokens to characters (1 token ≈ 4 characters)
    chunk_size_chars = chunk_size_tokens * 4  # 800 tokens = 3200 chars
    overlap_chars = overlap_tokens * 4        # 150 tokens = 600 chars
    
    chunks = []
    
    # Chunk by characters, not words
    for i in range(0, len(text), chunk_size_chars - overlap_chars):
        chunk_text = text[i:i + chunk_size_chars]
        
        chunks.append({
            'text': chunk_text,
            'chunk_index': len(chunks),
            'section': 'main',  # Basic section detection
            'page': None
        })
        
        if i + chunk_size_chars >= len(text):
            break
    
    return chunks

async def _encrypt_and_store_chunks(
    org_id: str, 
    document_id: str, 
    chunks: list, 
    embeddings: list,
    correlation_id: str
):
    """Encrypt chunks and store with embeddings"""
    try:
        # Get or create DEK for organization
        dek = await security_manager.get_or_create_dek(org_id)
        
        # Prepare batch insert data
        chunk_records = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            # Encrypt chunk content
            encrypted_data = security_manager.encrypt_content(
                chunk['text'], 
                dek,
                aad=f"{org_id}|{document_id}|{i}"
            )
            
            chunk_records.append({
                'org_id': org_id,
                'document_id': document_id,
                'chunk_index': i,
                'embedding': embedding,
                'ciphertext': base64.b64encode(encrypted_data['ciphertext']).decode('utf-8'),
                'nonce': base64.b64encode(encrypted_data['nonce']).decode('utf-8'),
                'aad': encrypted_data['aad'],
                'plaintext_sha256': security_manager.hash_content(chunk['text']),
                'section': chunk.get('section'),
                'page': chunk.get('page')
            })
        
        # Batch insert to database
        await supabase_provider.insert_chunks_batch(chunk_records)
        
        logger.info(f"[{correlation_id}] Successfully stored {len(chunk_records)} encrypted chunks")
        
    except Exception as e:
        logger.error(f"[{correlation_id}] Failed to encrypt and store chunks: {e}")
        raise

async def _decrypt_chunks(org_id: str, encrypted_chunks: list, correlation_id: str) -> list:
    """Decrypt retrieved chunks for LLM context"""
    try:
        # Get DEK for organization
        dek = await security_manager.get_dek(org_id)
        
        decrypted_chunks = []
        for chunk in encrypted_chunks:
            try:
                # Handle both hex and base64 formats for backward compatibility
                ciphertext_bytes = chunk['ciphertext']
                nonce_bytes = chunk['nonce']
                
                # Check if data is in hex format (from PostgreSQL bytea)
                if isinstance(ciphertext_bytes, str) and ciphertext_bytes.startswith('\\x'):
                    # Convert hex to bytes, then decode as base64
                    hex_ciphertext = ciphertext_bytes[2:]  # Remove \x prefix
                    hex_nonce = nonce_bytes[2:]  # Remove \x prefix
                    
                    # Convert hex to bytes (this gives us the base64 string as bytes)
                    base64_ciphertext_bytes = bytes.fromhex(hex_ciphertext)
                    base64_nonce_bytes = bytes.fromhex(hex_nonce)
                    
                    # Decode the base64 string to get the actual encrypted bytes
                    ciphertext_bytes = base64.b64decode(base64_ciphertext_bytes.decode('utf-8'))
                    nonce_bytes = base64.b64decode(base64_nonce_bytes.decode('utf-8'))
                    
                elif isinstance(ciphertext_bytes, str):
                    # Direct base64 format
                    ciphertext_bytes = base64.b64decode(ciphertext_bytes)
                    nonce_bytes = base64.b64decode(nonce_bytes)
                # If already bytes, use as-is
                
                decrypted_text = security_manager.decrypt_content(
                    ciphertext=ciphertext_bytes,
                    nonce=nonce_bytes,
                    aad=chunk['aad'],
                    dek=dek
                )
                
                decrypted_chunks.append({
                    **chunk,
                    'decrypted_text': decrypted_text
                })
            except Exception as e:
                logger.warning(f"[{correlation_id}] Failed to decrypt chunk {chunk.get('id')}: {e}")
                continue
        
        return decrypted_chunks
        
    except Exception as e:
        logger.error(f"[{correlation_id}] Chunk decryption failed: {e}")
        raise

def _build_context_from_chunks(decrypted_chunks: list) -> str:
    """Build context string from decrypted chunks for LLM"""
    context_parts = []
    
    for i, chunk in enumerate(decrypted_chunks[:5]):  # Limit to top 5 chunks
        doc_id = chunk.get('document_id', 'unknown')
        chunk_idx = chunk.get('chunk_index', i)
        text = chunk.get('decrypted_text', '')
        
        context_parts.append(f"[doc:{doc_id[:8]} chunk:{chunk_idx}]\n{text}\n")
    
    return "\n".join(context_parts)

def _build_citations_from_chunks(decrypted_chunks: list) -> str:
    """Build citations array from chunks"""
    import json
    
    citations = []
    
    for chunk in decrypted_chunks:
        citations.append({
            'document_id': chunk.get('document_id'),
            'chunk_index': chunk.get('chunk_index'),
            'score': round(chunk.get('similarity', 0), 3),
            'section': chunk.get('section'),
            'page': chunk.get('page'),  # This will be None, but json.dumps will convert to null
            'document_title': chunk.get('document_title', f"Document {chunk.get('document_id', '')[:8]}..."),
            'document_filename': chunk.get('document_filename')
        })
    
    # Use json.dumps to ensure proper JSON formatting (None -> null)
    return json.dumps(citations)

if __name__ == "__main__":
    port = int(os.getenv("RAG_SERVICE_PORT", "8000"))
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port, 
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )