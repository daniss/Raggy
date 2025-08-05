"""Adaptive document splitter that optimizes chunk size based on document type and content analysis."""

import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from langchain.schema import Document
from app.rag.splitter import ContentAwareDocumentSplitter

logger = logging.getLogger(__name__)


class DocumentType(Enum):
    """Document type classification."""
    TECHNICAL_MANUAL = "technical_manual"
    FAQ = "faq"
    LEGAL_DOCUMENT = "legal_document"
    PRODUCT_DESCRIPTION = "product_description"
    EMAIL = "email"
    FINANCIAL_REPORT = "financial_report"
    MEETING_NOTES = "meeting_notes"
    GENERIC = "generic"


@dataclass
class ChunkingStrategy:
    """Chunking strategy for specific document types."""
    chunk_size: int
    chunk_overlap: int
    preserve_structure: bool
    semantic_boundaries: List[str]
    description: str


@dataclass
class DocumentAnalysis:
    """Analysis result for a document."""
    document_type: DocumentType
    content_complexity: float  # 0-1 scale
    structure_score: float     # 0-1 scale (how structured the document is)
    technical_density: float   # 0-1 scale (technical terms density)
    recommended_strategy: ChunkingStrategy


class AdaptiveDocumentSplitter:
    """Adaptive document splitter that optimizes chunking based on document analysis."""
    
    def __init__(self, max_document_size_mb: float = 10.0, max_memory_usage_mb: float = 100.0):
        """Initialize the adaptive splitter.
        
        Args:
            max_document_size_mb: Maximum size for a single document in MB
            max_memory_usage_mb: Maximum memory usage for processing in MB
        """
        # Import settings here to avoid circular dependencies
        from app.core.config import settings
        
        self.base_chunk_size = settings.chunk_size
        self.base_chunk_overlap = settings.chunk_overlap
        self.max_document_size_bytes = int(max_document_size_mb * 1024 * 1024)
        self.max_memory_usage_bytes = int(max_memory_usage_mb * 1024 * 1024)
        
        logger.info(f"Initialized adaptive splitter with limits: "
                   f"max_doc_size={max_document_size_mb}MB, max_memory={max_memory_usage_mb}MB")
        
        # Define chunking strategies for different document types
        self.strategies = {
            DocumentType.TECHNICAL_MANUAL: ChunkingStrategy(
                chunk_size=1200,  # Larger chunks for technical content
                chunk_overlap=300,  # More overlap to preserve context
                preserve_structure=True,
                semantic_boundaries=["section", "subsection", "procedure", "step"],
                description="Technical manuals need larger chunks to preserve procedural context"
            ),
            DocumentType.FAQ: ChunkingStrategy(
                chunk_size=600,   # Smaller chunks, one Q&A per chunk ideally
                chunk_overlap=100,  # Minimal overlap
                preserve_structure=True,
                semantic_boundaries=["question", "answer", "Q:", "A:", "FAQ"],
                description="FAQ documents benefit from question-answer alignment"
            ),
            DocumentType.LEGAL_DOCUMENT: ChunkingStrategy(
                chunk_size=1500,  # Large chunks to preserve legal context
                chunk_overlap=400,  # High overlap for legal continuity
                preserve_structure=True,
                semantic_boundaries=["article", "clause", "section", "paragraph"],
                description="Legal documents require large chunks to maintain legal meaning"
            ),
            DocumentType.PRODUCT_DESCRIPTION: ChunkingStrategy(
                chunk_size=800,   # Medium chunks for product features
                chunk_overlap=200,  # Standard overlap
                preserve_structure=True,
                semantic_boundaries=["feature", "specification", "benefit", "description"],
                description="Product descriptions need feature-aligned chunks"
            ),
            DocumentType.EMAIL: ChunkingStrategy(
                chunk_size=700,   # Medium-small chunks for email threads
                chunk_overlap=150,  # Moderate overlap
                preserve_structure=True,
                semantic_boundaries=["from:", "to:", "subject:", "reply", "forward"],
                description="Emails need thread-aware chunking"
            ),
            DocumentType.FINANCIAL_REPORT: ChunkingStrategy(
                chunk_size=1000,  # Standard size but structured
                chunk_overlap=250,  # Good overlap for financial context
                preserve_structure=True,
                semantic_boundaries=["quarter", "revenue", "expense", "summary", "table"],
                description="Financial reports need table and section awareness"
            ),
            DocumentType.MEETING_NOTES: ChunkingStrategy(
                chunk_size=900,   # Medium chunks for topics
                chunk_overlap=200,  # Standard overlap
                preserve_structure=True,
                semantic_boundaries=["agenda", "action", "decision", "attendee", "topic"],
                description="Meeting notes benefit from topic-aligned chunks"
            ),
            DocumentType.GENERIC: ChunkingStrategy(
                chunk_size=self.base_chunk_size,
                chunk_overlap=self.base_chunk_overlap,
                preserve_structure=True,
                semantic_boundaries=["paragraph", "section"],
                description="Generic strategy for unclassified documents"
            )
        }
        
        # Patterns for document type detection
        self.type_patterns = {
            DocumentType.TECHNICAL_MANUAL: {
                'keywords': ['manual', 'guide', 'instruction', 'procedure', 'step', 'configure', 'install', 'setup'],
                'patterns': [r'\d+\.\s+\w+', r'Step \d+', r'Configuration', r'Installation'],
                'structure_indicators': ['numbered_lists', 'procedures', 'code_blocks']
            },
            DocumentType.FAQ: {
                'keywords': ['faq', 'question', 'answer', 'frequently', 'asked'],
                'patterns': [r'Q\s*[:.]', r'A\s*[:.]', r'\?', r'Question \d+'],
                'structure_indicators': ['qa_pairs', 'questions']
            },
            DocumentType.LEGAL_DOCUMENT: {
                'keywords': ['article', 'clause', 'whereas', 'hereby', 'agreement', 'contract', 'terms', 'conditions', 'legal'],
                'patterns': [r'Article \d+', r'Section \d+', r'Clause \d+', r'WHEREAS'],
                'structure_indicators': ['legal_structure', 'numbered_clauses']
            },
            DocumentType.PRODUCT_DESCRIPTION: {
                'keywords': ['product', 'feature', 'specification', 'price', 'benefit', 'description', 'model'],
                'patterns': [r'Features?:', r'Specifications?:', r'Benefits?:', r'Price:'],
                'structure_indicators': ['feature_lists', 'specifications']
            },
            DocumentType.EMAIL: {
                'keywords': ['from', 'to', 'subject', 'reply', 'forward', 'sent', 'received'],
                'patterns': [r'From:', r'To:', r'Subject:', r'Sent:', r'Reply', r'Forward'],
                'structure_indicators': ['email_headers', 'thread_structure']
            },
            DocumentType.FINANCIAL_REPORT: {
                'keywords': ['revenue', 'profit', 'loss', 'quarter', 'financial', 'report', 'earnings', 'budget'],
                'patterns': [r'Q[1-4]', r'\$[\d,]+', r'FY\d{4}', r'Revenue:', r'Expenses:'],
                'structure_indicators': ['financial_tables', 'quarterly_data']
            },
            DocumentType.MEETING_NOTES: {
                'keywords': ['meeting', 'agenda', 'attendee', 'action', 'decision', 'discussion', 'notes'],
                'patterns': [r'Agenda:', r'Attendees?:', r'Action Items?:', r'Decisions?:'],
                'structure_indicators': ['agenda_items', 'action_items']
            }
        }
        
        logger.info("Initialized adaptive document splitter with 7 specialized strategies")
    
    def _validate_document_size(self, document: Document) -> bool:
        """Validate that document size is within limits.
        
        Args:
            document: Document to validate
            
        Returns:
            True if document is within size limits, False otherwise
        """
        content_size = len(document.page_content.encode('utf-8'))
        
        if content_size > self.max_document_size_bytes:
            logger.warning(f"Document too large: {content_size / 1024 / 1024:.2f}MB "
                          f"exceeds limit of {self.max_document_size_bytes / 1024 / 1024:.2f}MB")
            return False
        
        return True
    
    def _truncate_large_document(self, document: Document) -> Document:
        """Truncate document if it's too large.
        
        Args:
            document: Document to truncate
            
        Returns:
            Truncated document within size limits
        """
        content = document.page_content
        content_bytes = content.encode('utf-8')
        
        if len(content_bytes) <= self.max_document_size_bytes:
            return document
        
        # Calculate truncation point (leave some buffer)
        target_bytes = int(self.max_document_size_bytes * 0.9)
        
        # Try to truncate at sentence boundaries
        truncated_content = content
        while len(truncated_content.encode('utf-8')) > target_bytes:
            # Find last sentence ending
            last_sentence = max(
                truncated_content.rfind('.'),
                truncated_content.rfind('!'),
                truncated_content.rfind('?'),
                truncated_content.rfind('\n\n')
            )
            
            if last_sentence > target_bytes * 0.7:  # Good sentence boundary
                truncated_content = truncated_content[:last_sentence + 1]
                break
            else:
                # Fallback: truncate at character level
                truncated_content = truncated_content[:int(len(truncated_content) * 0.9)]
        
        logger.warning(f"Truncated document from {len(content)} to {len(truncated_content)} characters")
        
        # Create new document with truncated content
        new_metadata = document.metadata.copy()
        new_metadata.update({
            'original_length': len(content),
            'truncated_length': len(truncated_content),
            'truncated': True
        })
        
        return Document(page_content=truncated_content, metadata=new_metadata)
    
    def _estimate_memory_usage(self, documents: List[Document]) -> int:
        """Estimate memory usage for processing documents.
        
        Args:
            documents: List of documents to process
            
        Returns:
            Estimated memory usage in bytes
        """
        total_content_size = sum(len(doc.page_content.encode('utf-8')) for doc in documents)
        
        # Rough estimate: content + metadata + processing overhead (3x factor)
        estimated_memory = total_content_size * 3
        
        return estimated_memory
    
    def _analyze_document_content(self, text: str) -> Tuple[float, float, float]:
        """Analyze document content for complexity, structure, and technical density.
        
        Returns:
            Tuple of (complexity, structure_score, technical_density)
        """
        # Content complexity analysis
        sentence_count = len(re.findall(r'[.!?]+', text))
        word_count = len(text.split())
        avg_sentence_length = word_count / max(sentence_count, 1)
        
        # Normalize complexity (longer sentences = higher complexity)
        complexity = min(avg_sentence_length / 25.0, 1.0)  # 25 words = baseline
        
        # Structure analysis
        structure_indicators = [
            len(re.findall(r'^\s*\d+\.', text, re.MULTILINE)),  # Numbered lists
            len(re.findall(r'^#+\s', text, re.MULTILINE)),      # Headers
            len(re.findall(r'^\s*[-*+]\s', text, re.MULTILINE)), # Bullet points
            len(re.findall(r'\n\n+', text)),                    # Paragraph breaks
            len(re.findall(r'^\s*[A-Z][^.]*:', text, re.MULTILINE)) # Labeled sections
        ]
        
        structure_density = sum(structure_indicators) / max(len(text.split('\n')), 1)
        structure_score = min(structure_density * 10, 1.0)
        
        # Technical density analysis
        technical_patterns = [
            r'\b[A-Z]{2,}\b',           # Acronyms
            r'\b\d+\.\d+\b',            # Version numbers
            r'\b[a-z]+\.[a-z]+\b',      # File extensions or domains
            r'\b[A-Z][a-z]+[A-Z]\w*\b', # CamelCase
            r'\b\w*config\w*\b',        # Configuration terms
            r'\b\w*install\w*\b',       # Installation terms
        ]
        
        technical_count = sum(len(re.findall(pattern, text, re.IGNORECASE)) 
                            for pattern in technical_patterns)
        technical_density = min(technical_count / max(word_count, 1) * 100, 1.0)
        
        return complexity, structure_score, technical_density
    
    def _classify_document_type(self, text: str, metadata: Dict[str, Any]) -> DocumentType:
        """Classify document type based on content and metadata."""
        text_lower = text.lower()
        
        # Check filename from metadata
        filename = metadata.get('filename', '').lower()
        
        # Score each document type
        type_scores = {}
        
        for doc_type, indicators in self.type_patterns.items():
            score = 0
            
            # Keyword matching
            keyword_matches = sum(1 for keyword in indicators['keywords'] 
                                if keyword in text_lower or keyword in filename)
            score += keyword_matches * 2
            
            # Pattern matching
            pattern_matches = sum(1 for pattern in indicators['patterns'] 
                                if re.search(pattern, text, re.IGNORECASE))
            score += pattern_matches * 3
            
            # Structure indicator bonus
            if 'numbered_lists' in indicators.get('structure_indicators', []):
                if len(re.findall(r'^\s*\d+\.', text, re.MULTILINE)) > 3:
                    score += 2
            
            if 'qa_pairs' in indicators.get('structure_indicators', []):
                if len(re.findall(r'[Qq]\s*[:.]', text)) > 2:
                    score += 3
            
            type_scores[doc_type] = score
        
        # Return the type with highest score, or GENERIC if no clear winner
        if not type_scores or max(type_scores.values()) < 2:
            return DocumentType.GENERIC
        
        classified_type = max(type_scores, key=type_scores.get)
        logger.debug(f"Classified document as {classified_type.value} (score: {type_scores[classified_type]})")
        
        return classified_type
    
    def analyze_document(self, document: Document) -> DocumentAnalysis:
        """Analyze a document and determine optimal chunking strategy."""
        text = document.page_content
        metadata = document.metadata
        
        # Classify document type
        doc_type = self._classify_document_type(text, metadata)
        
        # Analyze content characteristics
        complexity, structure_score, technical_density = self._analyze_document_content(text)
        
        # Get base strategy for the document type
        base_strategy = self.strategies[doc_type]
        
        # Adjust strategy based on content analysis
        adjusted_strategy = self._adjust_strategy(base_strategy, complexity, structure_score, technical_density)
        
        analysis = DocumentAnalysis(
            document_type=doc_type,
            content_complexity=complexity,
            structure_score=structure_score,
            technical_density=technical_density,
            recommended_strategy=adjusted_strategy
        )
        
        logger.info(f"Document analysis: type={doc_type.value}, complexity={complexity:.2f}, "
                   f"structure={structure_score:.2f}, technical={technical_density:.2f}")
        
        return analysis
    
    def _adjust_strategy(self, base_strategy: ChunkingStrategy, complexity: float, 
                        structure_score: float, technical_density: float) -> ChunkingStrategy:
        """Adjust chunking strategy based on content analysis."""
        
        # Calculate adjustment factors
        complexity_factor = 1.0 + (complexity - 0.5) * 0.3  # ±15% based on complexity
        technical_factor = 1.0 + technical_density * 0.2    # +20% for highly technical content
        structure_factor = 1.0 + structure_score * 0.1      # +10% for well-structured content
        
        # Apply adjustments
        adjusted_chunk_size = int(base_strategy.chunk_size * complexity_factor * technical_factor * structure_factor)
        adjusted_overlap = int(base_strategy.chunk_overlap * complexity_factor)
        
        # Ensure reasonable bounds
        adjusted_chunk_size = max(400, min(2000, adjusted_chunk_size))
        adjusted_overlap = max(50, min(adjusted_chunk_size // 3, adjusted_overlap))
        
        return ChunkingStrategy(
            chunk_size=adjusted_chunk_size,
            chunk_overlap=adjusted_overlap,
            preserve_structure=base_strategy.preserve_structure,
            semantic_boundaries=base_strategy.semantic_boundaries,
            description=f"Adapted {base_strategy.description} (complexity={complexity:.2f}, technical={technical_density:.2f})"
        )
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents using adaptive chunking strategies with memory management."""
        if not documents:
            logger.warning("No documents provided for splitting")
            return []
        
        # Check memory usage estimate
        estimated_memory = self._estimate_memory_usage(documents)
        if estimated_memory > self.max_memory_usage_bytes:
            logger.warning(f"Estimated memory usage {estimated_memory / 1024 / 1024:.2f}MB "
                          f"exceeds limit of {self.max_memory_usage_bytes / 1024 / 1024:.2f}MB")
            
            # Process documents in batches to manage memory
            return self._split_documents_batched(documents)
        
        return self._split_documents_direct(documents)
    
    def _split_documents_direct(self, documents: List[Document]) -> List[Document]:
        """Split documents directly (when memory usage is acceptable)."""
        all_chunks = []
        processed_docs = 0
        skipped_docs = 0
        
        for doc in documents:
            try:
                # Validate and potentially truncate document
                if not self._validate_document_size(doc):
                    logger.info(f"Truncating oversized document: {doc.metadata.get('filename', 'unknown')}")
                    doc = self._truncate_large_document(doc)
                
                # Analyze document
                analysis = self.analyze_document(doc)
                strategy = analysis.recommended_strategy
                
                # Create specialized splitter with optimal parameters
                splitter = ContentAwareDocumentSplitter(
                    chunk_size=strategy.chunk_size,
                    chunk_overlap=strategy.chunk_overlap,
                    enable_semantic_chunking=strategy.preserve_structure
                )
                
                # Split the document
                doc_chunks = splitter.split_documents([doc])
                
                # Add analysis metadata to chunks
                for chunk in doc_chunks:
                    chunk.metadata.update({
                        'adaptive_strategy': {
                            'document_type': analysis.document_type.value,
                            'chunk_size': strategy.chunk_size,
                            'chunk_overlap': strategy.chunk_overlap,
                            'content_complexity': analysis.content_complexity,
                            'structure_score': analysis.structure_score,
                            'technical_density': analysis.technical_density,
                            'strategy_description': strategy.description
                        }
                    })
                
                all_chunks.extend(doc_chunks)
                processed_docs += 1
                
                logger.info(f"Split document into {len(doc_chunks)} chunks using {analysis.document_type.value} strategy "
                           f"(size={strategy.chunk_size}, overlap={strategy.chunk_overlap})")
                
            except Exception as e:
                logger.error(f"Failed to split document {doc.metadata.get('filename', 'unknown')}: {e}")
                skipped_docs += 1
                continue
        
        logger.info(f"Adaptive splitting completed: {processed_docs} documents processed, "
                   f"{skipped_docs} skipped → {len(all_chunks)} chunks")
        return all_chunks
    
    def _split_documents_batched(self, documents: List[Document]) -> List[Document]:
        """Split documents in batches to manage memory usage."""
        if not documents:
            logger.warning("No documents to batch process")
            return []
        
        # Calculate batch size based on memory limits with safety checks
        try:
            # More efficient calculation: estimate size without encoding all documents
            sample_size = min(10, len(documents))  # Sample first 10 documents
            sample_docs = documents[:sample_size]
            sample_total_size = sum(len(doc.page_content.encode('utf-8')) for doc in sample_docs)
            avg_doc_size = sample_total_size / sample_size if sample_size > 0 else 1000  # 1KB default
            
            # Conservative estimate: process documents that fit in 50% of memory limit
            safe_memory = self.max_memory_usage_bytes * 0.5
            batch_size = max(1, int(safe_memory / (avg_doc_size * 3)))  # 3x overhead factor
            
        except Exception as e:
            logger.warning(f"Failed to calculate optimal batch size: {e}, using default")
            batch_size = 5  # Safe default batch size
        
        logger.info(f"Processing {len(documents)} documents in batches of {batch_size} for memory management")
        
        all_chunks = []
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            logger.debug(f"Processing batch {i // batch_size + 1} with {len(batch)} documents")
            
            try:
                batch_chunks = self._split_documents_direct(batch)
                all_chunks.extend(batch_chunks)
            except Exception as e:
                logger.error(f"Failed to process batch {i // batch_size + 1}: {e}")
                # Continue with next batch
                continue
        
        logger.info(f"Batched splitting completed: {len(all_chunks)} total chunks")
        return all_chunks
    
    def get_strategy_stats(self, documents: List[Document]) -> Dict[str, Any]:
        """Get statistics about the adaptive strategies used."""
        if not documents:
            return {}
        
        type_counts = {}
        strategy_metrics = {
            'avg_chunk_size': [],
            'avg_overlap': [],
            'complexity_scores': [],
            'technical_scores': []
        }
        
        for doc in documents:
            analysis = self.analyze_document(doc)
            doc_type = analysis.document_type.value
            
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
            strategy_metrics['avg_chunk_size'].append(analysis.recommended_strategy.chunk_size)
            strategy_metrics['avg_overlap'].append(analysis.recommended_strategy.chunk_overlap)
            strategy_metrics['complexity_scores'].append(analysis.content_complexity)
            strategy_metrics['technical_scores'].append(analysis.technical_density)
        
        return {
            'document_type_distribution': type_counts,
            'average_chunk_size': sum(strategy_metrics['avg_chunk_size']) / len(strategy_metrics['avg_chunk_size']),
            'average_overlap': sum(strategy_metrics['avg_overlap']) / len(strategy_metrics['avg_overlap']),
            'average_complexity': sum(strategy_metrics['complexity_scores']) / len(strategy_metrics['complexity_scores']),
            'average_technical_density': sum(strategy_metrics['technical_scores']) / len(strategy_metrics['technical_scores']),
            'strategies_available': len(self.strategies),
            'total_documents_analyzed': len(documents)
        }


# Global adaptive splitter instance
adaptive_splitter = AdaptiveDocumentSplitter()