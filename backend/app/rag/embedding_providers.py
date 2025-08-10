"""Embedding provider interface and implementations."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import logging
import asyncio
import aiohttp
import json
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""
    
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents."""
        pass
    
    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query."""
        pass
    
    @abstractmethod
    async def embed_query_async(self, text: str) -> List[float]:
        """Async wrapper for embedding query."""
        pass
    
    @abstractmethod
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings."""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Get the model name."""
        pass


class LocalEmbeddingProvider(EmbeddingProvider):
    """Local sentence-transformers embedding provider."""
    
    def __init__(self, model_name: str = None):
        """Initialize with local sentence transformers."""
        # Import the existing embedder
        from app.rag.embedder import HuggingFaceEmbedder
        self._embedder = HuggingFaceEmbedder(model_name)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed documents using local model."""
        return self._embedder.embed_documents(texts)
    
    def embed_query(self, text: str) -> List[float]:
        """Embed query using local model."""
        return self._embedder.embed_query(text)
    
    async def embed_query_async(self, text: str) -> List[float]:
        """Async wrapper for query embedding."""
        return await self._embedder.embed_query_async(text)
    
    def get_embedding_dimension(self) -> int:
        """Get embedding dimension."""
        return self._embedder.get_embedding_dimension()
    
    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._embedder.model_name


class RemoteEmbeddingProvider(EmbeddingProvider):
    """Remote embedding provider for external APIs."""
    
    def __init__(self, api_url: str, api_key: str = None, model_name: str = "text-embedding-3-small"):
        """Initialize remote embedding provider."""
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self._model_name = model_name
        self._dimension = None  # Will be determined on first use
        
        logger.info(f"Initialized remote embedding provider: {api_url}")
    
    async def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to remote embedding API."""
        headers = {
            "Content-Type": "application/json"
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.api_url}/{endpoint}",
                    headers=headers,
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Remote API error {response.status}: {error_text}")
                    
                    result = await response.json()
                    return result
                    
            except aiohttp.ClientError as e:
                logger.error(f"Remote embedding API request failed: {e}")
                raise
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed documents using remote API (sync version)."""
        # Run async method in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._embed_documents_async(texts))
        finally:
            loop.close()
    
    async def _embed_documents_async(self, texts: List[str]) -> List[List[float]]:
        """Embed documents using remote API."""
        if not texts:
            return []
        
        try:
            # Batch process texts to handle API limits
            batch_size = 100  # Adjust based on API limits
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                
                data = {
                    "model": self._model_name,
                    "input": batch
                }
                
                result = await self._make_request("embeddings", data)
                
                # Extract embeddings (assumes OpenAI-compatible format)
                batch_embeddings = [item["embedding"] for item in result["data"]]
                all_embeddings.extend(batch_embeddings)
                
                # Cache dimension on first use
                if self._dimension is None and batch_embeddings:
                    self._dimension = len(batch_embeddings[0])
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Failed to embed documents remotely: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """Embed query using remote API (sync version)."""
        # Run async method in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.embed_query_async(text))
        finally:
            loop.close()
    
    async def embed_query_async(self, text: str) -> List[float]:
        """Embed query using remote API."""
        if not text.strip():
            # Return zero embedding for empty queries
            dimension = self.get_embedding_dimension()
            return [0.0] * dimension
        
        try:
            data = {
                "model": self._model_name,
                "input": [text]
            }
            
            result = await self._make_request("embeddings", data)
            
            # Extract embedding (assumes OpenAI-compatible format)
            embedding = result["data"][0]["embedding"]
            
            # Cache dimension on first use
            if self._dimension is None:
                self._dimension = len(embedding)
            
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to embed query remotely: {e}")
            raise
    
    def get_embedding_dimension(self) -> int:
        """Get embedding dimension."""
        if self._dimension is None:
            # Make a test request to determine dimension
            try:
                test_embedding = self.embed_query("test")
                self._dimension = len(test_embedding)
            except Exception:
                # Fallback to common dimensions
                if "3-small" in self._model_name:
                    self._dimension = 1536
                elif "3-large" in self._model_name:
                    self._dimension = 3072
                else:
                    self._dimension = 1536  # Default fallback
                    
        return self._dimension
    
    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._model_name


def create_embedding_provider() -> EmbeddingProvider:
    """Create embedding provider based on configuration."""
    provider_type = settings.embeddings_provider.lower()
    
    if provider_type == "local":
        logger.info("Using local embedding provider")
        return LocalEmbeddingProvider(settings.embedding_model)
    elif provider_type == "remote":
        # Configure remote provider based on environment variables
        api_url = getattr(settings, 'remote_embeddings_url', None)
        api_key = getattr(settings, 'remote_embeddings_key', None)
        model_name = getattr(settings, 'remote_embeddings_model', 'text-embedding-3-small')
        
        if not api_url:
            logger.warning("Remote embedding provider selected but REMOTE_EMBEDDINGS_URL not set, falling back to local")
            return LocalEmbeddingProvider(settings.embedding_model)
        
        logger.info(f"Using remote embedding provider: {api_url}")
        return RemoteEmbeddingProvider(api_url, api_key, model_name)
    else:
        logger.warning(f"Unknown embedding provider '{provider_type}', falling back to local")
        return LocalEmbeddingProvider(settings.embedding_model)


# Global embedding provider instance
embedding_provider = create_embedding_provider()