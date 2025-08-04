"""Semantic document splitter with French language support."""

import logging
from typing import List, Dict, Any, Optional
import re
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import nltk
from nltk.tokenize import sent_tokenize
from app.core.config import settings

logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    try:
        nltk.download('punkt', quiet=True)
    except Exception as e:
        logger.warning(f"Could not download NLTK punkt tokenizer: {e}")

try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    try:
        nltk.download('punkt_tab', quiet=True)
    except Exception as e:
        logger.warning(f"Could not download NLTK punkt_tab tokenizer: {e}")


class SemanticSplitter:
    """Semantic document splitter optimized for French text."""
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None, 
                 language: str = "french"):
        """Initialize semantic splitter.
        
        Args:
            chunk_size: Target chunk size in characters
            chunk_overlap: Overlap between chunks in characters
            language: Language for sentence tokenization
        """
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        self.language = language
        
        # French-specific patterns for better splitting
        self.french_patterns = {
            # Document structure markers
            'headers': re.compile(r'^(#{1,6}\s+.*|[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ][^.!?]*:)$', re.MULTILINE),
            'numbered_lists': re.compile(r'^\d+\.\s+', re.MULTILINE),
            'bullet_points': re.compile(r'^[\-\*•]\s+', re.MULTILINE),
            
            # French meal plan specific patterns
            'meal_sections': re.compile(r'^(PD|DJ|DN)\s*$', re.MULTILINE),
            'meal_times': re.compile(r'^\d{2}:\d{2}\s*$', re.MULTILINE),
            'ingredients': re.compile(r'^Ingrédients?\s*:', re.MULTILINE),
            'instructions': re.compile(r'^Instructions?\s*:', re.MULTILINE),
            
            # French sentence enders
            'sentence_enders': re.compile(r'[.!?…]\s+[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ]'),
        }
        
        logger.info(f"Initialized semantic splitter with chunk_size={self.chunk_size}, "
                   f"overlap={self.chunk_overlap}, language={self.language}")
    
    def _detect_document_type(self, text: str) -> str:
        """Detect the type of document for specialized processing."""
        text_lower = text.lower()
        
        # Meal plan detection
        if any(pattern in text_lower for pattern in ['petit-déjeuner', 'déjeuner', 'dîner', 'ingrédients']):
            return 'meal_plan'
        
        # Recipe detection
        if any(pattern in text_lower for pattern in ['recette', 'cuisson', 'préparation']):
            return 'recipe'
        
        # Business document detection
        if any(pattern in text_lower for pattern in ['société', 'entreprise', 'contrat', 'facture']):
            return 'business'
        
        return 'general'
    
    def _french_sentence_split(self, text: str) -> List[str]:
        """Split text into sentences using French-aware tokenization."""
        try:
            # Use NLTK's French sentence tokenizer
            sentences = sent_tokenize(text, language=self.language)
            return sentences
        except Exception as e:
            logger.warning(f"NLTK tokenization failed: {e}, falling back to regex")
            # Fallback to regex-based splitting
            sentences = re.split(r'(?<=[.!?…])\s+(?=[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ])', text)
            return [s.strip() for s in sentences if s.strip()]
    
    def _semantic_split_meal_plan(self, text: str) -> List[str]:
        """Split meal plan documents semantically."""
        chunks = []
        
        # Split by meal sections (PD, DJ, DN)
        meal_sections = re.split(r'(^(?:PD|DJ|DN)\s*$)', text, flags=re.MULTILINE)
        
        current_chunk = ""
        current_size = 0
        
        for i, section in enumerate(meal_sections):
            section = section.strip()
            if not section:
                continue
            
            # If this is a meal marker, start a new chunk if current is getting large
            if re.match(r'^(?:PD|DJ|DN)\s*$', section):
                if current_size > self.chunk_size * 0.7:  # 70% of max size
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = section + "\n"
                    current_size = len(section) + 1
                else:
                    current_chunk += section + "\n"
                    current_size += len(section) + 1
            else:
                # Regular content
                if current_size + len(section) > self.chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = section + "\n"
                    current_size = len(section) + 1
                else:
                    current_chunk += section + "\n"
                    current_size += len(section) + 1
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _semantic_split_general(self, text: str) -> List[str]:
        """Split general documents semantically."""
        chunks = []
        sentences = self._french_sentence_split(text)
        
        current_chunk = ""
        current_size = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            sentence_size = len(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_size + sentence_size > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # Start new chunk
                current_chunk = sentence + " "
                current_size = sentence_size + 1
            else:
                current_chunk += sentence + " "
                current_size += sentence_size + 1
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _add_overlap(self, chunks: List[str]) -> List[str]:
        """Add overlap between chunks."""
        if len(chunks) <= 1:
            return chunks
        
        overlapped_chunks = []
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                # First chunk - no overlap needed
                overlapped_chunks.append(chunk)
            else:
                # Add overlap from previous chunk
                prev_chunk = chunks[i - 1]
                overlap_text = prev_chunk[-self.chunk_overlap:] if len(prev_chunk) > self.chunk_overlap else prev_chunk
                
                # Find a good sentence boundary for overlap
                sentences = self._french_sentence_split(overlap_text)
                if sentences:
                    # Use the last complete sentence as overlap
                    overlap = sentences[-1] + " " + chunk
                else:
                    overlap = overlap_text + " " + chunk
                
                overlapped_chunks.append(overlap)
        
        return overlapped_chunks
    
    def split_text(self, text: str, metadata: dict = None) -> List[Document]:
        """Split text into semantic chunks.
        
        Args:
            text: Text to split
            metadata: Metadata to attach to chunks
            
        Returns:
            List of Document objects
        """
        try:
            if not text.strip():
                return []
            
            logger.debug(f"Splitting text of length {len(text)} into semantic chunks")
            
            # Detect document type
            doc_type = self._detect_document_type(text)
            logger.debug(f"Detected document type: {doc_type}")
            
            # Apply appropriate splitting strategy
            if doc_type == 'meal_plan':
                chunks = self._semantic_split_meal_plan(text)
            else:
                chunks = self._semantic_split_general(text)
            
            # Add overlap between chunks
            chunks = self._add_overlap(chunks)
            
            # Create Document objects
            documents = []
            for i, chunk in enumerate(chunks):
                chunk_metadata = (metadata or {}).copy()
                chunk_metadata.update({
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "chunk_size": len(chunk),
                    "document_type": doc_type,
                    "splitting_method": "semantic"
                })
                
                doc = Document(
                    page_content=chunk,
                    metadata=chunk_metadata
                )
                documents.append(doc)
            
            logger.info(f"Created {len(documents)} semantic chunks from text "
                       f"(type: {doc_type}, avg size: {sum(len(c) for c in chunks) // len(chunks)})")
            
            return documents
            
        except Exception as e:
            logger.error(f"Semantic splitting failed: {e}")
            # Fallback to simple splitting
            fallback_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                length_function=len,
                separators=["\n\n", "\n", " ", ""],
                keep_separator=True
            )
            
            doc = Document(page_content=text, metadata=metadata or {})
            return fallback_splitter.split_documents([doc])
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split multiple documents into semantic chunks."""
        try:
            logger.debug(f"Splitting {len(documents)} documents semantically")
            
            all_chunks = []
            for doc in documents:
                chunks = self.split_text(doc.page_content, doc.metadata)
                all_chunks.extend(chunks)
            
            logger.info(f"Created {len(all_chunks)} total semantic chunks from {len(documents)} documents")
            return all_chunks
            
        except Exception as e:
            logger.error(f"Document splitting failed: {e}")
            raise
    
    def get_chunk_stats(self, chunks: List[Document]) -> Dict[str, Any]:
        """Get statistics about chunks."""
        if not chunks:
            return {"count": 0, "avg_size": 0, "min_size": 0, "max_size": 0}
        
        chunk_sizes = [len(chunk.page_content) for chunk in chunks]
        doc_types = [chunk.metadata.get("document_type", "unknown") for chunk in chunks]
        
        from collections import Counter
        type_counts = Counter(doc_types)
        
        return {
            "count": len(chunks),
            "avg_size": sum(chunk_sizes) / len(chunk_sizes),
            "min_size": min(chunk_sizes),
            "max_size": max(chunk_sizes),
            "total_chars": sum(chunk_sizes),
            "document_types": dict(type_counts),
            "splitting_method": "semantic"
        }


# Global semantic splitter instance
semantic_splitter = SemanticSplitter()