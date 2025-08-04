"""Hybrid retriever combining dense vector search with sparse BM25 retrieval."""

import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import math
import re

from langchain.schema import Document
from app.rag.supabase_retriever import SupabaseRetriever
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)


class BM25Retriever:
    """BM25 sparse retrieval implementation."""
    
    def __init__(self, k1: float = 1.2, b: float = 0.75):
        """Initialize BM25 retriever.
        
        Args:
            k1: Controls term frequency saturation
            b: Controls document length normalization
        """
        self.k1 = k1
        self.b = b
        self.supabase = supabase_client
        
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization for French text."""
        # French-aware tokenization with accented characters
        text = text.lower()
        # Keep French accented characters and apostrophes
        tokens = re.findall(r"[a-zA-ZàâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ']+", text)
        return tokens
    
    def _compute_bm25_scores(self, query_tokens: List[str], documents: List[Dict], 
                           doc_frequencies: Dict[str, int], total_docs: int) -> List[float]:
        """Compute BM25 scores for documents."""
        scores = []
        
        # Calculate average document length
        doc_lengths = [len(self._tokenize(doc.get('content', ''))) for doc in documents]
        avg_doc_length = sum(doc_lengths) / len(doc_lengths) if doc_lengths else 1
        
        for i, doc in enumerate(documents):
            doc_tokens = self._tokenize(doc.get('content', ''))
            doc_length = len(doc_tokens)
            
            # Count term frequencies in document
            tf = defaultdict(int)
            for token in doc_tokens:
                tf[token] += 1
            
            score = 0.0
            for token in query_tokens:
                if token in tf:
                    # Term frequency component
                    tf_component = (tf[token] * (self.k1 + 1)) / (
                        tf[token] + self.k1 * (1 - self.b + self.b * (doc_length / avg_doc_length))
                    )
                    
                    # Inverse document frequency component
                    df = doc_frequencies.get(token, 0)
                    if df > 0:
                        idf = math.log((total_docs - df + 0.5) / (df + 0.5))
                        score += idf * tf_component
            
            scores.append(score)
        
        return scores
    
    def search(self, query: str, k: int = 10, organization_id: Optional[str] = None) -> List[Document]:
        """Perform BM25 search."""
        try:
            query_tokens = self._tokenize(query)
            if not query_tokens:
                return []
            
            # Get all documents for the organization
            query_builder = self.supabase.table("document_vectors").select("*")
            if organization_id:
                # Join with documents table for organization filtering
                query_builder = self.supabase.table("document_vectors").select(
                    "*, documents!inner(organization_id)"
                ).eq("documents.organization_id", organization_id)
            
            result = query_builder.execute()
            
            if not result.data:
                return []
            
            documents = result.data
            
            # Pre-compute document frequencies for IDF calculation
            doc_frequencies = defaultdict(int)
            total_docs = len(documents)
            
            for doc in documents:
                doc_tokens = set(self._tokenize(doc.get('content', '')))
                for token in doc_tokens:
                    doc_frequencies[token] += 1
            
            # Compute BM25 scores
            scores = self._compute_bm25_scores(query_tokens, documents, doc_frequencies, total_docs)
            
            # Sort by score and get top k
            scored_docs = list(zip(documents, scores))
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            
            # Convert to Document objects
            results = []
            for doc, score in scored_docs[:k]:
                if score > 0:  # Only include documents with positive scores
                    document = Document(
                        page_content=doc["content"],
                        metadata={
                            **doc["metadata"],
                            "id": doc["id"],
                            "document_id": doc["document_id"],
                            "chunk_index": doc["chunk_index"],
                            "bm25_score": score
                        }
                    )
                    results.append(document)
            
            logger.info(f"BM25 search found {len(results)} results for query: {query[:50]}...")
            return results
            
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            return []


class HybridRetriever:
    """Hybrid retriever combining dense vector search with sparse BM25."""
    
    def __init__(self, dense_weight: float = 0.7, sparse_weight: float = 0.3):
        """Initialize hybrid retriever.
        
        Args:
            dense_weight: Weight for dense vector search results
            sparse_weight: Weight for sparse BM25 search results
        """
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight
        self.dense_retriever = SupabaseRetriever()
        self.sparse_retriever = BM25Retriever()
        
    def _normalize_scores(self, documents: List[Document], score_key: str) -> List[Document]:
        """Normalize scores to 0-1 range."""
        if not documents:
            return documents
            
        scores = [doc.metadata.get(score_key, 0.0) for doc in documents]
        max_score = max(scores) if scores else 1.0
        min_score = min(scores) if scores else 0.0
        
        if max_score == min_score:
            return documents
            
        for doc in documents:
            original_score = doc.metadata.get(score_key, 0.0)
            normalized_score = (original_score - min_score) / (max_score - min_score)
            doc.metadata[f"{score_key}_normalized"] = normalized_score
            
        return documents
    
    def _merge_results(self, dense_docs: List[Document], sparse_docs: List[Document], 
                      k: int) -> List[Document]:
        """Merge and rank results from dense and sparse retrievers."""
        # Normalize scores
        dense_docs = self._normalize_scores(dense_docs, "similarity")
        sparse_docs = self._normalize_scores(sparse_docs, "bm25_score")
        
        # Create a combined ranking
        doc_scores = {}
        
        # Add dense results
        for doc in dense_docs:
            doc_id = doc.metadata.get("id")
            similarity = doc.metadata.get("similarity_normalized", 0.0)
            doc_scores[doc_id] = {
                "document": doc,
                "dense_score": similarity,
                "sparse_score": 0.0,
                "combined_score": self.dense_weight * similarity
            }
        
        # Add sparse results
        for doc in sparse_docs:
            doc_id = doc.metadata.get("id")
            bm25_score = doc.metadata.get("bm25_score_normalized", 0.0)
            
            if doc_id in doc_scores:
                # Document found in both - update sparse score
                doc_scores[doc_id]["sparse_score"] = bm25_score
                doc_scores[doc_id]["combined_score"] = (
                    self.dense_weight * doc_scores[doc_id]["dense_score"] +
                    self.sparse_weight * bm25_score
                )
            else:
                # Document only in sparse results
                doc_scores[doc_id] = {
                    "document": doc,
                    "dense_score": 0.0,
                    "sparse_score": bm25_score,
                    "combined_score": self.sparse_weight * bm25_score
                }
        
        # Sort by combined score
        sorted_results = sorted(
            doc_scores.values(),
            key=lambda x: x["combined_score"],
            reverse=True
        )
        
        # Prepare final results with hybrid scores
        final_results = []
        for result in sorted_results[:k]:
            doc = result["document"]
            doc.metadata.update({
                "hybrid_score": result["combined_score"],
                "dense_contribution": result["dense_score"],
                "sparse_contribution": result["sparse_score"]
            })
            final_results.append(doc)
        
        return final_results
    
    def similarity_search(self, query: str, k: int = 10, 
                         organization_id: Optional[str] = None) -> List[Document]:
        """Perform hybrid search combining dense and sparse retrieval."""
        try:
            logger.info(f"Performing hybrid search for: {query[:50]}...")
            
            # Retrieve more documents from each method to ensure good coverage
            retrieve_k = max(k * 2, 20)
            
            # Perform dense vector search
            logger.debug("Performing dense vector search...")
            dense_docs = self.dense_retriever.similarity_search(
                query, k=retrieve_k, organization_id=organization_id
            )
            
            # Perform sparse BM25 search
            logger.debug("Performing sparse BM25 search...")
            sparse_docs = self.sparse_retriever.search(
                query, k=retrieve_k, organization_id=organization_id
            )
            
            # Merge and rank results
            logger.debug("Merging and ranking results...")
            final_results = self._merge_results(dense_docs, sparse_docs, k)
            
            logger.info(f"Hybrid search returned {len(final_results)} results "
                       f"(dense: {len(dense_docs)}, sparse: {len(sparse_docs)})")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            # Fallback to dense search only
            return self.dense_retriever.similarity_search(
                query, k=k, organization_id=organization_id
            )


# Global hybrid retriever instance
hybrid_retriever = HybridRetriever()