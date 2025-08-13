"""Embedding providers for different services."""

import logging
from typing import List
from app.rag.embedder import embedder

logger = logging.getLogger(__name__)


class EmbeddingProvider:
    """Simple wrapper around the embedder."""
    
    def __init__(self):
        self.embedder = embedder
        
    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query."""
        try:
            return await self.embedder.embed_query(query)
        except Exception as e:
            logger.error(f"Failed to embed query: {e}")
            raise
    
    async def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Embed multiple documents."""
        try:
            return await self.embedder.embed_documents(documents)
        except Exception as e:
            logger.error(f"Failed to embed documents: {e}")
            raise


# Global instance
embedding_provider = EmbeddingProvider()