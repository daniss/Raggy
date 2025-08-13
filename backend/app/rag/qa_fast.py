"""Fast QA chain for optimized performance."""

import logging
from typing import List, Dict, Any
from groq import Groq
from langchain.schema import Document
from app.core.config import settings
from app.core.retry_handler import retry_external_api
from app.rag.hybrid_retriever import hybrid_retriever as retriever

logger = logging.getLogger(__name__)

# Initialize Groq client
groq_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None


class FastQAChain:
    """Optimized QA chain for fast responses."""
    
    def __init__(self):
        self.model = settings.groq_model
        self.max_context_docs = getattr(settings, 'MAX_CONTEXT_DOCS', 5)
        
    @retry_external_api(max_attempts=2, delay=0.5)
    async def generate_response(self, query: str, documents: List[Document], **kwargs) -> Dict[str, Any]:
        """Generate a response using the fast QA chain."""
        
        if not groq_client:
            raise ValueError("Groq API key not configured")
        
        try:
            # Limit documents for performance
            context_docs = documents[:self.max_context_docs]
            
            # Build context from documents
            context_parts = []
            sources = []
            
            for i, doc in enumerate(context_docs):
                content = doc.page_content[:800]  # Limit content length
                context_parts.append(f"Document {i+1}:\n{content}")
                
                # Extract source info
                metadata = doc.metadata or {}
                sources.append({
                    "title": metadata.get("filename", f"Document {i+1}"),
                    "content": content[:200] + "..." if len(content) > 200 else content,
                    "metadata": metadata
                })
            
            context = "\n\n".join(context_parts)
            
            # Create prompt
            system_prompt = """Tu es un assistant IA spécialisé dans l'analyse de documents. 
Réponds aux questions en français en te basant uniquement sur les documents fournis.
Sois précis, concis et cite les sources quand c'est possible."""
            
            user_prompt = f"""Question: {query}

Documents de référence:
{context}

Réponds à la question en te basant uniquement sur les informations des documents fournis."""
            
            # Call Groq API
            response = groq_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            answer = response.choices[0].message.content
            
            return {
                "answer": answer,
                "sources": sources,
                "model_used": self.model,
                "context_docs": len(context_docs)
            }
            
        except Exception as e:
            logger.error(f"Fast QA generation failed: {e}")
            raise
    
    async def query(self, question: str, organization_id: str = None, **kwargs) -> Dict[str, Any]:
        """Main query method combining retrieval and generation."""
        
        try:
            # Retrieve relevant documents
            documents = await retriever.retrieve(question, organization_id=organization_id)
            
            if not documents:
                return {
                    "answer": "Je ne trouve pas d'information pertinente dans la base de connaissances pour répondre à cette question.",
                    "sources": [],
                    "model_used": self.model,
                    "context_docs": 0
                }
            
            # Generate response
            result = await self.generate_response(question, documents, **kwargs)
            
            logger.info(f"Fast QA completed: {len(documents)} docs retrieved, {result['context_docs']} used")
            
            return result
            
        except Exception as e:
            logger.error(f"Fast QA query failed: {e}")
            raise


# Global instance
fast_qa_chain = FastQAChain()