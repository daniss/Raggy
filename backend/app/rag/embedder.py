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
    
    def _truncate_text(self, text: str, max_tokens: int = 450) -> str:
        """Truncate text to fit within token limits.
        
        Args:
            text: Input text to truncate
            max_tokens: Maximum number of tokens (approximate)
            
        Returns:
            Truncated text that should fit within token limits
        """
        # Rough approximation: 1 token ≈ 4 characters for most languages
        # For safety, we use 3.5 chars per token to account for longer tokens
        max_chars = int(max_tokens * 3.5)
        
        if len(text) <= max_chars:
            return text
        
        # Try to truncate at sentence boundaries first
        truncated = text[:max_chars]
        
        # Find the last sentence ending
        last_sentence = max(
            truncated.rfind('.'),
            truncated.rfind('!'),
            truncated.rfind('?'),
            truncated.rfind('\n')
        )
        
        if last_sentence > max_chars * 0.7:  # If we found a good sentence boundary
            truncated = truncated[:last_sentence + 1]
        else:
            # Fallback: truncate at word boundary
            last_space = truncated.rfind(' ')
            if last_space > max_chars * 0.8:
                truncated = truncated[:last_space]
        
        logger.debug(f"Truncated text from {len(text)} to {len(truncated)} characters")
        return truncated.strip()
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents with proper error handling and text truncation."""
        try:
            if not self.model:
                self._load_model()
            
            if not texts:
                logger.warning("Empty text list provided for embedding")
                return []
            
            # Process and validate texts
            prefixed_texts = []
            for i, text in enumerate(texts):
                if not text or not text.strip():
                    logger.warning(f"Empty or whitespace-only text at index {i}, skipping")
                    prefixed_texts.append("")
                    continue
                
                # Truncate text to prevent token limit issues
                truncated_text = self._truncate_text(text.strip())
                
                # Add appropriate prefix based on model type
                if self.model_name.startswith("intfloat/multilingual-e5") or self.model_name.startswith("intfloat/e5"):
                    if "instruct" in self.model_name:
                        # Use instruct-specific prompt for better document representation
                        prefixed_text = f"Instruct: Represent this document for retrieval: {truncated_text}"
                        
                        # Double-check final length (instruct prompts are longer)
                        if len(prefixed_text) > 1600:  # ~450 tokens worth
                            # Fallback to shorter prompt
                            prefixed_text = f"passage: {truncated_text}"
                            logger.debug(f"Used fallback prompt for document {i} due to length")
                    else:
                        prefixed_text = f"passage: {truncated_text}"
                else:
                    prefixed_text = truncated_text
                
                prefixed_texts.append(prefixed_text)
            
            # Filter out empty texts
            valid_texts = [(i, text) for i, text in enumerate(prefixed_texts) if text]
            if not valid_texts:
                logger.error("No valid texts to embed after filtering")
                return []
            
            valid_indices, valid_prefixed_texts = zip(*valid_texts)
            
            logger.debug(f"Embedding {len(valid_prefixed_texts)} valid documents (filtered from {len(texts)})")
            
            # Embed with error handling
            try:
                embeddings = self.model.encode(
                    list(valid_prefixed_texts),
                    convert_to_tensor=False,
                    show_progress_bar=len(valid_prefixed_texts) > 10,
                    normalize_embeddings=True,  # Normalize for better similarity computation
                    batch_size=min(32, len(valid_prefixed_texts))  # Optimal batch size
                ).tolist()
            except Exception as embed_error:
                logger.error(f"Model encoding failed: {embed_error}")
                # Try with smaller batch size as fallback
                logger.info("Retrying with batch_size=1 as fallback")
                embeddings = []
                for text in valid_prefixed_texts:
                    try:
                        emb = self.model.encode(
                            [text],
                            convert_to_tensor=False,
                            normalize_embeddings=True
                        )[0].tolist()
                        embeddings.append(emb)
                    except Exception as single_error:
                        logger.error(f"Failed to embed single text: {single_error}")
                        # Create zero embedding as fallback
                        try:
                            dim = self.get_embedding_dimension() if self.model else 1024
                        except Exception:
                            dim = 1024  # Ultimate fallback
                        embeddings.append([0.0] * dim)
            
            # Reconstruct full result list with empty embeddings for filtered texts
            result_embeddings = []
            
            # Create mapping from original indices to embeddings
            embedding_map = {}
            for idx, orig_idx in enumerate(valid_indices):
                if idx < len(embeddings):  # Safety check
                    embedding_map[orig_idx] = embeddings[idx]
            
            # Get dimension safely
            try:
                dim = self.get_embedding_dimension() if self.model else 1024
            except Exception:
                dim = 1024  # Fallback dimension
            
            for i in range(len(texts)):
                if i in embedding_map:
                    result_embeddings.append(embedding_map[i])
                else:
                    # Empty text gets zero embedding
                    result_embeddings.append([0.0] * dim)
                    logger.debug(f"Created zero embedding for empty text at index {i}")
            
            logger.debug(f"Generated embeddings with shape: {len(result_embeddings)}x{len(result_embeddings[0]) if result_embeddings else 0}")
            return result_embeddings
            
        except Exception as e:
            logger.error(f"Failed to embed documents: {e}")
            # Return zero embeddings as ultimate fallback
            dim = self.get_embedding_dimension() if self.model else 1024
            return [[0.0] * dim for _ in texts]
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text with proper error handling and text truncation."""
        try:
            if not self.model:
                self._load_model()
            
            if not text or not text.strip():
                logger.warning("Empty query text provided")
                # Return zero embedding for empty queries
                dim = self.get_embedding_dimension()
                return [0.0] * dim
            
            # Truncate query to prevent token limit issues
            truncated_text = self._truncate_text(text.strip())
            
            # Add E5 query prefix for better performance with E5 models
            # The instruct variant uses more specific prompts for better query representation
            if self.model_name.startswith("intfloat/multilingual-e5") or self.model_name.startswith("intfloat/e5"):
                if "instruct" in self.model_name:
                    # Use instruct-specific prompt for better query representation
                    prefixed_text = f"Instruct: Given a question, retrieve relevant documents that answer the question: {truncated_text}"
                    
                    # Double-check final length (instruct prompts are longer)
                    if len(prefixed_text) > 1600:  # ~450 tokens worth
                        # Fallback to shorter prompt
                        prefixed_text = f"query: {truncated_text}"
                        logger.debug("Used fallback prompt for query due to length")
                else:
                    prefixed_text = f"query: {truncated_text}"
            else:
                prefixed_text = truncated_text
            
            logger.debug(f"Embedding query: {prefixed_text[:100]}...")
            
            try:
                embedding = self.model.encode(
                    [prefixed_text], 
                    convert_to_tensor=False,
                    normalize_embeddings=True
                )[0].tolist()
            except Exception as encode_error:
                logger.error(f"Model encoding failed for query: {encode_error}")
                # Try without instruct prompt as fallback
                if "Instruct:" in prefixed_text:
                    logger.info("Retrying query embedding without instruct prompt")
                    fallback_text = f"query: {truncated_text}" if self.model_name.startswith("intfloat/") else truncated_text
                    embedding = self.model.encode(
                        [fallback_text], 
                        convert_to_tensor=False,
                        normalize_embeddings=True
                    )[0].tolist()
                else:
                    raise encode_error
            
            logger.debug(f"Generated query embedding with shape: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to embed query: {e}")
            # Return zero embedding as fallback instead of raising
            try:
                dim = self.get_embedding_dimension()
                logger.warning(f"Returning zero embedding with dimension {dim} as fallback")
                return [0.0] * dim
            except:
                # Ultimate fallback
                logger.warning("Using default 1024-dimensional zero embedding as ultimate fallback")
                return [0.0] * 1024
    
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