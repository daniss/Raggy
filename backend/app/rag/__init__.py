"""RAG (Retrieval-Augmented Generation) module for the consulting platform."""

from .embedder import embedder, HuggingFaceEmbedder
from .loader import document_loader, DocumentLoader
from .splitter import document_splitter, DocumentSplitter
from .supabase_retriever import supabase_retriever, SupabaseRetriever
from .qa_fast import qa_chain, GroqQAChain
from .pipeline import get_rag_pipeline, PipelineFactory

# Use supabase retriever as default
retriever = supabase_retriever

__all__ = [
    "embedder",
    "HuggingFaceEmbedder", 
    "document_loader",
    "DocumentLoader",
    "document_splitter",
    "DocumentSplitter",
    "retriever",
    "supabase_retriever",
    "SupabaseRetriever",
    "qa_chain",
    "GroqQAChain",
    "get_rag_pipeline",
    "PipelineFactory",
]