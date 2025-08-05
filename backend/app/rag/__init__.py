"""RAG (Retrieval-Augmented Generation) module for the support chatbot."""

from .embedder import embedder, HuggingFaceEmbedder
from .loader import document_loader, DocumentLoader
from .splitter import document_splitter, DocumentSplitter
from .adaptive_splitter import adaptive_splitter, AdaptiveDocumentSplitter
from .retriever import retriever
from .supabase_retriever import supabase_retriever, SupabaseRetriever
from .hybrid_retriever import hybrid_retriever, HybridRetriever
from .reranker import reranker, HybridReranker
from .qa import qa_chain, GroqQAChain

# Use hybrid retriever as default for best performance
retriever = hybrid_retriever

__all__ = [
    "embedder",
    "HuggingFaceEmbedder",
    "document_loader",
    "DocumentLoader",
    "document_splitter",
    "DocumentSplitter",
    "adaptive_splitter",
    "AdaptiveDocumentSplitter",
    "retriever",
    "supabase_retriever",
    "SupabaseRetriever",
    "hybrid_retriever",
    "HybridRetriever",
    "reranker",
    "HybridReranker",
    "qa_chain",
    "GroqQAChain",
]