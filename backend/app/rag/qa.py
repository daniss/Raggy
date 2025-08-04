from typing import List, Dict, Any
from groq import Groq
from langchain.schema import Document
import logging
import time
from app.core.config import settings
from app.rag.hybrid_retriever import hybrid_retriever as retriever
from app.rag.reranker import reranker
from app.rag.query_enhancer import query_enhancer

logger = logging.getLogger(__name__)


class GroqQAChain:
    """Question-answering chain using Groq API."""
    
    def __init__(self):
        """Initialize Groq QA chain."""
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = settings.groq_model
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.max_tokens
        
        logger.info(f"Initialized Groq QA chain with model: {self.model}")
    
    def _build_prompt(self, question: str, context_docs: List[Document]) -> str:
        """Build prompt with context and question."""
        # System message for French SME support
        system_prompt = """Vous êtes un assistant IA spécialisé dans le support client pour les PME françaises. 
Votre rôle est d'aider les utilisateurs en répondant à leurs questions de manière précise, professionnelle et utile.

Instructions importantes:
- Répondez toujours en français
- Basez vos réponses sur les documents fournis dans le contexte
- LISEZ ATTENTIVEMENT TOUS LES DOCUMENTS et incluez TOUTES les informations pertinentes
- Si l'information n'est pas disponible dans le contexte, indiquez-le clairement
- Soyez concis mais complet dans vos réponses - ne manquez aucun élément important
- Adaptez votre ton pour être professionnel mais accessible
- Si une question nécessite une action spécifique, guidez l'utilisateur étape par étape

Instructions de formatage (très important):
- Utilisez un formatage moderne et épuré avec markdown
- Pour les titres principaux : utilisez ### suivi du titre en **gras**
- Pour les sous-sections : utilisez des puces avec - 
- Utilisez l'indentation propre avec des espaces
- Séparez les sections avec des lignes vides pour la lisibilité
- Pour les listes importantes, utilisez des numéros simples (1. 2. 3.)
- Utilisez **gras** pour les mots importants
- Gardez un style moderne mais professionnel

Exemple de formatage :
### **Étapes principales**

1. **Première étape importante**
   - Détail spécifique
   - Autre détail

2. **Deuxième étape**
   - Information clé
   - Conseil pratique

### **Points à retenir**
   - **Conseil important**
   - Autre recommandation"""
        
        # Build context from retrieved documents
        context_parts = []
        for i, doc in enumerate(context_docs, 1):
            source_info = ""
            if "filename" in doc.metadata:
                source_info = f" (Source: {doc.metadata['filename']}"
                if "page" in doc.metadata:
                    source_info += f", page {doc.metadata['page']}"
                source_info += ")"
            
            context_parts.append(f"Document {i}{source_info}:\n{doc.page_content}\n")
        
        context = "\n".join(context_parts) if context_parts else "Aucun document de contexte disponible."
        
        # User prompt with context and question
        user_prompt = f"""Contexte documentaire:
{context}

Question de l'utilisateur: {question}

Réponse:"""
        
        return system_prompt, user_prompt
    
    async def arun(self, question: str, organization_id: str = None, context_docs: List[Document] = None) -> Dict[str, Any]:
        """Run QA chain asynchronously."""
        start_time = time.time()
        
        try:
            # Retrieve relevant documents if not provided (organization-scoped)
            if context_docs is None:
                logger.debug(f"Retrieving relevant documents for org: {organization_id}")
                
                # Enhance the query for better retrieval
                enhanced_query = await query_enhancer.enhance_query(question)
                search_queries = query_enhancer.get_search_queries(enhanced_query, max_queries=3)
                logger.info(f"Enhanced query into {len(search_queries)} search variations")
                
                # Retrieve documents using multiple query variations
                all_docs = []
                for query_variant in search_queries:
                    docs = retriever.similarity_search(query_variant, k=8, organization_id=organization_id)
                    all_docs.extend(docs)
                    logger.debug(f"Query '{query_variant[:50]}...' found {len(docs)} documents")
                
                # Remove duplicates based on document ID
                unique_docs = []
                seen_ids = set()
                for doc in all_docs:
                    doc_id = doc.metadata.get("id")
                    if doc_id not in seen_ids:
                        unique_docs.append(doc)
                        seen_ids.add(doc_id)
                
                logger.info(f"Retrieved {len(unique_docs)} unique documents from enhanced queries")
                
                # Apply reranking to get the most relevant documents
                context_docs = await reranker.rerank(question, unique_docs, top_k=8)
                logger.info(f"Reranked to {len(context_docs)} final context documents")
            
            # Build prompt
            system_prompt, user_prompt = self._build_prompt(question, context_docs)
            
            # Log context information for debugging
            total_context_chars = sum(len(doc.page_content) for doc in context_docs)
            logger.info(f"Context: {len(context_docs)} docs, {total_context_chars} chars total")
            logger.debug(f"Full context sent to LLM: {user_prompt[:500]}...")
            
            # Call Groq API
            logger.debug(f"Calling Groq API with model: {self.model}")
            
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
            
            # Extract answer
            answer = response.choices[0].message.content
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Prepare sources for response
            sources = []
            for doc in context_docs:
                # Show more context in sources (up to 800 chars instead of 300)
                content = doc.page_content
                if len(content) > 800:
                    content = content[:800] + "..."
                    
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
                "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') else None
            }
            
            logger.info(f"Generated answer in {response_time:.2f}s with {len(sources)} sources")
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"Failed to generate answer: {e}")
            
            return {
                "answer": "Désolé, je rencontre actuellement des difficultés téchniques. Veuillez réessayer dans quelques instants.",
                "sources": [],
                "response_time": response_time,
                "error": str(e)
            }
    
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


# Global QA chain instance
qa_chain = GroqQAChain()