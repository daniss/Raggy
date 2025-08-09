"""
Modular RAG Pipeline System

This module provides a pluggable RAG pipeline architecture that can be customized
per client with different components, configurations, and behaviors.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, AsyncIterator, Protocol
from dataclasses import dataclass
from enum import Enum
import logging
import asyncio
from pathlib import Path

from ..core.client_config import get_client_config, ClientConfig
from ..core.llm_providers import LLMManager, LLMMessage, LLMResponse
from ..core.prompt_manager import get_system_prompt, get_answer_generation_prompt

logger = logging.getLogger(__name__)


class PipelineStage(Enum):
    """RAG pipeline stages"""
    DOCUMENT_LOADING = "document_loading"
    TEXT_PROCESSING = "text_processing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    QUERY_PROCESSING = "query_processing"
    RETRIEVAL = "retrieval"
    RERANKING = "reranking"
    RESPONSE_GENERATION = "response_generation"
    POST_PROCESSING = "post_processing"


@dataclass
class Document:
    """Standardized document representation"""
    content: str
    metadata: Dict[str, Any]
    id: Optional[str] = None
    source: Optional[str] = None
    page_number: Optional[int] = None
    chunk_id: Optional[str] = None


@dataclass
class QueryResult:
    """RAG query result"""
    query: str
    answer: str
    sources: List[Document]
    confidence: float
    metadata: Dict[str, Any]
    processing_time: float


class DocumentProcessor(ABC):
    """Abstract document processor"""
    
    @abstractmethod
    async def process(self, documents: List[Document]) -> List[Document]:
        """Process documents and return processed versions"""
        pass
    
    @abstractmethod
    def supports(self, document_type: str) -> bool:
        """Check if this processor supports the document type"""
        pass


class TextSplitter(ABC):
    """Abstract text splitter"""
    
    @abstractmethod
    async def split(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks"""
        pass


class Embedder(ABC):
    """Abstract embedder"""
    
    @abstractmethod
    async def embed_documents(self, documents: List[Document]) -> List[List[float]]:
        """Generate embeddings for documents"""
        pass
    
    @abstractmethod
    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a query"""
        pass


class VectorStore(ABC):
    """Abstract vector store"""
    
    @abstractmethod
    async def add_documents(self, documents: List[Document], embeddings: List[List[float]]):
        """Add documents with embeddings to the store"""
        pass
    
    @abstractmethod
    async def similarity_search(
        self, 
        query_embedding: List[float], 
        k: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Document]:
        """Perform similarity search"""
        pass
    
    @abstractmethod
    async def hybrid_search(
        self,
        query: str,
        query_embedding: List[float],
        k: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Document]:
        """Perform hybrid search (vector + keyword)"""
        pass


class Retriever(ABC):
    """Abstract retriever"""
    
    @abstractmethod
    async def retrieve(
        self, 
        query: str, 
        k: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Document]:
        """Retrieve relevant documents for a query"""
        pass


class Reranker(ABC):
    """Abstract reranker"""
    
    @abstractmethod
    async def rerank(
        self, 
        query: str, 
        documents: List[Document],
        top_k: int = 5
    ) -> List[Document]:
        """Rerank documents by relevance to query"""
        pass


class ResponseGenerator(ABC):
    """Abstract response generator"""
    
    @abstractmethod
    async def generate(
        self,
        query: str,
        context_documents: List[Document],
        client_config: ClientConfig
    ) -> str:
        """Generate response from query and context"""
        pass
    
    @abstractmethod
    async def stream_generate(
        self,
        query: str,
        context_documents: List[Document],
        client_config: ClientConfig
    ) -> AsyncIterator[str]:
        """Stream generate response from query and context"""
        pass


class RAGPipeline:
    """
    Modular RAG pipeline that can be configured per client.
    Supports pluggable components and client-specific configurations.
    """
    
    def __init__(self, client_id: str):
        self.client_id = client_id
        self.client_config = get_client_config(client_id)
        
        # Initialize components based on configuration
        self.document_processors: List[DocumentProcessor] = []
        self.text_splitter: Optional[TextSplitter] = None
        self.embedder: Optional[Embedder] = None
        self.vector_store: Optional[VectorStore] = None
        self.retriever: Optional[Retriever] = None
        self.reranker: Optional[Reranker] = None
        self.response_generator: Optional[ResponseGenerator] = None
        
        # Performance monitoring
        self.stage_timings: Dict[PipelineStage, float] = {}
        
        self._initialize_pipeline()
    
    def _initialize_pipeline(self):
        """Initialize pipeline components based on client configuration"""
        
        # Load component configurations
        rag_config = self.client_config.rag
        
        # Initialize components based on configuration
        # This is where we'd load different implementations based on client needs
        logger.info(f"Initializing RAG pipeline for client {self.client_id}")
        logger.info(f"RAG strategy: {rag_config.retrieval_strategy}")
        logger.info(f"Embedding model: {rag_config.embedding_model}")
        logger.info(f"LLM provider: {rag_config.provider}")
    
    async def add_documents(self, documents: List[Document]) -> Dict[str, Any]:
        """Add documents to the RAG system"""
        import time
        
        results = {
            "processed_documents": 0,
            "total_chunks": 0,
            "processing_time": 0,
            "errors": []
        }
        
        start_time = time.time()
        
        try:
            # Stage 1: Document Processing
            processed_docs = documents
            for processor in self.document_processors:
                processed_docs = await processor.process(processed_docs)
            
            # Stage 2: Text Splitting
            if self.text_splitter:
                chunks = await self.text_splitter.split(processed_docs)
            else:
                chunks = processed_docs
            
            # Stage 3: Generate Embeddings
            if self.embedder:
                embeddings = await self.embedder.embed_documents(chunks)
            else:
                embeddings = []
            
            # Stage 4: Store in Vector Store
            if self.vector_store and embeddings:
                await self.vector_store.add_documents(chunks, embeddings)
            
            results["processed_documents"] = len(documents)
            results["total_chunks"] = len(chunks)
            results["processing_time"] = time.time() - start_time
            
        except Exception as e:
            logger.error(f"Error adding documents to pipeline: {e}")
            results["errors"].append(str(e))
        
        return results
    
    async def query(
        self, 
        query: str, 
        k: int = None,
        stream: bool = False,
        **kwargs
    ) -> QueryResult:
        """Query the RAG system"""
        import time
        
        start_time = time.time()
        
        # Use client-specific defaults
        if k is None:
            k = self.client_config.rag.top_k
        
        try:
            # Stage 1: Query Processing & Enhancement
            processed_query = await self._process_query(query)
            
            # Stage 2: Retrieval
            if self.retriever:
                documents = await self.retriever.retrieve(processed_query, k=k, **kwargs)
            else:
                documents = []
            
            # Stage 3: Reranking (if enabled and configured)
            if self.reranker and self.client_config.rag.reranking_enabled:
                documents = await self.reranker.rerank(
                    processed_query, 
                    documents,
                    top_k=min(k, len(documents))
                )
            
            # Stage 4: Response Generation
            if self.response_generator:
                if stream:
                    # For streaming, we need to handle differently
                    response = ""
                    async for chunk in self.response_generator.stream_generate(
                        processed_query, documents, self.client_config
                    ):
                        response += chunk
                        yield chunk
                else:
                    response = await self.response_generator.generate(
                        processed_query, documents, self.client_config
                    )
            else:
                response = "No response generator configured"
            
            processing_time = time.time() - start_time
            
            result = QueryResult(
                query=query,
                answer=response,
                sources=documents,
                confidence=self._calculate_confidence(documents),
                metadata={
                    "processed_query": processed_query,
                    "num_sources": len(documents),
                    "client_id": self.client_id,
                    "pipeline_config": {
                        "retrieval_strategy": self.client_config.rag.retrieval_strategy,
                        "reranking_enabled": self.client_config.rag.reranking_enabled,
                        "query_enhancement": self.client_config.rag.query_enhancement_enabled
                    }
                },
                processing_time=processing_time
            )
            
            if not stream:
                return result
            
        except Exception as e:
            logger.error(f"Error in RAG query pipeline: {e}")
            
            error_result = QueryResult(
                query=query,
                answer=f"Je suis désolé, une erreur s'est produite lors du traitement de votre question: {str(e)}",
                sources=[],
                confidence=0.0,
                metadata={"error": str(e), "client_id": self.client_id},
                processing_time=time.time() - start_time
            )
            
            if not stream:
                return error_result
    
    async def _process_query(self, query: str) -> str:
        """Process and potentially enhance the query"""
        
        # Query enhancement if enabled
        if self.client_config.rag.query_enhancement_enabled:
            # TODO: Implement query enhancement
            pass
        
        return query
    
    def _calculate_confidence(self, documents: List[Document]) -> float:
        """Calculate confidence score based on retrieved documents"""
        
        if not documents:
            return 0.0
        
        # Simple confidence calculation based on number and quality of sources
        # This could be made more sophisticated
        base_confidence = min(len(documents) * 0.1, 0.8)
        
        # Adjust based on document metadata if available
        # TODO: Use actual relevance scores from retrieval/reranking
        
        return base_confidence
    
    def register_component(self, component: Any, stage: PipelineStage):
        """Register a custom component for a specific pipeline stage"""
        
        if stage == PipelineStage.DOCUMENT_LOADING:
            if isinstance(component, DocumentProcessor):
                self.document_processors.append(component)
        elif stage == PipelineStage.CHUNKING:
            if isinstance(component, TextSplitter):
                self.text_splitter = component
        elif stage == PipelineStage.EMBEDDING:
            if isinstance(component, Embedder):
                self.embedder = component
        elif stage == PipelineStage.RETRIEVAL:
            if isinstance(component, Retriever):
                self.retriever = component
        elif stage == PipelineStage.RERANKING:
            if isinstance(component, Reranker):
                self.reranker = component
        elif stage == PipelineStage.RESPONSE_GENERATION:
            if isinstance(component, ResponseGenerator):
                self.response_generator = component
        else:
            logger.warning(f"Unknown pipeline stage: {stage}")
    
    def get_pipeline_info(self) -> Dict[str, Any]:
        """Get information about the current pipeline configuration"""
        
        return {
            "client_id": self.client_id,
            "components": {
                "document_processors": len(self.document_processors),
                "text_splitter": self.text_splitter.__class__.__name__ if self.text_splitter else None,
                "embedder": self.embedder.__class__.__name__ if self.embedder else None,
                "vector_store": self.vector_store.__class__.__name__ if self.vector_store else None,
                "retriever": self.retriever.__class__.__name__ if self.retriever else None,
                "reranker": self.reranker.__class__.__name__ if self.reranker else None,
                "response_generator": self.response_generator.__class__.__name__ if self.response_generator else None,
            },
            "configuration": {
                "retrieval_strategy": self.client_config.rag.retrieval_strategy,
                "embedding_model": self.client_config.rag.embedding_model,
                "llm_provider": self.client_config.rag.provider,
                "top_k": self.client_config.rag.top_k,
                "reranking_enabled": self.client_config.rag.reranking_enabled,
                "query_enhancement": self.client_config.rag.query_enhancement_enabled,
            },
            "stage_timings": self.stage_timings
        }


class PipelineFactory:
    """Factory for creating RAG pipelines with different configurations"""
    
    _pipelines: Dict[str, RAGPipeline] = {}
    
    @classmethod
    def get_pipeline(cls, client_id: str) -> RAGPipeline:
        """Get or create a RAG pipeline for a client"""
        
        if client_id not in cls._pipelines:
            cls._pipelines[client_id] = RAGPipeline(client_id)
        
        return cls._pipelines[client_id]
    
    @classmethod
    def create_custom_pipeline(
        cls,
        client_id: str,
        components: Dict[PipelineStage, Any]
    ) -> RAGPipeline:
        """Create a custom pipeline with specific components"""
        
        pipeline = RAGPipeline(client_id)
        
        for stage, component in components.items():
            pipeline.register_component(component, stage)
        
        cls._pipelines[client_id] = pipeline
        return pipeline
    
    @classmethod
    def list_pipelines(cls) -> List[str]:
        """List all active pipeline client IDs"""
        return list(cls._pipelines.keys())
    
    @classmethod
    def clear_pipeline(cls, client_id: str):
        """Clear/reset a pipeline for a client"""
        if client_id in cls._pipelines:
            del cls._pipelines[client_id]


# Convenience function for getting client pipeline
def get_rag_pipeline(client_id: str) -> RAGPipeline:
    """Get RAG pipeline for a client"""
    return PipelineFactory.get_pipeline(client_id)