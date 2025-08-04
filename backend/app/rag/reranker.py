"""Advanced reranking module for improving RAG retrieval relevance."""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import asyncio
import aiohttp
import json

from langchain.schema import Document
from sentence_transformers import CrossEncoder
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RerankResult:
    """Result from reranking process."""
    document: Document
    relevance_score: float
    original_rank: int
    new_rank: int


class CrossEncoderReranker:
    """Cross-encoder based reranker for French/multilingual content."""
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        """Initialize cross-encoder reranker.
        
        Args:
            model_name: HuggingFace model name for cross-encoder
        """
        self.model_name = model_name
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the cross-encoder model."""
        try:
            logger.info(f"Loading cross-encoder model: {self.model_name}")
            self.model = CrossEncoder(self.model_name)
            logger.info("Cross-encoder model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load cross-encoder model: {e}")
            self.model = None
    
    def rerank(self, query: str, documents: List[Document], top_k: int = None) -> List[RerankResult]:
        """Rerank documents based on query relevance.
        
        Args:
            query: The search query
            documents: List of documents to rerank
            top_k: Number of top documents to return (None for all)
            
        Returns:
            List of reranked documents with scores
        """
        if not self.model or not documents:
            logger.warning("Cross-encoder model not available or no documents provided")
            return [
                RerankResult(doc, 0.0, i, i) 
                for i, doc in enumerate(documents[:top_k] if top_k else documents)
            ]
        
        try:
            # Prepare query-document pairs
            pairs = []
            for doc in documents:
                # Truncate document content for cross-encoder (usually max 512 tokens)
                content = doc.page_content[:2000]  # Rough token limit
                pairs.append([query, content])
            
            # Compute relevance scores
            logger.debug(f"Computing cross-encoder scores for {len(pairs)} query-document pairs")
            scores = self.model.predict(pairs)
            
            # Create results with original and new rankings
            results = []
            for i, (doc, score) in enumerate(zip(documents, scores)):
                results.append(RerankResult(
                    document=doc,
                    relevance_score=float(score),
                    original_rank=i,
                    new_rank=0  # Will be set after sorting
                ))
            
            # Sort by relevance score
            results.sort(key=lambda x: x.relevance_score, reverse=True)
            
            # Update new ranks
            for new_rank, result in enumerate(results):
                result.new_rank = new_rank
            
            # Return top_k if specified
            if top_k:
                results = results[:top_k]
            
            logger.info(f"Reranked {len(documents)} documents, returning top {len(results)}")
            return results
            
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            # Return original order with zero scores
            return [
                RerankResult(doc, 0.0, i, i) 
                for i, doc in enumerate(documents[:top_k] if top_k else documents)
            ]


class LLMReranker:
    """LLM-based reranker using the same Groq API for consistency."""
    
    def __init__(self):
        """Initialize LLM reranker."""
        from groq import Groq
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = settings.groq_model
    
    async def rerank(self, query: str, documents: List[Document], top_k: int = None) -> List[RerankResult]:
        """Rerank documents using LLM scoring.
        
        Args:
            query: The search query  
            documents: List of documents to rerank
            top_k: Number of top documents to return
            
        Returns:
            List of reranked documents with scores
        """
        if not documents:
            return []
        
        try:
            # Batch documents for LLM evaluation (process in groups of 5)
            batch_size = 5
            all_results = []
            
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                batch_results = await self._score_batch(query, batch, i)
                all_results.extend(batch_results)
            
            # Sort by relevance score
            all_results.sort(key=lambda x: x.relevance_score, reverse=True)
            
            # Update new ranks
            for new_rank, result in enumerate(all_results):
                result.new_rank = new_rank
            
            # Return top_k if specified
            if top_k:
                all_results = all_results[:top_k]
            
            logger.info(f"LLM reranked {len(documents)} documents, returning top {len(all_results)}")
            return all_results
            
        except Exception as e:
            logger.error(f"LLM reranking failed: {e}")
            # Return original order
            return [
                RerankResult(doc, 0.0, i, i) 
                for i, doc in enumerate(documents[:top_k] if top_k else documents)
            ]
    
    async def _score_batch(self, query: str, documents: List[Document], start_idx: int) -> List[RerankResult]:
        """Score a batch of documents."""
        # Prepare document summaries for LLM
        doc_summaries = []
        for i, doc in enumerate(documents):
            content = doc.page_content[:500]  # Truncate for LLM context
            doc_summaries.append(f"Document {i+1}: {content}")
        
        prompt = f"""Vous êtes un expert en évaluation de pertinence de documents. 
Évaluez la pertinence de chaque document par rapport à la question posée.

Question: {query}

Documents:
{chr(10).join(doc_summaries)}

Pour chaque document, donnez un score de pertinence de 0 à 10:
- 0-2: Non pertinent
- 3-5: Peu pertinent  
- 6-7: Modérément pertinent
- 8-10: Très pertinent

Répondez uniquement avec les scores séparés par des virgules (ex: 8,3,7,2,9)."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=100
            )
            
            # Parse scores from response
            scores_text = response.choices[0].message.content.strip()
            scores = [float(s.strip()) for s in scores_text.split(',')]
            
            # Ensure we have the right number of scores
            if len(scores) != len(documents):
                logger.warning(f"Expected {len(documents)} scores, got {len(scores)}")
                scores = scores[:len(documents)] + [0.0] * (len(documents) - len(scores))
            
            # Create results
            results = []
            for i, (doc, score) in enumerate(zip(documents, scores)):
                results.append(RerankResult(
                    document=doc,
                    relevance_score=score / 10.0,  # Normalize to 0-1
                    original_rank=start_idx + i,
                    new_rank=0  # Will be set later
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"LLM scoring failed: {e}")
            # Return default scores
            return [
                RerankResult(doc, 0.5, start_idx + i, 0) 
                for i, doc in enumerate(documents)
            ]


class HybridReranker:
    """Hybrid reranker combining multiple reranking strategies."""
    
    def __init__(self, use_cross_encoder: bool = True, use_llm: bool = True):
        """Initialize hybrid reranker.
        
        Args:
            use_cross_encoder: Whether to use cross-encoder reranking
            use_llm: Whether to use LLM-based reranking
        """
        self.use_cross_encoder = use_cross_encoder
        self.use_llm = use_llm
        
        self.cross_encoder = None
        if use_cross_encoder:
            try:
                self.cross_encoder = CrossEncoderReranker()
            except Exception as e:
                logger.warning(f"Cross-encoder initialization failed: {e}")
        
        self.llm_reranker = None
        if use_llm:
            try:
                self.llm_reranker = LLMReranker()
            except Exception as e:
                logger.warning(f"LLM reranker initialization failed: {e}")
    
    async def rerank(self, query: str, documents: List[Document], top_k: int = 8) -> List[Document]:
        """Perform hybrid reranking.
        
        Args:
            query: The search query
            documents: List of documents to rerank
            top_k: Number of top documents to return
            
        Returns:
            List of reranked documents
        """
        if not documents:
            return []
        
        logger.info(f"Starting hybrid reranking for {len(documents)} documents")
        
        try:
            # Start with cross-encoder if available
            if self.cross_encoder:
                cross_results = self.cross_encoder.rerank(query, documents, top_k * 2)
                # Use cross-encoder results as base
                working_docs = [r.document for r in cross_results]
                logger.debug(f"Cross-encoder selected {len(working_docs)} documents")
            else:
                working_docs = documents[:top_k * 2]
            
            # Apply LLM reranking if available
            if self.llm_reranker and len(working_docs) > 1:
                llm_results = await self.llm_reranker.rerank(query, working_docs, top_k)
                final_docs = [r.document for r in llm_results]
                
                # Add hybrid reranking metadata
                for i, doc in enumerate(final_docs):
                    doc.metadata["rerank_score"] = llm_results[i].relevance_score
                    doc.metadata["rerank_method"] = "hybrid"
                    doc.metadata["final_rank"] = i
                
                logger.info(f"Hybrid reranking completed, returning {len(final_docs)} documents")
                return final_docs
            else:
                # Return cross-encoder results only
                final_docs = working_docs[:top_k]
                for i, doc in enumerate(final_docs):
                    doc.metadata["rerank_method"] = "cross_encoder_only"
                    doc.metadata["final_rank"] = i
                
                return final_docs
                
        except Exception as e:
            logger.error(f"Hybrid reranking failed: {e}")
            # Return original order as fallback
            fallback_docs = documents[:top_k]
            for i, doc in enumerate(fallback_docs):
                doc.metadata["rerank_method"] = "none"
                doc.metadata["final_rank"] = i
            
            return fallback_docs


# Global reranker instance
reranker = HybridReranker(use_cross_encoder=True, use_llm=False)  # Start with cross-encoder only