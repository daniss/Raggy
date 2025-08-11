"""Demo registration and management API endpoints."""

import uuid
import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator
from app.db.supabase_client import get_supabase_client, save_document_info, update_document_status
from app.core.sentry_config import capture_exception, add_breadcrumb
from app.services.audit_logger import audit_logger
from app.core.validation import validate_file_type, validate_file_size, validate_filename, sanitize_filename
from app.core.file_constants import ALLOWED_FILE_TYPES
from app.rag.loader import document_loader
from app.rag.splitter import document_splitter
from app.rag.supabase_retriever import supabase_retriever
from langchain.schema import Document  # For retrieval compression
# RAG imports would be here for full version
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoRegistrationRequest(BaseModel):
    email: str
    company_name: str
    source: Optional[str] = "landing"
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    
    @validator('company_name')
    def validate_company_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Company name must be at least 2 characters')
        return v.strip()
    
    @validator('email')
    def validate_email_domain(cls, v):
        # Basic business email validation (exclude common personal domains)
        personal_domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com']
        domain = v.split('@')[1].lower() if '@' in v else ''
        
        # Allow personal domains for demo purposes, but log for analytics
        if domain in personal_domains:
            logger.info(f"Personal email domain used for demo: {domain}")
        
        return v


class DemoRegistrationResponse(BaseModel):
    success: bool
    session_token: str
    expires_at: datetime
    message: str
    demo_documents: list
    sample_questions: list


class DemoActivityRequest(BaseModel):
    session_token: str
    interaction_type: str = "page_view"
    interaction_data: Optional[Dict[str, Any]] = {}


class DemoConversionRequest(BaseModel):
    session_token: str
    conversion_type: str = "quote_request"
    additional_data: Optional[Dict[str, Any]] = {}


class DemoChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    
    @validator('question')
    def validate_question(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Question must be at least 3 characters')
        return v.strip()


async def get_demo_documents():
    """Get list of demo documents available from database."""
    try:
        # Get shared demo base organization ID (where pre-loaded demo documents are stored)
        demo_base_org_id = get_shared_demo_organization_id()
        
        # Query documents from the demo base organization
        supabase = get_supabase_client()
        result = supabase.table("documents").select(
            "filename,content_type,size_bytes,status,upload_date"
        ).eq("organization_id", demo_base_org_id).eq("status", "completed").order("upload_date", desc=False).execute()
        
        if not result.data:
            logger.warning("No demo documents found in database, returning empty list")
            return []
        
        # Convert database documents to demo format
        demo_docs = []
        for doc in result.data:
            # Determine document type based on filename or content type
            filename = doc["filename"]
            doc_type = "Document"
            description = f"Document {filename}"
            
            # Map specific demo documents to types and descriptions
            if "RGPD" in filename or "rgpd" in filename.lower():
                doc_type = "Juridique"
                description = "Guide complet de conformité RGPD pour entreprises"
            elif "RH" in filename or "rh" in filename.lower() or "Procedures" in filename:
                doc_type = "RH"
                description = "Manuel des procédures ressources humaines"
            elif "Contrat" in filename or "contrat" in filename.lower():
                doc_type = "Commercial"
                description = "Modèle de contrat client standard"
            elif "Fiscal" in filename or "fiscal" in filename.lower() or "Analyse" in filename:
                doc_type = "Finance"
                description = "Analyse fiscale et optimisation"
            elif "Technique" in filename or "technique" in filename.lower() or "Documentation" in filename:
                doc_type = "Technique"
                description = "Documentation technique complète produit"
            
            # Format file size
            size_bytes = doc.get("size_bytes", 0)
            if size_bytes > 1024 * 1024:
                size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
            elif size_bytes > 1024:
                size_str = f"{size_bytes / 1024:.0f} KB"
            else:
                size_str = f"{size_bytes} B"
            
            demo_docs.append({
                "name": filename,
                "size": size_str,
                "type": doc_type,
                "description": description
            })
        
        logger.info(f"Retrieved {len(demo_docs)} demo documents from database")
        return demo_docs
        
    except Exception as e:
        logger.error(f"Failed to get demo documents from database: {e}")
        # Fallback to empty list if database query fails
        return []


async def get_sample_questions():
    """Get list of sample questions for demo."""
    return [
        "Quelles sont les obligations RGPD pour le traitement des données clients ?",
        "Quelle est la procédure de recrutement d'un nouveau collaborateur ?", 
        "Quels sont les délais de paiement dans nos contrats types ?",
        "Comment calculer le crédit d'impôt recherche ?",
        "Quelles sont les spécifications techniques de notre produit principal ?"
    ]

def get_demo_organization_id(session_token: str) -> str:
    """Return unique demo organization ID for each demo session."""
    # Generate unique organization ID for this demo user based on session token
    import hashlib
    import uuid
    
    # Create a deterministic UUID from session token
    token_hash = hashlib.sha256(session_token.encode()).hexdigest()
    # Use first 32 characters and format as UUID
    uuid_str = f"{token_hash[:8]}-{token_hash[8:12]}-{token_hash[12:16]}-{token_hash[16:20]}-{token_hash[20:32]}"
    return uuid_str

def get_shared_demo_organization_id() -> str:
    """Return the shared demo organization ID where base documents are stored."""
    # Shared organization with the 5 pre-loaded demo documents
    return "00000000-0000-4000-8000-000000000001"

async def ensure_demo_organization_exists(organization_id: str, company_name: str = "Demo User") -> bool:
    """Ensure the demo organization exists in the organizations table."""
    try:
        supabase = get_supabase_client()
        
        # Check if organization already exists
        result = supabase.table("organizations").select("id").eq("id", organization_id).execute()
        
        if result.data:
            # Organization already exists
            return True
        
        # Create the demo organization with required fields
        import re
        slug = re.sub(r'[^a-z0-9-]', '', f"demo-{company_name}".lower().replace(' ', '-'))
        org_data = {
            "id": organization_id,
            "name": f"Demo - {company_name}",
            "slug": slug,
            "plan": "demo"
        }
        
        create_result = supabase.table("organizations").insert(org_data).execute()
        
        if create_result.data:
            logger.info(f"Created demo organization: {organization_id}")
            return True
        else:
            logger.error(f"Failed to create demo organization: {organization_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error ensuring demo organization exists: {e}")
        return False


def filter_thinking_tags(text: str) -> str:
    """Remove <think> and </think> tags and their content from AI responses."""
    import re
    
    # Only remove complete <think>...</think> blocks
    pattern = r'<think>.*?</think>'
    filtered_text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
    
    # Clean up any extra whitespace left behind
    filtered_text = re.sub(r'\n\s*\n', '\n\n', filtered_text)
    
    return filtered_text.strip()


async def validate_demo_session(session_token: str) -> Dict[str, Any]:
    """Validate demo session token and return session info."""
    
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("demo_signups").select("*").eq(
            "session_token", session_token
        ).eq("status", "active").single().execute()
        
        if not result.data:
            raise HTTPException(status_code=401, detail="Demo session not found or expired")
        
        demo = result.data
        
        # Check if session is expired
        expires_at = datetime.fromisoformat(demo["expires_at"].replace('Z', '+00:00'))
        if expires_at <= datetime.now().replace(tzinfo=expires_at.tzinfo):
            # Mark as expired
            supabase.table("demo_signups").update({
                "status": "expired"
            }).eq("session_token", session_token).execute()
            
            raise HTTPException(status_code=401, detail="Demo session has expired")
        
        return demo
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Demo session validation failed: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to validate demo session")


@router.post("/register", response_model=DemoRegistrationResponse)
async def register_demo(
    request: DemoRegistrationRequest,
    http_request: Request,
    background_tasks: BackgroundTasks
):
    """Register a new demo session."""
    
    try:
        add_breadcrumb(
            message="Demo registration request",
            category="demo",
            data={
                "email": request.email,
                "company": request.company_name,
                "source": request.source
            }
        )
        
        # Generate unique session token
        session_token = f"demo_{datetime.now().strftime('%Y%m%d')}_{secrets.token_urlsafe(16)}"
        
        # Set expiration to 24 hours from now
        expires_at = datetime.now() + timedelta(hours=24)
        
        # Get client info
        ip_address = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent", "")
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Check for existing active demo for this email
        existing_result = supabase.table("demo_signups").select("*").eq(
            "email", request.email
        ).eq("status", "active").execute()
        
        if existing_result.data:
            existing_demo = existing_result.data[0]
            # If demo is not expired, return existing session
            expires_at = datetime.fromisoformat(existing_demo["expires_at"].replace('Z', '+00:00'))
            if expires_at > datetime.now().replace(tzinfo=expires_at.tzinfo):
                logger.info(f"Returning existing demo session for {request.email}")
                
                return DemoRegistrationResponse(
                    success=True,
                    session_token=existing_demo["session_token"],
                    expires_at=datetime.fromisoformat(existing_demo["expires_at"].replace('Z', '+00:00')),
                    message="Session de démo existante réactivée",
                    demo_documents=await get_demo_documents(),
                    sample_questions=await get_sample_questions()
                )
        
        # Create new demo registration
        demo_data = {
            "email": request.email,
            "company_name": request.company_name,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "source": request.source,
            "utm_source": request.utm_source,
            "utm_medium": request.utm_medium,
            "utm_campaign": request.utm_campaign,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "active"
        }
        
        result = supabase.table("demo_signups").insert(demo_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create demo session")
        
        # Log successful registration
        background_tasks.add_task(
            audit_logger.log_event,
            event_type="demo_registration",
            event_data={
                "email": request.email,
                "company": request.company_name,
                "session_token": session_token,
                "source": request.source
            },
            user_id=None,  # Anonymous
            organization_id=None
        )
        
        logger.info(f"Demo registration successful for {request.email} at {request.company_name}")
        
        return DemoRegistrationResponse(
            success=True,
            session_token=session_token,
            expires_at=expires_at,
            message="Session de démo créée avec succès",
            demo_documents=await get_demo_documents(),
            sample_questions=await get_sample_questions()
        )
        
    except Exception as e:
        logger.error(f"Demo registration failed: {e}")
        capture_exception(e)
        
        # Return generic error message for security
        raise HTTPException(
            status_code=500,
            detail="Une erreur est survenue lors de la création de votre session de démo"
        )


@router.post("/chat/stream")
async def demo_chat_stream(
    request: DemoChatRequest,
    background_tasks: BackgroundTasks,
    x_demo_session: str = Header(..., alias="X-Demo-Session")
):
    """Stream chat responses for demo sessions."""
    
    try:
        # Validate demo session
        demo_session = await validate_demo_session(x_demo_session)
        
        add_breadcrumb(
            message="Demo chat request",
            category="demo",
            data={
                "question_length": len(request.question),
                "company": demo_session["company_name"],
                "session_token": x_demo_session[:20] + "..."  # Partial token for privacy
            }
        )
        
        # Track demo activity in background
        background_tasks.add_task(
            track_demo_activity_internal,
            x_demo_session,
            "question",
            {"question_preview": request.question[:50]}
        )
        
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"demo_{uuid.uuid4().hex[:8]}"
        
        # Retrieve conversation history for context
        async def get_conversation_history(conv_id: str, limit: int = 3):
            """Retrieve recent conversation history for context."""
            try:
                supabase = get_supabase_client()
                result = supabase.table("chat_logs").select("question, answer").eq(
                    "conversation_id", conv_id
                ).order("created_at", desc=True).limit(limit).execute()
                
                if result.data:
                    # Reverse to get chronological order
                    history = list(reversed(result.data))
                    return history
                return []
            except Exception as e:
                logger.warning(f"Failed to retrieve conversation history: {e}")
                return []
        
        # Create streaming generator for demo using REAL RAG
        async def generate_stream():
            try:
                # Send start event
                start_data = {
                    "type": "start",
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(start_data)}\n\n"
                
                # Use real RAG system for demo
                start_time = datetime.now()
                
                # Get demo organization ID
                demo_org_id = get_demo_organization_id(x_demo_session)
                
                # Get conversation history
                conversation_history = await get_conversation_history(conversation_id, limit=3)
                
                # Import real RAG components
                from app.rag.enhanced_retriever import enhanced_retriever
                from app.rag.llm_providers import llm_provider
                from app.rag.prompts import COMPREHENSIVE_RAG_PROMPT, STREAMING_RAG_PROMPT, QUERY_ENHANCEMENT_PROMPT
                from app.core.config import settings
                
                # Send status update
                yield f"data: {json.dumps({'type': 'status', 'message': 'Recherche dans vos documents de démo...'})}\n\n"
                
                # Use original query only for demo performance
                query_variations = [request.question]
                
                # Unified document search across both shared and user demo organizations
                shared_demo_org_id = get_shared_demo_organization_id()
                user_demo_org_id = demo_org_id
                
                # Quality-based document retrieval (not limited by k)
                async def search_multiple_organizations_quality_based(queries, org_ids, min_confidence, max_tokens=4000):
                    """
                    Search across multiple organizations using quality-based retrieval with query variations.
                    Returns ALL documents above confidence threshold, limited by token count.
                    """
                    all_results = []
                    seen_docs = set()  # Track unique documents by content hash
                    
                    # Search with each query variation
                    for query in queries:
                        for org_id in org_ids:
                            try:
                                # Retrieve candidates for this query variation
                                org_results = await enhanced_retriever.similarity_search_with_confidence(
                                    query, 
                                    k=4,  # Optimized for precision with E5-large-instruct
                                    organization_id=org_id,
                                    min_confidence=min_confidence
                                )
                                
                                # Add unique results (deduplicate by content)
                                for doc, confidence in org_results:
                                    # Create a simple hash of the content for deduplication
                                    doc_hash = hash(doc.page_content[:200])  # Use first 200 chars as identifier
                                    if doc_hash not in seen_docs:
                                        seen_docs.add(doc_hash)
                                        all_results.append((doc, confidence))
                                
                            except Exception as e:
                                logger.warning(f"Search failed for org {org_id} with query '{query[:30]}...': {e}")
                                continue
                    
                    # Sort by confidence (quality-based approach)
                    all_results.sort(key=lambda x: x[1], reverse=True)
                    
                    # Dynamic selection based on token budget instead of fixed k
                    selected_results = []
                    current_tokens = 0
                    
                    for doc, confidence in all_results:
                        # Estimate tokens (rough approximation: 1 token per 4 chars)
                        doc_tokens = len(doc.page_content) // 4
                        
                        # Stop if adding this doc would exceed token budget
                        if current_tokens + doc_tokens > max_tokens:
                            logger.info(f"Stopping retrieval at {len(selected_results)} docs due to token limit")
                            break
                        
                        # Include all documents above confidence threshold
                        if confidence >= min_confidence:
                            selected_results.append((doc, confidence))
                            current_tokens += doc_tokens
                        else:
                            # Since results are sorted, we can stop here
                            break
                    
                    logger.info(f"Quality-based retrieval: {len(selected_results)} docs selected "
                               f"from {len(all_results)} candidates (tokens: {current_tokens})")
                    
                    return selected_results
                
                # Simplified search for demo performance - single query, lower threshold
                docs_with_confidence = await enhanced_retriever.similarity_search_with_confidence(
                    request.question, 
                    k=6,  # Reduced from multiple searches
                    organization_id=shared_demo_org_id,  # Search only shared demo org
                    min_confidence=70.0  # Lowered threshold for better recall
                )
                docs = [doc for doc, confidence in docs_with_confidence]
                
                if not docs:
                    yield f"data: {json.dumps({'type': 'status', 'message': 'Aucun document trouvé avec confiance suffisante'})}\n\n"
                else:
                    avg_confidence = sum(conf for _, conf in docs_with_confidence) / len(docs_with_confidence) if docs_with_confidence else 0
                    yield f"data: {json.dumps({'type': 'status', 'message': f'{len(docs)} documents trouvés (confiance moyenne: {avg_confidence:.1f}%)'})}\n\n"
                
                # Retrieval compression - summarize chunks to reduce noise
                async def compress_retrieval_context(docs_with_confidence, max_compressed_tokens=2000):
                    """Compress retrieved documents using LLM to reduce noise and focus on relevance."""
                    if not docs_with_confidence or len(docs_with_confidence) <= 2:
                        # Don't compress if we have very few documents
                        return docs_with_confidence
                    
                    try:
                        # Group chunks by source for better compression
                        doc_groups = {}
                        for doc, confidence in docs_with_confidence:
                            source = doc.metadata.get('filename', 'Unknown')
                            if source not in doc_groups:
                                doc_groups[source] = []
                            doc_groups[source].append((doc, confidence))
                        
                        compressed_docs = []
                        
                        for source, docs_list in doc_groups.items():
                            if len(docs_list) <= 1:
                                # Keep single chunks as-is
                                compressed_docs.extend(docs_list)
                                continue
                            
                            # Combine chunks from same source for compression
                            combined_text = "\n\n".join([doc.page_content for doc, _ in docs_list[:5]])  # Limit to avoid huge prompts
                            
                            # Use LLM to compress/summarize
                            compression_prompt = f"""Résume et extrait les informations clés de ces extraits de document.
Conserve UNIQUEMENT les informations directement pertinentes pour répondre à la question: {request.question}

Extraits du document '{source}':
{combined_text[:3000]}  # Limit input size

Résumé concis (max 500 mots):"""
                            
                            messages = [
                                {"role": "system", "content": "Tu es un assistant qui extrait et résume les informations pertinentes des documents."},
                                {"role": "user", "content": compression_prompt}
                            ]
                            
                            compressed_response = await llm_provider.generate_response(
                                messages=messages,
                                stream=False,
                                temperature=0.0,
                                max_tokens=600
                            )
                            
                            # Create compressed document
                            compressed_doc = Document(
                                page_content=compressed_response,
                                metadata={
                                    **docs_list[0][0].metadata,
                                    "compressed": True,
                                    "original_chunks": len(docs_list)
                                }
                            )
                            
                            # Use average confidence of compressed chunks
                            avg_confidence = sum(conf for _, conf in docs_list) / len(docs_list)
                            compressed_docs.append((compressed_doc, avg_confidence))
                        
                        logger.info(f"Compressed {len(docs_with_confidence)} chunks to {len(compressed_docs)} compressed documents")
                        return compressed_docs
                        
                    except Exception as e:
                        logger.warning(f"Retrieval compression failed: {e}")
                        return docs_with_confidence  # Return original on failure
                
                # Skip compression for demo performance - use documents as-is
                
                # Enhanced context building with comprehensive approach
                def build_enhanced_context(docs_with_confidence):
                    """Build rich context from documents with metadata and relationships."""
                    if not docs_with_confidence:
                        return ""
                    
                    # Group documents by source/type for better organization
                    doc_groups = {}
                    for doc, confidence in docs_with_confidence:
                        source = doc.metadata.get('filename', 'Document')
                        if source not in doc_groups:
                            doc_groups[source] = []
                        doc_groups[source].append((doc, confidence))
                    
                    context_parts = []
                    doc_counter = 1
                    
                    for source, docs_list in doc_groups.items():
                        # Add source header with metadata
                        source_meta = docs_list[0][0].metadata
                        file_type = source_meta.get('content_type', 'Document')
                        pages = source_meta.get('total_pages', 'N/A')
                        is_compressed = source_meta.get('compressed', False)
                        
                        if is_compressed:
                            context_parts.append(f"=== SOURCE {doc_counter}: {source} (Résumé) ===")
                            context_parts.append(f"Type: {file_type} | Chunks compressés: {source_meta.get('original_chunks', 'N/A')}")
                        else:
                            context_parts.append(f"=== SOURCE {doc_counter}: {source} ===")
                            context_parts.append(f"Type: {file_type} | Pages: {pages}")
                        
                        # Add document chunks from this source
                        for doc, confidence in docs_list:
                            chunk_info = f"[Confiance: {confidence:.1f}%]"
                            page_info = f"[Page: {doc.metadata.get('page', 'N/A')}]" if doc.metadata.get('page') else ""
                            
                            context_parts.append(f"{chunk_info} {page_info}")
                            # Use full content for better context synthesis (not truncated)
                            context_parts.append(doc.page_content)
                            context_parts.append("---")
                        
                        doc_counter += 1
                        context_parts.append("")  # Separator between sources
                    
                    return "\n".join(context_parts)
                
                # Build conversation context
                conversation_context = ""
                if conversation_history:
                    conversation_context = "## HISTORIQUE DE CONVERSATION:\n"
                    for i, exchange in enumerate(conversation_history, 1):
                        conversation_context += f"**Échange {i}:**\n"
                        conversation_context += f"Q: {exchange['question']}\n"
                        # Truncate long answers to keep context reasonable
                        answer_preview = exchange['answer'][:300] + "..." if len(exchange['answer']) > 300 else exchange['answer']
                        conversation_context += f"R: {answer_preview}\n\n"
                
                # Use simple streaming approach for demo performance
                system_prompt = STREAMING_RAG_PROMPT
                
                # Simple context building - limit to top 4 documents, truncate content
                context = "\n\n".join([
                    f"Document {i+1} (Source: {doc.metadata.get('filename', 'Document')}): {doc.page_content[:400]}"
                    for i, (doc, _) in enumerate(docs_with_confidence[:4])
                ])
                
                user_prompt = f"{conversation_context if conversation_context else ''}Contexte:\n{context}\n\nQuestion: {request.question}\n\nRéponse:"
                
                # Simple LLM generation for demo performance
                yield f"data: {json.dumps({'type': 'status', 'message': f'Génération de la réponse via {llm_provider.provider_name}...'})}\n\n"
                
                # Direct LLM call without fallback complexity
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
                
                try:
                    stream = await llm_provider.generate_response(
                        messages=messages,
                        stream=True,
                        temperature=0.0,
                        max_tokens=3000  # Reduced for faster response
                    )
                except Exception as e:
                    logger.error(f"LLM generation failed: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Erreur lors de la génération de la réponse'})}\n\n"
                    return
                
                # Process the stream
                full_answer = ""
                buffer = ""
                in_think_block = False
                
                async for content in stream:
                    if content:
                        buffer += content
                        
                        # Check for start of think block
                        if '<think>' in buffer.lower() and not in_think_block:
                            # Send content up to the think tag
                            think_start = buffer.lower().find('<think>')
                            if think_start > 0:
                                clean_content = buffer[:think_start]
                                if clean_content:
                                    full_answer += clean_content
                                    yield f"data: {json.dumps({'type': 'token', 'content': clean_content})}\n\n"
                            
                            in_think_block = True
                            buffer = buffer[think_start:]
                        
                        # Check for end of think block
                        elif '</think>' in buffer.lower() and in_think_block:
                            # Skip everything including the closing tag
                            think_end = buffer.lower().find('</think>') + 8  # len('</think>')
                            buffer = buffer[think_end:]
                            in_think_block = False
                            
                            # Continue processing any remaining content in buffer
                            if buffer and not in_think_block:
                                full_answer += buffer
                                yield f"data: {json.dumps({'type': 'token', 'content': buffer})}\n\n"
                                buffer = ""
                        
                        # If not in think block, send the content
                        elif not in_think_block and buffer:
                            # Only send if we're sure we won't hit a think tag
                            # Keep a small buffer to avoid splitting <think>
                            if len(buffer) > 10 or '<' not in buffer:
                                send_content = buffer
                                if '<' in buffer:
                                    # Keep the < and what follows in buffer
                                    last_bracket = buffer.rfind('<')
                                    send_content = buffer[:last_bracket]
                                    buffer = buffer[last_bracket:]
                                else:
                                    buffer = ""
                                
                                if send_content:
                                    full_answer += send_content
                                    yield f"data: {json.dumps({'type': 'token', 'content': send_content})}\n\n"
                
                # Send any remaining clean content
                if buffer and not in_think_block:
                    full_answer += buffer
                    yield f"data: {json.dumps({'type': 'token', 'content': buffer})}\n\n"
                
                # Enhanced response quality controls
                def assess_response_quality(response: str, docs_with_conf: list) -> dict:
                    """Assess response quality and determine appropriate actions."""
                    if not response or not response.strip():
                        return {"quality": "empty", "should_send_sources": False, "reason": "Empty response"}
                    
                    response_lower = response.lower()
                    
                    # Check for "no information" responses
                    no_info_phrases = [
                        "information non disponible", "informations non disponibles", 
                        "aucune information", "ne trouve pas", "pas d'information",
                        "pas de réponse", "impossible de répondre", "cannot answer",
                        "no information", "not available", "cette information n'est pas couverte"
                    ]
                    
                    contains_no_info = any(phrase in response_lower for phrase in no_info_phrases)
                    
                    # Quality assessment criteria
                    word_count = len(response.strip().split())
                    has_structure = any(marker in response for marker in ["**", "-", ":", "\n"])
                    has_context_utilization = word_count > 30  # More than just a simple answer
                    
                    # Determine quality level
                    if contains_no_info:
                        quality = "no_information"
                        should_send = False
                        reason = "Response indicates no relevant information found"
                    elif word_count < 10:
                        quality = "too_brief"
                        should_send = len(docs_with_conf) > 0  # Send sources to show what was found
                        reason = "Response too brief but sources available"
                    elif word_count >= 30 and has_structure and has_context_utilization:
                        quality = "comprehensive"
                        should_send = True
                        reason = "High-quality comprehensive response"
                    elif word_count >= 15:
                        quality = "adequate" 
                        should_send = True
                        reason = "Adequate response with some context"
                    else:
                        quality = "minimal"
                        should_send = len(docs_with_conf) > 0
                        reason = "Minimal response but sources available"
                    
                    return {
                        "quality": quality,
                        "should_send_sources": should_send,
                        "reason": reason,
                        "word_count": word_count,
                        "has_structure": has_structure
                    }
                
                # Assess response quality
                quality_assessment = assess_response_quality(full_answer, docs_with_confidence)
                should_send_sources = quality_assessment["should_send_sources"]
                
                # Log quality for monitoring
                logger.info(f"Response quality: {quality_assessment['quality']} - {quality_assessment['reason']} (words: {quality_assessment['word_count']})")
                
                if should_send_sources:
                    # Send enhanced sources with confidence scores
                    # Smart source selection: include all high-confidence sources
                    # but limit very low-confidence sources to prevent noise
                    sources = []
                    selected_sources = []
                    
                    for doc, confidence in docs_with_confidence:
                        # Always include sources with very high confidence (≥90%)
                        if confidence >= 90.0:
                            selected_sources.append((doc, confidence))
                        # Include good sources (≥70%) up to 5 total
                        elif confidence >= 70.0 and len(selected_sources) < 5:
                            selected_sources.append((doc, confidence))
                        # Include decent sources (≥50%) up to 3 total if we don't have enough
                        elif confidence >= 50.0 and len(selected_sources) < 3:
                            selected_sources.append((doc, confidence))
                        # Stop at maximum of 6 sources to prevent UI overload
                        elif len(selected_sources) >= 6:
                            break
                    
                    for i, (doc, confidence) in enumerate(selected_sources):
                        source_data = {
                            "content": doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content,
                            "metadata": doc.metadata,
                            "score": confidence / 100.0,  # Convert to 0-1 scale for frontend compatibility
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
                            source_data["metadata"]["page"] = doc.metadata["page"]
                        
                        sources.append(source_data)
                    
                    # Send sources with enhanced metadata
                    sources_data = {
                        "type": "sources",
                        "sources": sources,
                        "timestamp": datetime.now().isoformat()
                    }
                    yield f"data: {json.dumps(sources_data)}\n\n"
                else:
                    # Log why sources weren't sent for debugging
                    logger.info(f"Sources not sent - docs: {len(docs_with_confidence)}, answer_length: {len(full_answer)}, answer_preview: '{full_answer[:100]}'")
                    sources = []  # Empty sources for tracking
                
                # Calculate response time
                end_time = datetime.now()
                response_time = (end_time - start_time).total_seconds()
                
                # Save conversation to chat_logs for future context
                try:
                    supabase = get_supabase_client()
                    chat_log_data = {
                        "conversation_id": conversation_id,
                        "question": request.question,
                        "answer": full_answer,
                        "sources": [{"content": doc.page_content[:500], "metadata": doc.metadata} for doc in docs[:3]],
                        "response_time": response_time,
                        "organization_id": demo_org_id
                        # Don't include user_id for demo sessions as they're not real users
                    }
                    supabase.table("chat_logs").insert(chat_log_data).execute()
                    logger.debug(f"Saved conversation to chat_logs: {conversation_id}")
                except Exception as log_error:
                    logger.warning(f"Failed to save conversation history: {log_error}")
                
                # Send completion event
                complete_data = {
                    "type": "complete",
                    "response_time": response_time,
                    "conversation_id": conversation_id,
                    "timestamp": end_time.isoformat()
                }
                yield f"data: {json.dumps(complete_data)}\n\n"
                
                # Track completion in background
                background_tasks.add_task(
                    track_demo_activity_internal,
                    x_demo_session,
                    "answer_received",
                    {
                        "response_time": response_time,
                        "sources_count": len(sources),
                        "answer_length": len(full_answer)
                    }
                )
                
                logger.info(f"Demo chat completed for {demo_session['company_name']}: {response_time:.2f}s")
                
            except Exception as e:
                logger.error(f"Demo chat streaming error: {e}")
                capture_exception(e)
                
                error_data = {
                    "type": "error",
                    "message": "Une erreur est survenue lors de la génération de la réponse",
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Demo chat stream failed: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to process demo chat request")


async def track_demo_activity_internal(
    session_token: str,
    interaction_type: str,
    interaction_data: Dict[str, Any]
):
    """Internal function to track demo activity without HTTP request/response."""
    try:
        supabase = get_supabase_client()
        
        # Use the database function to update activity
        result = supabase.rpc(
            "update_demo_activity",
            {
                "p_session_token": session_token,
                "p_interaction_type": interaction_type,
                "p_interaction_data": interaction_data or {}
            }
        ).execute()
        
        if result.data:
            logger.debug(f"Activity tracked for session {session_token}: {interaction_type}")
        
    except Exception as e:
        logger.error(f"Internal activity tracking failed: {e}")


@router.post("/activity")
async def track_demo_activity(
    request: DemoActivityRequest,
    background_tasks: BackgroundTasks
):
    """Track demo user activity."""
    
    try:
        supabase = get_supabase_client()
        
        # Use the database function to update activity
        result = supabase.rpc(
            "update_demo_activity",
            {
                "p_session_token": request.session_token,
                "p_interaction_type": request.interaction_type,
                "p_interaction_data": request.interaction_data or {}
            }
        ).execute()
        
        if result.data:
            logger.debug(f"Activity tracked for session {request.session_token}: {request.interaction_type}")
            return {"success": True, "message": "Activity tracked"}
        else:
            # Session not found or expired
            return {"success": False, "message": "Session not found or expired"}
            
    except Exception as e:
        logger.error(f"Activity tracking failed: {e}")
        capture_exception(e)
        return {"success": False, "message": "Failed to track activity"}


@router.post("/convert")
async def convert_demo(
    request: DemoConversionRequest,
    background_tasks: BackgroundTasks
):
    """Mark demo as converted (user requested quote/contact)."""
    
    try:
        supabase = get_supabase_client()
        
        # Use the database function to convert demo
        result = supabase.rpc(
            "convert_demo_signup",
            {
                "p_session_token": request.session_token,
                "p_conversion_type": request.conversion_type
            }
        ).execute()
        
        if result.data:
            # Log conversion for analytics
            background_tasks.add_task(
                audit_logger.log_event,
                event_type="demo_conversion",
                event_data={
                    "session_token": request.session_token,
                    "conversion_type": request.conversion_type,
                    "additional_data": request.additional_data
                },
                user_id=None,
                organization_id=None
            )
            
            logger.info(f"Demo converted: {request.session_token} -> {request.conversion_type}")
            return {"success": True, "message": "Demo converted successfully"}
        else:
            return {"success": False, "message": "Session not found or already converted"}
            
    except Exception as e:
        logger.error(f"Demo conversion failed: {e}")
        capture_exception(e)
        return {"success": False, "message": "Failed to convert demo"}


@router.get("/session/{session_token}")
async def get_demo_session(session_token: str):
    """Get demo session information."""
    
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("demo_signups").select("*").eq(
            "session_token", session_token
        ).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Demo session not found")
        
        demo = result.data
        
        # Check if session is expired
        expires_at = datetime.fromisoformat(demo["expires_at"].replace('Z', '+00:00'))
        if expires_at <= datetime.now() and demo["status"] == "active":
            # Mark as expired
            supabase.table("demo_signups").update({
                "status": "expired"
            }).eq("session_token", session_token).execute()
            
            return {
                "success": False,
                "message": "Demo session has expired",
                "expired": True
            }
        
        return {
            "success": True,
            "session": {
                "email": demo["email"],
                "company_name": demo["company_name"],
                "created_at": demo["created_at"],
                "expires_at": demo["expires_at"],
                "status": demo["status"],
                "questions_asked": demo["questions_asked"],
                "documents_uploaded": demo["documents_uploaded"],
                "total_interactions": demo["total_interactions"]
            },
            "demo_documents": await get_demo_documents(),
            "sample_questions": await get_sample_questions()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get demo session: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to retrieve demo session")


@router.delete("/cleanup")
async def cleanup_expired_demos():
    """Cleanup expired demo sessions (admin endpoint)."""
    
    try:
        supabase = get_supabase_client()
        
        # Use database function to cleanup
        result = supabase.rpc("cleanup_expired_demo_signups").execute()
        
        deleted_count = result.data if result.data else 0
        
        logger.info(f"Cleaned up {deleted_count} expired demo sessions")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} expired demo sessions"
        }
        
    except Exception as e:
        logger.error(f"Demo cleanup failed: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to cleanup demos")


@router.get("/analytics")
async def get_demo_analytics():
    """Get demo analytics (admin endpoint)."""
    
    try:
        supabase = get_supabase_client()
        
        # Get analytics from the view
        result = supabase.table("demo_analytics").select("*").limit(30).execute()
        
        analytics_data = result.data if result.data else []
        
        # Get summary stats
        summary_result = supabase.table("demo_signups").select(
            "status,created_at,questions_asked,total_interactions,conversion_type"
        ).execute()
        
        summary_data = summary_result.data if summary_result.data else []
        
        # Calculate summary metrics
        total_signups = len(summary_data)
        total_conversions = len([d for d in summary_data if d["status"] == "converted"])
        active_demos = len([d for d in summary_data if d["status"] == "active"])
        
        conversion_rate = (total_conversions / total_signups * 100) if total_signups > 0 else 0
        avg_questions = sum(d["questions_asked"] or 0 for d in summary_data) / total_signups if total_signups > 0 else 0
        avg_interactions = sum(d["total_interactions"] or 0 for d in summary_data) / total_signups if total_signups > 0 else 0
        
        return {
            "success": True,
            "summary": {
                "total_signups": total_signups,
                "total_conversions": total_conversions,
                "active_demos": active_demos,
                "conversion_rate": round(conversion_rate, 2),
                "avg_questions_per_demo": round(avg_questions, 1),
                "avg_interactions_per_demo": round(avg_interactions, 1)
            },
            "daily_analytics": analytics_data
        }
        
    except Exception as e:
        logger.error(f"Failed to get demo analytics: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.post("/upload")
async def demo_upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    x_demo_session: str = Header(..., alias="X-Demo-Session")
):
    """Upload documents for demo session with organization scoping."""
    
    try:
        # Validate demo session
        demo_session = await validate_demo_session(x_demo_session)
        
        add_breadcrumb(
            message="Demo document upload",
            category="demo",
            data={
                "filename": file.filename,
                "company": demo_session["company_name"],
                "session_token": x_demo_session[:20] + "..."
            }
        )
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        if not validate_filename(file.filename):
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        safe_filename = sanitize_filename(file.filename)
        
        # Read file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Validate file size (limit demo uploads)
        max_size = 10 * 1024 * 1024  # 10MB limit for demo
        if not validate_file_size(len(file_content), max_size):
            raise HTTPException(status_code=400, detail=f"File too large (max {max_size // (1024*1024)}MB)")
        
        # Validate file type
        if not validate_file_type(file.content_type or "text/plain", ALLOWED_FILE_TYPES):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
        
        # Get demo organization ID
        demo_org_id = get_demo_organization_id(x_demo_session)
        
        # Ensure demo organization exists in database
        org_created = await ensure_demo_organization_exists(demo_org_id, demo_session["company_name"])
        if not org_created:
            raise HTTPException(status_code=500, detail="Failed to create demo organization")
        
        logger.info(f"Processing demo upload: {safe_filename} for org {demo_org_id}")
        
        # Save document info to database
        document_id = await save_document_info(
            filename=safe_filename,
            content_type=file.content_type or "text/plain",
            size_bytes=len(file_content),
            file_path=f"/demo/{safe_filename}",
            user_id=None,  # Anonymous demo user
            organization_id=demo_org_id
        )
        
        try:
            # Update document status to processing
            await update_document_status(
                document_id=document_id,
                status="processing"
            )
            
            # Process document directly for demo
            logger.info(f"Processing demo document: {safe_filename}")
            
            # Load document content
            documents = await document_loader.load_from_content(
                content=file_content,
                filename=safe_filename,
                content_type=file.content_type or "text/plain"
            )
            
            # Split into chunks
            chunks = document_splitter.split_documents(documents)
            
            # Add demo metadata to chunks
            for chunk in chunks:
                chunk.metadata.update({
                    "document_id": document_id,
                    "organization_id": demo_org_id,
                    "filename": safe_filename,
                    "upload_date": datetime.now().isoformat(),
                    "demo_session": x_demo_session,
                    "is_demo_upload": True
                })
            
            # Add to vector store with demo organization scoping
            supabase_retriever.add_documents(chunks)
            
            # Update document status to completed
            await update_document_status(
                document_id=document_id,
                status="completed"
            )
            
            # Track demo activity
            background_tasks.add_task(
                track_demo_activity_internal,
                x_demo_session,
                "upload",
                {
                    "filename": safe_filename,
                    "size_bytes": len(file_content),
                    "chunks_created": len(chunks)
                }
            )
            
            logger.info(f"Demo upload successful: {safe_filename} ({len(chunks)} chunks)")
            
            return {
                "success": True,
                "message": f"Document '{safe_filename}' téléchargé et traité avec succès",
                "document_id": document_id,
                "filename": safe_filename,
                "chunks_created": len(chunks),
                "size_bytes": len(file_content)
            }
            
        except Exception as processing_error:
            logger.error(f"Demo document processing failed: {processing_error}")
            await update_document_status(
                document_id=document_id,
                status="error",
                error_message=str(processing_error)
            )
            raise HTTPException(
                status_code=500,
                detail="Une erreur est survenue lors du traitement du document"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Demo upload failed: {e}")
        capture_exception(e)
        raise HTTPException(
            status_code=500,
            detail="Une erreur est survenue lors du téléchargement"
        )


@router.get("/documents")
async def list_demo_documents(
    x_demo_session: str = Header(..., alias="X-Demo-Session")
):
    """List documents for demo session."""
    
    try:
        # Validate demo session
        demo_session = await validate_demo_session(x_demo_session)
        
        # Get organization IDs
        shared_demo_org_id = get_shared_demo_organization_id()
        user_demo_org_id = get_demo_organization_id(x_demo_session)
        
        supabase = get_supabase_client()
        
        # Get shared demo base documents (the 5 pre-loaded documents)
        shared_result = supabase.table("documents").select(
            "id,filename,content_type,size_bytes,status,upload_date,chunks_count"
        ).eq("organization_id", shared_demo_org_id).eq("status", "completed").order("upload_date", desc=False).execute()
        
        demo_base_docs = shared_result.data if shared_result.data else []
        
        # Get user's uploaded documents
        user_result = supabase.table("documents").select(
            "id,filename,content_type,size_bytes,status,upload_date,chunks_count"
        ).eq("organization_id", user_demo_org_id).order("upload_date", desc=True).execute()
        
        user_uploads = user_result.data if user_result.data else []
        
        return {
            "success": True,
            "demo_base_documents": demo_base_docs,
            "user_uploaded_documents": user_uploads,
            "total_documents": len(demo_base_docs) + len(user_uploads)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list demo documents: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to retrieve documents")