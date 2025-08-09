"""
Concrete implementations of RAG pipeline components.

This module provides the concrete implementations that can be plugged into
the RAG pipeline based on client configuration.
"""

import asyncio
from typing import Dict, Any, List, Optional, AsyncIterator
import logging
import time

from .pipeline import (
    DocumentProcessor, TextSplitter, Embedder, VectorStore, 
    Retriever, Reranker, ResponseGenerator, Document
)
from ..core.client_config import ClientConfig
from ..core.llm_providers import LLMManager, LLMMessage
from ..core.prompt_manager import get_system_prompt, get_answer_generation_prompt

logger = logging.getLogger(__name__)


# Document Processors
class PDFDocumentProcessor(DocumentProcessor):
    """PDF document processor"""
    
    async def process(self, documents: List[Document]) -> List[Document]:
        """Process PDF documents"""
        processed = []
        
        for doc in documents:
            if self.supports(doc.metadata.get('content_type', '')):
                # PDF-specific processing
                processed_doc = Document(
                    content=self._clean_pdf_text(doc.content),
                    metadata={**doc.metadata, 'processed': True, 'processor': 'pdf'},
                    id=doc.id,
                    source=doc.source
                )
                processed.append(processed_doc)
            else:
                processed.append(doc)
        
        return processed
    
    def supports(self, document_type: str) -> bool:
        return document_type in ['application/pdf', 'pdf']
    
    def _clean_pdf_text(self, text: str) -> str:
        """Clean PDF-specific artifacts"""
        # Remove common PDF artifacts
        text = text.replace('\x00', '')  # Null bytes
        text = text.replace('\u00a0', ' ')  # Non-breaking spaces
        
        # Fix common PDF text extraction issues
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            if line:  # Skip empty lines
                cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)


class DocxDocumentProcessor(DocumentProcessor):
    """DOCX document processor"""
    
    async def process(self, documents: List[Document]) -> List[Document]:
        """Process DOCX documents"""
        processed = []
        
        for doc in documents:
            if self.supports(doc.metadata.get('content_type', '')):
                processed_doc = Document(
                    content=self._clean_docx_text(doc.content),
                    metadata={**doc.metadata, 'processed': True, 'processor': 'docx'},
                    id=doc.id,
                    source=doc.source
                )
                processed.append(processed_doc)
            else:
                processed.append(doc)
        
        return processed
    
    def supports(self, document_type: str) -> bool:
        return document_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']
    
    def _clean_docx_text(self, text: str) -> str:
        """Clean DOCX-specific artifacts"""
        # Remove excessive whitespace
        lines = [line.strip() for line in text.split('\n')]
        return '\n'.join(line for line in lines if line)


# Text Splitters
class AdaptiveTextSplitter(TextSplitter):
    """Adaptive text splitter that adjusts chunk size based on content"""
    
    def __init__(self, min_chunk_size: int = 400, max_chunk_size: int = 800, overlap: int = 100):
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap
    
    async def split(self, documents: List[Document]) -> List[Document]:
        """Split documents into adaptive chunks"""
        chunks = []
        
        for doc in documents:
            doc_chunks = self._split_document(doc)
            chunks.extend(doc_chunks)
        
        return chunks
    
    def _split_document(self, document: Document) -> List[Document]:
        """Split a single document"""
        text = document.content
        chunks = []
        
        # Simple sentence-based splitting with overlap
        sentences = self._split_into_sentences(text)
        
        current_chunk = []
        current_size = 0
        
        for sentence in sentences:
            sentence_size = len(sentence)
            
            if current_size + sentence_size > self.max_chunk_size and current_chunk:
                # Create chunk
                chunk_text = ' '.join(current_chunk)
                chunk = Document(
                    content=chunk_text,
                    metadata={
                        **document.metadata,
                        'chunk_id': f"{document.id}_{len(chunks)}",
                        'chunk_size': len(chunk_text),
                        'parent_id': document.id
                    },
                    source=document.source,
                    chunk_id=f"{document.id}_{len(chunks)}"
                )
                chunks.append(chunk)
                
                # Start new chunk with overlap
                overlap_sentences = current_chunk[-self.overlap//100:] if self.overlap > 0 else []
                current_chunk = overlap_sentences + [sentence]
                current_size = sum(len(s) for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_size += sentence_size
        
        # Add final chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunk = Document(
                content=chunk_text,
                metadata={
                    **document.metadata,
                    'chunk_id': f"{document.id}_{len(chunks)}",
                    'chunk_size': len(chunk_text),
                    'parent_id': document.id
                },
                source=document.source,
                chunk_id=f"{document.id}_{len(chunks)}"
            )
            chunks.append(chunk)
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Simple sentence splitting"""
        import re
        
        # Simple sentence boundaries
        sentences = re.split(r'[.!?]+\s+', text)
        return [s.strip() for s in sentences if s.strip()]


# Response Generator
class ConfigurableResponseGenerator(ResponseGenerator):
    """Response generator that uses client configuration"""
    
    def __init__(self, client_config: ClientConfig):
        self.client_config = client_config
        self.llm_manager = self._initialize_llm_manager()
    
    def _initialize_llm_manager(self) -> LLMManager:
        """Initialize LLM manager based on client config"""
        
        rag_config = self.client_config.rag
        
        # Primary provider configuration
        primary_config = {
            "provider": rag_config.provider,
            "api_key": self._get_api_key(rag_config.provider),
            "model": rag_config.model.get("default"),
            "temperature": rag_config.temperature,
            "max_tokens": rag_config.max_tokens,
            "timeout": 30,
            "retry_attempts": 3
        }
        
        # Fallback configurations (if specified)
        fallback_configs = []
        fallback_model = rag_config.model.get("fallback")
        if fallback_model:
            fallback_configs.append({
                "provider": rag_config.provider,
                "api_key": self._get_api_key(rag_config.provider),
                "model": fallback_model,
                "temperature": rag_config.temperature,
                "max_tokens": rag_config.max_tokens,
            })
        
        return LLMManager(primary_config, fallback_configs)
    
    def _get_api_key(self, provider: str) -> str:
        """Get API key for provider from environment"""
        import os
        
        key_mapping = {
            "groq": "GROQ_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }
        
        env_var = key_mapping.get(provider, f"{provider.upper()}_API_KEY")
        api_key = os.getenv(env_var)
        
        if not api_key:
            raise ValueError(f"API key not found for provider {provider} (expected env var: {env_var})")
        
        return api_key
    
    async def generate(
        self,
        query: str,
        context_documents: List[Document],
        client_config: ClientConfig
    ) -> str:
        """Generate response from query and context"""
        
        # Build context from documents
        context = self._build_context(context_documents)
        
        # Get system prompt
        system_prompt = get_system_prompt(client_config.client_id)
        
        # Get answer generation prompt
        answer_prompt = get_answer_generation_prompt(
            context=context,
            query=query,
            client_id=client_config.client_id
        )
        
        # Create messages
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=answer_prompt)
        ]
        
        # Generate response
        response = await self.llm_manager.generate(
            messages=messages,
            temperature=client_config.rag.temperature,
            max_tokens=client_config.rag.max_tokens
        )
        
        return response.content
    
    async def stream_generate(
        self,
        query: str,
        context_documents: List[Document],
        client_config: ClientConfig
    ) -> AsyncIterator[str]:
        """Stream generate response from query and context"""
        
        # Build context from documents
        context = self._build_context(context_documents)
        
        # Get system prompt
        system_prompt = get_system_prompt(client_config.client_id)
        
        # Get answer generation prompt
        answer_prompt = get_answer_generation_prompt(
            context=context,
            query=query,
            client_id=client_config.client_id
        )
        
        # Create messages
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=answer_prompt)
        ]
        
        # Stream response
        async for chunk in self.llm_manager.stream(
            messages=messages,
            temperature=client_config.rag.temperature,
            max_tokens=client_config.rag.max_tokens
        ):
            yield chunk
    
    def _build_context(self, documents: List[Document]) -> str:
        """Build context string from documents"""
        
        if not documents:
            return "Aucun document pertinent trouvé."
        
        context_parts = []
        for i, doc in enumerate(documents, 1):
            source_info = f"Document {i}"
            if doc.source:
                source_info += f" - {doc.source}"
            if doc.page_number:
                source_info += f" (page {doc.page_number})"
            
            context_parts.append(f"[{source_info}]\n{doc.content}\n")
        
        return "\n---\n".join(context_parts)


# Factory for creating implementations
class ComponentFactory:
    """Factory for creating pipeline component implementations"""
    
    _document_processors = {
        "pdf": PDFDocumentProcessor,
        "docx": DocxDocumentProcessor,
    }
    
    _text_splitters = {
        "adaptive": AdaptiveTextSplitter,
    }
    
    _response_generators = {
        "configurable": ConfigurableResponseGenerator,
    }
    
    @classmethod
    def create_document_processor(cls, processor_type: str, **kwargs) -> DocumentProcessor:
        """Create document processor instance"""
        
        processor_class = cls._document_processors.get(processor_type)
        if not processor_class:
            raise ValueError(f"Unknown document processor type: {processor_type}")
        
        return processor_class(**kwargs)
    
    @classmethod
    def create_text_splitter(cls, splitter_type: str, **kwargs) -> TextSplitter:
        """Create text splitter instance"""
        
        splitter_class = cls._text_splitters.get(splitter_type)
        if not splitter_class:
            raise ValueError(f"Unknown text splitter type: {splitter_type}")
        
        return splitter_class(**kwargs)
    
    @classmethod
    def create_response_generator(cls, generator_type: str, client_config: ClientConfig) -> ResponseGenerator:
        """Create response generator instance"""
        
        generator_class = cls._response_generators.get(generator_type)
        if not generator_class:
            raise ValueError(f"Unknown response generator type: {generator_type}")
        
        return generator_class(client_config)
    
    @classmethod
    def register_component(cls, component_type: str, component_name: str, component_class):
        """Register a custom component"""
        
        if component_type == "document_processor":
            cls._document_processors[component_name] = component_class
        elif component_type == "text_splitter":
            cls._text_splitters[component_name] = component_class
        elif component_type == "response_generator":
            cls._response_generators[component_name] = component_class
        else:
            raise ValueError(f"Unknown component type: {component_type}")
    
    @classmethod
    def list_components(cls) -> Dict[str, List[str]]:
        """List all available component implementations"""
        
        return {
            "document_processors": list(cls._document_processors.keys()),
            "text_splitters": list(cls._text_splitters.keys()),
            "response_generators": list(cls._response_generators.keys()),
        }