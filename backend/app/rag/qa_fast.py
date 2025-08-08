from typing import List, Dict, Any
from groq import Groq
from langchain.schema import Document
import logging
import time
from app.core.config import settings
from app.core.retry_handler import retry_external_api, groq_circuit_breaker
from app.rag.fast_retriever import fast_retriever as retriever

logger = logging.getLogger(__name__)


class FastGroqQAChain:
    """Optimized question-answering chain for faster response times."""
    
    def __init__(self):
        """Initialize Fast Groq QA chain."""
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = settings.groq_model
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.max_tokens
        
        # Cache for query enhancements to avoid repeated LLM calls
        self._query_cache = {}
        
        logger.info(f"Initialized Fast Groq QA chain with model: {self.model}")
    
    @retry_external_api
    def _call_groq_api(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Make API call to Groq with retry logic."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                top_p=1,
                stream=False
            )
            
            return {
                "content": response.choices[0].message.content,
                "usage": response.usage.total_tokens if hasattr(response, 'usage') else None
            }
            
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            raise
    
    def _build_prompt(self, question: str, context_docs: List[Document]) -> str:
        """Build prompt with context and question."""
        # System message for French SME support
        # Import optimized prompt from centralized location
        from app.rag.prompts import ENTERPRISE_RAG_SYSTEM_PROMPT
        system_prompt = ENTERPRISE_RAG_SYSTEM_PROMPT
        
        # Build context from retrieved documents (limit to top 5 for speed)
        context_parts = []
        for i, doc in enumerate(context_docs[:5], 1):
            source_info = ""
            if "filename" in doc.metadata:
                source_info = f" (Source: {doc.metadata['filename']}"
                if "page" in doc.metadata:
                    source_info += f", page {doc.metadata['page']}"
                source_info += ")"
            
            # Truncate very long documents for faster processing
            content = doc.page_content[:1500] if len(doc.page_content) > 1500 else doc.page_content
            context_parts.append(f"Document {i}{source_info}:\n{content}\n")
        
        context = "\n".join(context_parts) if context_parts else "Aucun document de contexte disponible."
        
        # User prompt with context and question
        user_prompt = f"""Contexte documentaire:
{context}

Question de l'utilisateur: {question}

Réponse:"""
        
        return system_prompt, user_prompt
    
    async def arun(self, question: str, organization_id: str = None, context_docs: List[Document] = None) -> Dict[str, Any]:
        """Run QA chain asynchronously with optimizations."""
        start_time = time.time()
        
        try:
            # OPTIMIZATION 1: Skip query enhancement for simple queries
            # Only enhance if query is complex (>50 chars or contains specific keywords)
            should_enhance = len(question) > 50 or any(
                keyword in question.lower() 
                for keyword in ['comment', 'pourquoi', 'expliquer', 'détailler']
            )
            
            # Retrieve relevant documents if not provided
            if context_docs is None:
                logger.debug(f"Retrieving relevant documents for org: {organization_id}")
                
                # OPTIMIZATION 2: Single retrieval pass instead of multiple queries
                if should_enhance and settings.use_query_enhancement:
                    # Check cache first
                    cache_key = f"{question}:{organization_id}"
                    if cache_key in self._query_cache:
                        search_query = self._query_cache[cache_key]
                    else:
                        # Simple keyword extraction instead of LLM enhancement
                        search_query = self._extract_keywords(question)
                        self._query_cache[cache_key] = search_query
                else:
                    search_query = question
                
                # OPTIMIZATION 3: Reduced k value for faster retrieval
                retrieve_k = 10 if settings.use_reranking else 5
                context_docs = retriever.similarity_search(
                    search_query, 
                    k=retrieve_k, 
                    organization_id=organization_id
                )
                logger.info(f"Retrieved {len(context_docs)} documents")
                
                # OPTIMIZATION 4: Skip reranking for small result sets
                if settings.use_reranking and len(context_docs) > 5:
                    # Use lightweight scoring instead of heavy cross-encoder
                    context_docs = self._lightweight_rerank(question, context_docs, top_k=5)
                    logger.info(f"Reranked to {len(context_docs)} final documents")
            
            # Build prompt
            system_prompt, user_prompt = self._build_prompt(question, context_docs)
            
            # Log context information for debugging
            total_context_chars = sum(len(doc.page_content[:1500]) for doc in context_docs[:5])
            logger.info(f"Context: {min(len(context_docs), 5)} docs, {total_context_chars} chars total")
            
            # Call Groq API with retry logic
            logger.debug(f"Calling Groq API with model: {self.model}")
            
            try:
                groq_response = self._call_groq_api(system_prompt, user_prompt)
                answer = groq_response["content"]
                tokens_used = groq_response["usage"]
                
            except Exception as e:
                logger.error(f"Failed to get response from Groq API: {e}")
                if "Circuit breaker is open" in str(e):
                    answer = "Service temporairement indisponible. Notre système de génération de réponses est en cours de récupération. Veuillez réessayer dans quelques instants."
                else:
                    answer = "Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants."
                tokens_used = None
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Prepare sources for response (limit to top 5)
            sources = []
            for doc in context_docs[:5]:
                content = doc.page_content
                if len(content) > 500:
                    content = content[:500] + "..."
                    
                sources.append({
                    "content": content,
                    "metadata": doc.metadata,
                    "score": doc.metadata.get("similarity", 0.0)
                })
            
            result = {
                "answer": answer,
                "sources": sources,
                "response_time": response_time,
                "model_used": self.model,
                "tokens_used": tokens_used,
                "circuit_breaker_state": groq_circuit_breaker.get_state()
            }
            
            logger.info(f"Generated answer in {response_time:.2f}s with {len(sources)} sources")
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"Failed to generate answer: {e}")
            
            return {
                "answer": "Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants.",
                "sources": [],
                "response_time": response_time,
                "error": str(e)
            }
    
    def _extract_keywords(self, query: str) -> str:
        """Extract keywords from query without LLM call."""
        import re
        
        # Remove common French stop words
        stop_words = {
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'au',
            'avec', 'pour', 'sur', 'dans', 'par', 'sans', 'sous', 'est', 'sont', 'que',
            'qui', 'quoi', 'comment', 'pourquoi', 'quand', 'où', 'quel', 'quelle'
        }
        
        # Clean and tokenize
        clean_query = re.sub(r'[^\w\s\-àâäéèêëïîôöùûüÿç]', ' ', query.lower())
        words = [w for w in clean_query.split() if w and w not in stop_words and len(w) > 2]
        
        # Return cleaned query or original if too short
        return ' '.join(words) if words else query
    
    def _lightweight_rerank(self, query: str, documents: List[Document], top_k: int = 5) -> List[Document]:
        """Lightweight reranking based on keyword overlap and similarity scores."""
        query_keywords = set(self._extract_keywords(query).split())
        
        for doc in documents:
            # Calculate keyword overlap score
            doc_keywords = set(self._extract_keywords(doc.page_content[:500]).split())
            overlap_score = len(query_keywords & doc_keywords) / max(len(query_keywords), 1)
            
            # Combine with existing similarity score
            similarity = doc.metadata.get("similarity", 0.0)
            combined_score = (similarity * 0.7) + (overlap_score * 0.3)
            doc.metadata["combined_score"] = combined_score
        
        # Sort by combined score
        documents.sort(key=lambda d: d.metadata.get("combined_score", 0), reverse=True)
        
        return documents[:top_k]
    
    def run(self, question: str, organization_id: str = None, context_docs: List[Document] = None) -> Dict[str, Any]:
        """Run QA chain synchronously."""
        import asyncio
        return asyncio.run(self.arun(question, organization_id, context_docs))
    
    def test_connection(self) -> bool:
        """Test Groq API connection."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Test de connexion"}],
                max_tokens=10
            )
            logger.info("Groq API connection successful")
            return True
        except Exception as e:
            logger.error(f"Groq API connection failed: {e}")
            return False


# Global Fast QA chain instance
fast_qa_chain = FastGroqQAChain()