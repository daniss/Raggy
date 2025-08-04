import torch
from sentence_transformers import SentenceTransformer
from typing import List
import logging
import asyncio
from app.core.config import settings

logger = logging.getLogger(__name__)


class HuggingFaceEmbedder:
    """HuggingFace sentence transformer embeddings."""
    
    def __init__(self, model_name: str = None):
        """Initialize the embedder with specified model."""
        self.model_name = model_name or settings.embedding_model
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model."""
        try:
            logger.info(f"Loading embedding model: {self.model_name} on {self.device}")
            self.model = SentenceTransformer(
                self.model_name,
                device=self.device
            )
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents."""
        try:
            if not self.model:
                self._load_model()
            
            # Add E5 passage prefix for better performance with E5 models
            prefixed_texts = []
            for text in texts:
                if self.model_name.startswith("intfloat/multilingual-e5") or self.model_name.startswith("intfloat/e5"):
                    prefixed_texts.append(f"passage: {text}")
                else:
                    prefixed_texts.append(text)
            
            logger.debug(f"Embedding {len(prefixed_texts)} documents")
            embeddings = self.model.encode(
                prefixed_texts,
                convert_to_tensor=False,
                show_progress_bar=len(prefixed_texts) > 10,
                normalize_embeddings=True  # Normalize for better similarity computation
            ).tolist()
            
            logger.debug(f"Generated embeddings with shape: {len(embeddings)}x{len(embeddings[0])}")
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to embed documents: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text."""
        try:
            if not self.model:
                self._load_model()
            
            # Add E5 query prefix for better performance with E5 models
            if self.model_name.startswith("intfloat/multilingual-e5") or self.model_name.startswith("intfloat/e5"):
                prefixed_text = f"query: {text}"
            else:
                prefixed_text = text
            
            logger.debug(f"Embedding query: {prefixed_text[:100]}...")
            embedding = self.model.encode(
                [prefixed_text], 
                convert_to_tensor=False,
                normalize_embeddings=True
            )[0].tolist()
            
            logger.debug(f"Generated query embedding with shape: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to embed query: {e}")
            raise
    
    async def embed_query_async(self, text: str) -> List[float]:
        """Async wrapper for embedding query."""
        # Check cache first
        try:
            from app.rag.advanced_cache import advanced_cache
            cached_embedding = await advanced_cache.get_embedding(text, self.model_name)
            if cached_embedding:
                return cached_embedding
        except ImportError:
            pass  # Cache not available
        
        # Run embedding in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(None, self.embed_query, text)
        
        # Cache the result
        try:
            from app.rag.advanced_cache import advanced_cache
            await advanced_cache.set_embedding(text, self.model_name, embedding)
        except ImportError:
            pass  # Cache not available
        
        return embedding
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings."""
        if not self.model:
            self._load_model()
        return self.model.get_sentence_embedding_dimension()


# Global embedder instance
embedder = HuggingFaceEmbedder()