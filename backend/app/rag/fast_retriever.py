"""Optimized retriever for faster response times."""

import logging
from typing import List, Dict, Any, Optional
from langchain.schema import Document
from app.rag.supabase_retriever import SupabaseRetriever
from app.core.config import settings

logger = logging.getLogger(__name__)


class FastRetriever:
    """Fast retriever optimized for low-latency responses."""
    
    def __init__(self):
        """Initialize fast retriever."""
        self.dense_retriever = SupabaseRetriever()
        
    def similarity_search(self, query: str, k: int = 5, 
                         organization_id: Optional[str] = None) -> List[Document]:
        """Perform fast similarity search.
        
        In fast mode, only uses dense vector search (no BM25) for lower latency.
        """
        try:
            if settings.fast_mode:
                # Fast mode: Only dense vector search
                logger.info(f"Fast mode: Performing dense-only search for: {query[:50]}...")
                return self.dense_retriever.similarity_search(
                    query, k=k, organization_id=organization_id
                )
            else:
                # Fall back to hybrid search if not in fast mode
                from app.rag.hybrid_retriever import hybrid_retriever
                logger.info(f"Normal mode: Performing hybrid search for: {query[:50]}...")
                return hybrid_retriever.similarity_search(
                    query, k=k, organization_id=organization_id
                )
                
        except Exception as e:
            logger.error(f"Fast retriever search failed: {e}")
            return []
    
    def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to the vector store."""
        return self.dense_retriever.add_documents(documents)
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector collection."""
        return self.dense_retriever.get_collection_stats()


# Global fast retriever instance
fast_retriever = FastRetriever()