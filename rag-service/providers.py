"""
Providers Module - External Service Integrations
================================================
Handles connections to Supabase, Embedding APIs, and LLM APIs.
Configurable providers for easy switching (Groq->Mistral, Nomic->Jina, etc).
"""

import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx
import supabase
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class SupabaseProvider:
    """
    Handles all Supabase operations for RAG
    Database queries, storage access, and RPC calls
    """
    
    def __init__(self):
        self.url = os.getenv('SUPABASE_URL')
        self.service_key = os.getenv('SUPABASE_SERVICE_KEY')  # Service role for full access
        
        if not self.url or not self.service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
        
        self.client: Client = create_client(self.url, self.service_key)
    
    async def test_connection(self) -> str:
        """Test database connection"""
        try:
            # Simple query to test connection
            result = self.client.from_('organizations').select('id').limit(1).execute()
            return f"connected ({len(result.data)} orgs)"
        except Exception as e:
            logger.error(f"Supabase connection failed: {e}")
            raise
    
    async def get_org_dek(self, org_id: str) -> Optional[str]:
        """Get encrypted DEK for organization"""
        try:
            result = self.client.from_('org_keys').select('encrypted_dek').eq('org_id', org_id).single().execute()
            if result.data:
                return result.data['encrypted_dek']
            return None
        except Exception as e:
            if "PGRST116" in str(e):  # Record not found
                return None
            logger.error(f"Failed to get DEK for org {org_id}: {e}")
            raise
    
    async def store_org_dek(self, org_id: str, encrypted_dek: str):
        """Store encrypted DEK for organization"""
        try:
            self.client.from_('org_keys').upsert({
                'org_id': org_id,
                'encrypted_dek': encrypted_dek,
                'dek_version': 1
            }).execute()
            logger.info(f"Stored DEK for org {org_id}")
        except Exception as e:
            logger.error(f"Failed to store DEK for org {org_id}: {e}")
            raise
    
    async def fetch_document_content(self, org_id: str, document_id: str) -> Optional[bytes]:
        """
        Fetch document content from Supabase Storage
        Returns raw bytes for processing
        """
        try:
            # Get document metadata first
            result = self.client.from_('documents').select('file_path').eq('id', document_id).eq('org_id', org_id).single().execute()
            
            if not result.data:
                logger.warning(f"Document {document_id} not found in org {org_id}")
                return None
            
            file_path = result.data['file_path']
            if not file_path:
                logger.warning(f"Document {document_id} has no file_path")
                return None
            
            # Download from storage
            # Note: This is a simplified version. In production, you might need to handle
            # different storage backends or encryption at the storage level
            response = self.client.storage.from_('documents').download(file_path)
            return response
            
        except Exception as e:
            logger.error(f"Failed to fetch document {document_id}: {e}")
            raise
    
    async def insert_chunks_batch(self, chunk_records: List[Dict[str, Any]]):
        """Batch insert encrypted chunks with embeddings"""
        try:
            # Use upsert for idempotency
            result = self.client.from_('rag_chunks').upsert(chunk_records).execute()
            logger.info(f"Inserted {len(chunk_records)} chunks")
            return result
        except Exception as e:
            logger.error(f"Failed to insert chunks batch: {e}")
            raise
    
    async def search_similar_chunks(
        self, 
        org_id: str, 
        query_embedding: List[float], 
        k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using vector similarity
        Uses the match_rag_chunks RPC function
        """
        try:
            # Convert embedding to the format expected by Supabase
            embedding_str = f"[{','.join(map(str, query_embedding))}]"
            
            # Call the RPC function
            result = self.client.rpc(
                'match_rag_chunks',
                {
                    'p_org_id': org_id,
                    'p_query_embedding': embedding_str,
                    'p_match_count': k
                }
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Vector search failed for org {org_id}: {e}")
            raise
    
    async def mark_document_indexed(self, document_id: str):
        """Mark document as successfully indexed"""
        try:
            self.client.from_('documents').update({
                'status': 'ready',
                'updated_at': 'now()'
            }).eq('id', document_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark document {document_id} as indexed: {e}")
            raise
    
    async def mark_document_error(self, document_id: str, error_message: str):
        """Mark document as failed with error"""
        try:
            self.client.from_('documents').update({
                'status': 'error',
                'updated_at': 'now()'
                # Note: You might want to add an error field to documents table
            }).eq('id', document_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark document {document_id} as error: {e}")
    
    async def get_documents_metadata(self, document_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get document metadata for multiple documents"""
        try:
            if not document_ids:
                return {}
            
            result = self.client.from_('documents').select(
                'id, name, original_name, mime_type, size_bytes'
            ).in_('id', document_ids).execute()
            
            # Return as a dictionary keyed by document_id
            metadata = {}
            for doc in (result.data or []):
                doc_meta = doc.copy()
                # Use name as title and original_name as filename
                doc_meta['title'] = doc.get('name', f"Document {doc['id'][:8]}...")
                doc_meta['filename'] = doc.get('original_name', doc.get('name', f"doc_{doc['id'][:8]}.pdf"))
                doc_meta['file_size'] = doc.get('size_bytes')  # Map size_bytes to file_size for compatibility
                metadata[doc['id']] = doc_meta
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to get documents metadata: {e}")
            return {}

class EmbeddingProvider:
    """
    Handles text embedding generation
    Configurable provider: Nomic, Jina, or Mistral
    """
    
    def __init__(self):
        self.provider = os.getenv('EMBEDDING_PROVIDER', 'sentencetransformer').lower()
        self.api_key = os.getenv('EMBEDDING_API_KEY')
        self.model = os.getenv('EMBEDDING_MODEL', 'intfloat/multilingual-e5-base')
        self.dimension = int(os.getenv('EMBEDDING_DIM', '768'))
        
        # HTTP client for API calls
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def test_connection(self):
        """Test embedding provider connection"""
        try:
            # Test with a simple embedding
            await self.embed_query("test")
            logger.info(f"Embedding provider {self.provider} connected")
        except Exception as e:
            logger.error(f"Embedding provider {self.provider} failed: {e}")
            raise
    
    async def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single query"""
        return (await self.embed_texts([text]))[0]
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        Handles batching and rate limiting
        """
        try:
            if self.provider == 'nomic':
                return await self._embed_nomic(texts)
            elif self.provider == 'jina':
                return await self._embed_jina(texts)
            elif self.provider in ('sentencetransformer', 'sbert', 'intfloat'):
                return await self._embed_sentence_transformer(texts)
            elif self.provider == 'mistral':
                return await self._embed_mistral(texts)
            else:
                raise ValueError(f"Unsupported embedding provider: {self.provider}")
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def _embed_nomic(self, texts: List[str]) -> List[List[float]]:
        """Nomic embedding implementation"""
        if not self.api_key:
            raise ValueError("EMBEDDING_API_KEY required for Nomic")
        
        # Batch process to respect API limits
        all_embeddings = []
        batch_size = 50  # Nomic batch limit
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            response = await self.client.post(
                "https://api-atlas.nomic.ai/v1/embedding/text",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "texts": batch,
                    "task_type": "search_document"
                }
            )
            response.raise_for_status()
            
            data = response.json()
            embeddings = data.get('embeddings', [])
            all_embeddings.extend(embeddings)
            
            # Rate limiting
            if i + batch_size < len(texts):
                await asyncio.sleep(0.1)
        
        return all_embeddings
    
    async def _embed_jina(self, texts: List[str]) -> List[List[float]]:
        """Jina embedding implementation"""
        if not self.api_key:
            raise ValueError("EMBEDDING_API_KEY required for Jina")
        
        response = await self.client.post(
            "https://api.jina.ai/v1/embeddings",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": self.model,
                "input": texts
            }
        )
        response.raise_for_status()
        
        data = response.json()
        return [item['embedding'] for item in data['data']]
    
    async def _embed_mistral(self, texts: List[str]) -> List[List[float]]:
        """Mistral embedding implementation (for future migration)"""
        if not self.api_key:
            raise ValueError("EMBEDDING_API_KEY required for Mistral")
        
        # Placeholder for Mistral API
        # Implementation will depend on Mistral's embedding API
        raise NotImplementedError("Mistral embedding not yet implemented")

    async def _embed_sentence_transformer(self, texts: List[str]) -> List[List[float]]:
        """Local SentenceTransformer (SBERT) embedding. Uses `sentence-transformers` package."""
        try:
            from sentence_transformers import SentenceTransformer
        except Exception:
            raise ImportError("sentence-transformers is required for sentencetransformer provider")

        model_name = self.model or 'intfloat/multilingual-e5-base'

        def _encode(batch_texts: List[str]):
            m = SentenceTransformer(model_name)
            return m.encode(batch_texts, convert_to_numpy=True, show_progress_bar=False)

        embeddings = await asyncio.to_thread(_encode, texts)

        return [emb.tolist() if hasattr(emb, 'tolist') else list(emb) for emb in embeddings]
    
    def get_provider_info(self) -> str:
        """Get provider information"""
        return f"{self.provider}-{self.model} ({self.dimension}d)"

class LLMProvider:
    """
    Handles LLM chat completions with streaming
    Configurable provider: Groq or Mistral
    """
    
    def __init__(self):
        self.provider = os.getenv('GENERATION_PROVIDER', 'groq').lower()
        self.api_key = os.getenv('GROQ_API_KEY') or os.getenv('MISTRAL_API_KEY')
        self.model_fast = os.getenv('GENERATION_MODEL_FAST', 'llama-3.1-8b-instant')
        self.model_quality = os.getenv('GENERATION_MODEL_QUALITY', 'llama-3.1-70b-versatile')
        
        # HTTP client for streaming
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def test_connection(self):
        """Test LLM provider connection"""
        try:
            # Test with a simple non-streaming completion
            messages = [{"role": "user", "content": "test"}]
            response = await self._make_completion_request(messages, "fast", stream=False)
            logger.info(f"LLM provider {self.provider} connected")
        except Exception as e:
            logger.error(f"LLM provider {self.provider} failed: {e}")
            raise
    
    async def stream_chat_completion(
        self, 
        user_message: str, 
        context: str, 
        model: str = "quality",
        correlation_id: str = "no-correlation"
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion with RAG context
        Yields JSON events compatible with existing frontend
        """
        try:
            # Build system prompt
            system_prompt = self._build_system_prompt()
            
            # Build user message with context
            user_prompt = self._build_user_prompt(user_message, context)
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Stream completion
            async for event in self._stream_completion(messages, model, correlation_id):
                yield event
                
        except Exception as e:
            logger.error(f"[{correlation_id}] LLM streaming failed: {e}")
            yield json.dumps({"type": "error", "message": str(e)})
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for RAG assistant"""
        return """Tu es un assistant d'entreprise expert qui répond aux questions en utilisant uniquement les informations fournies dans le contexte.

Règles importantes:
1. Réponds de manière factuelle en te basant UNIQUEMENT sur le contexte fourni
2. Cite tes sources en utilisant les références [doc:] fournies
3. Si l'information n'est pas dans le contexte, dis-le clairement
4. Structure tes réponses de manière claire avec des titres courts et des puces si nécessaire  
5. Écris en français sauf demande contraire
6. Ne jamais inventer d'informations ou de sources
7. Si la question dépasse le périmètre du contexte, propose des suggestions alternatives"""
    
    def _build_user_prompt(self, user_message: str, context: str) -> str:
        """Build user prompt with context"""
        return f"""Contexte documentaire:
{context}

Question de l'utilisateur:
{user_message}

Instructions: Réponds à la question en utilisant uniquement les informations du contexte ci-dessus. Cite tes sources en indiquant [doc:ID]."""
    
    async def _stream_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        correlation_id: str
    ) -> AsyncGenerator[str, None]:
        """Stream completion from LLM provider"""
        try:
            if self.provider == 'groq':
                async for event in self._stream_groq(messages, model, correlation_id):
                    yield event
            elif self.provider == 'mistral':
                async for event in self._stream_mistral(messages, model, correlation_id):
                    yield event
            else:
                raise ValueError(f"Unsupported LLM provider: {self.provider}")
        except Exception as e:
            logger.error(f"[{correlation_id}] LLM streaming error: {e}")
            raise
    
    async def _stream_groq(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        correlation_id: str
    ) -> AsyncGenerator[str, None]:
        """Stream from Groq API"""
        model_name = self.model_fast if model == "fast" else self.model_quality
        
        async with self.client.stream(
            "POST",
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model_name,
                "messages": messages,
                "stream": True,
                "temperature": 0.3,
                "max_tokens": 1500,
            }
        ) as response:
            response.raise_for_status()
            
            async for line in response.aiter_lines():
                if line.startswith('data: '):
                    data = line[6:]  # Remove 'data: ' prefix
                    
                    if data == '[DONE]':
                        break
                    
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get('choices', [{}])[0].get('delta', {})
                        content = delta.get('content')
                        
                        if content:
                            # Convert to our event format
                            event = json.dumps({
                                "type": "token",
                                "text": content
                            })
                            yield event
                            
                    except json.JSONDecodeError:
                        continue
    
    async def _stream_mistral(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        correlation_id: str
    ) -> AsyncGenerator[str, None]:
        """Stream from Mistral API (for future migration)"""
        # Placeholder for Mistral streaming
        raise NotImplementedError("Mistral streaming not yet implemented")
    
    async def _make_completion_request(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Make non-streaming completion request for testing"""
        model_name = self.model_fast if model == "fast" else self.model_quality
        
        if self.provider == 'groq':
            response = await self.client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "stream": stream,
                    "max_tokens": 50  # Short for testing
                }
            )
            response.raise_for_status()
            return response.json()
        else:
            raise NotImplementedError(f"Provider {self.provider} not implemented")
    
    def get_provider_info(self) -> str:
        """Get provider information"""
        return f"{self.provider} (fast: {self.model_fast}, quality: {self.model_quality})"