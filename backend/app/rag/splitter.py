from typing import List, Optional, Dict, Tuple, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
import logging
import re
from app.core.config import settings

logger = logging.getLogger(__name__)


class ContentAwareDocumentSplitter:
    """Content-aware document text splitter with semantic boundary detection and runtime configuration."""
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None, enable_semantic_chunking: bool = None):
        """Initialize content-aware document splitter with configurable parameters."""
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        self.enable_semantic_chunking = enable_semantic_chunking if enable_semantic_chunking is not None else settings.use_semantic_chunking
        
        # Validate parameters
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if self.chunk_overlap < 0:
            raise ValueError("chunk_overlap cannot be negative")
        if self.chunk_overlap >= self.chunk_size:
            logger.warning(f"chunk_overlap ({self.chunk_overlap}) >= chunk_size ({self.chunk_size}), reducing overlap")
            self.chunk_overlap = max(0, self.chunk_size // 4)  # Limit to 25% of chunk size
        
        # Standard text splitter as fallback
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            # Enhanced separators for better content boundary detection
            separators=[
                "\n\n\n",  # Multiple newlines (strong paragraph separation)
                "\n\n",    # Double newlines (paragraph separation)
                "\n# ",    # Markdown headers
                "\n## ",   # Markdown subheaders
                "\n### ",  # Markdown sub-subheaders
                "\n- ",    # Markdown list items
                "\n* ",    # Markdown list items (alternative)
                "\n1. ",   # Numbered lists
                "\n",      # Single newlines
                ". ",      # Sentence endings
                "! ",      # Exclamation sentences
                "? ",      # Question sentences
                "; ",      # Semicolons
                " ",       # Spaces
                ""         # Character level (last resort)
            ],
            keep_separator=True
        )
        
        # Patterns for detecting semantic boundaries
        self.semantic_patterns = {
            'section_headers': re.compile(r'^(#+\s|Chapter\s+\d+|Section\s+\d+|Part\s+\d+)', re.MULTILINE | re.IGNORECASE),
            'paragraph_breaks': re.compile(r'\n\s*\n'),
            'list_items': re.compile(r'^(\s*[-*+]\s|\s*\d+\.\s)', re.MULTILINE),
            'code_blocks': re.compile(r'```[\s\S]*?```|`[^`]+`'),
            'table_rows': re.compile(r'^\|.*\|$', re.MULTILINE),
            'quotations': re.compile(r'^>\s+.*$', re.MULTILINE),
            'strong_breaks': re.compile(r'\n\s*[-=]{3,}\s*\n'),  # Horizontal rules
        }
        
        logger.info(f"Initialized content-aware splitter: chunk_size={self.chunk_size}, overlap={self.chunk_overlap}, semantic={self.enable_semantic_chunking}")
    
    def reconfigure(self, chunk_size: int = None, chunk_overlap: int = None, enable_semantic_chunking: bool = None):
        """Reconfigure splitter parameters at runtime."""
        if chunk_size is not None:
            if chunk_size <= 0:
                raise ValueError("chunk_size must be positive")
            self.chunk_size = chunk_size
        
        if chunk_overlap is not None:
            if chunk_overlap < 0:
                raise ValueError("chunk_overlap cannot be negative")
            self.chunk_overlap = chunk_overlap
        
        if enable_semantic_chunking is not None:
            self.enable_semantic_chunking = enable_semantic_chunking
        
        # Validate overlap vs chunk size
        if self.chunk_overlap >= self.chunk_size:
            logger.warning(f"Reconfigured overlap ({self.chunk_overlap}) >= chunk_size ({self.chunk_size}), reducing")
            self.chunk_overlap = max(0, self.chunk_size // 4)
        
        # Recreate text splitter with new parameters
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=[
                "\n\n\n",  # Multiple newlines (strong paragraph separation)
                "\n\n",    # Double newlines (paragraph separation)
                "\n# ",    # Markdown headers
                "\n## ",   # Markdown subheaders
                "\n### ",  # Markdown sub-subheaders
                "\n- ",    # Markdown list items
                "\n* ",    # Markdown list items (alternative)
                "\n1. ",   # Numbered lists
                "\n",      # Single newlines
                ". ",      # Sentence endings
                "! ",      # Exclamation sentences
                "? ",      # Question sentences
                "; ",      # Semicolons
                " ",       # Spaces
                ""         # Character level (last resort)
            ],
            keep_separator=True
        )
        
        logger.info(f"Reconfigured splitter: chunk_size={self.chunk_size}, overlap={self.chunk_overlap}, semantic={self.enable_semantic_chunking}")
    
    def get_configuration(self) -> Dict[str, Any]:
        """Get current splitter configuration."""
        return {
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "enable_semantic_chunking": self.enable_semantic_chunking,
            "overlap_ratio": self.chunk_overlap / self.chunk_size if self.chunk_size > 0 else 0
        }
    
    def _detect_content_structure(self, text: str) -> Dict[str, List[Tuple[int, int]]]:
        """Detect structural elements in text and their positions."""
        structure = {}
        
        for pattern_name, pattern in self.semantic_patterns.items():
            matches = []
            for match in pattern.finditer(text):
                matches.append((match.start(), match.end()))
            structure[pattern_name] = matches
        
        return structure
    
    def _find_optimal_split_points(self, text: str, target_positions: List[int]) -> List[int]:
        """Find optimal split points that respect content boundaries."""
        if not self.enable_semantic_chunking:
            return target_positions
        
        structure = self._detect_content_structure(text)
        optimal_points = []
        
        for target_pos in target_positions:
            best_pos = target_pos
            min_distance = float('inf')
            
            # Look for nearby structural boundaries
            search_window = min(200, self.chunk_overlap)  # Search within overlap range
            start_search = max(0, target_pos - search_window)
            end_search = min(len(text), target_pos + search_window)
            
            # Check for paragraph breaks (highest priority)
            for start, end in structure.get('paragraph_breaks', []):
                if start_search <= start <= end_search:
                    distance = abs(start - target_pos)
                    if distance < min_distance:
                        min_distance = distance
                        best_pos = start
            
            # Check for section headers (high priority)
            for start, end in structure.get('section_headers', []):
                if start_search <= start <= end_search:
                    distance = abs(start - target_pos)
                    if distance < min_distance * 1.2:  # Slightly prefer paragraph breaks
                        min_distance = distance
                        best_pos = start
            
            # Check for sentence endings (medium priority)
            if min_distance > 50:  # Only if no good structural boundary found
                sentence_pattern = re.compile(r'[.!?]\s+')
                for match in sentence_pattern.finditer(text[start_search:end_search]):
                    pos = start_search + match.end()
                    distance = abs(pos - target_pos)
                    if distance < min_distance:
                        min_distance = distance
                        best_pos = pos
            
            optimal_points.append(best_pos)
        
        return optimal_points
    
    def _create_overlapping_chunks(self, text: str, split_points: List[int]) -> List[str]:
        """Create chunks with intelligent overlap that preserves context."""
        if not split_points:
            return [text]
        
        chunks = []
        
        for i, split_point in enumerate(split_points + [len(text)]):
            start_pos = 0 if i == 0 else split_points[i-1]
            end_pos = split_point
            
            # Calculate overlap for better context preservation
            if i > 0:  # Not the first chunk
                overlap_start = max(0, start_pos - self.chunk_overlap // 2)
                
                # Try to find a good starting point within the overlap
                overlap_text = text[overlap_start:start_pos]
                sentence_pattern = re.compile(r'[.!?]\s+')
                matches = list(sentence_pattern.finditer(overlap_text))
                
                if matches and len(matches) > 1:
                    # Start from a sentence boundary within the overlap
                    last_sentence = matches[-2].end()  # Second-to-last sentence
                    start_pos = overlap_start + last_sentence
                else:
                    start_pos = overlap_start
            
            chunk_text = text[start_pos:end_pos].strip()
            if chunk_text:
                chunks.append(chunk_text)
        
        return chunks
    
    def _smart_split_text(self, text: str) -> List[str]:
        """Perform content-aware text splitting."""
        if len(text) <= self.chunk_size:
            return [text]
        
        # Calculate initial split points based on chunk size
        target_points = []
        current_pos = self.chunk_size
        
        while current_pos < len(text):
            target_points.append(current_pos)
            current_pos += self.chunk_size - self.chunk_overlap
        
        # Find optimal split points that respect content boundaries
        optimal_points = self._find_optimal_split_points(text, target_points)
        
        # Create chunks with intelligent overlap
        chunks = self._create_overlapping_chunks(text, optimal_points)
        
        return chunks
    
    def split_documents(self, documents: List[Document], adaptive_sizing: bool = False) -> List[Document]:
        """Split documents into chunks using content-aware splitting with optional adaptive sizing."""
        try:
            logger.debug(f"Splitting {len(documents)} documents into chunks (adaptive={adaptive_sizing})")
            
            chunks = []
            for doc in documents:
                # Optionally adjust chunk size based on document length
                original_chunk_size = self.chunk_size
                if adaptive_sizing:
                    optimal_size = get_optimal_chunk_size(len(doc.page_content))
                    if optimal_size != self.chunk_size:
                        logger.debug(f"Adapting chunk size from {self.chunk_size} to {optimal_size} for document of length {len(doc.page_content)}")
                        self.reconfigure(chunk_size=optimal_size)
                
                if self.enable_semantic_chunking:
                    # Use content-aware splitting
                    chunk_texts = self._smart_split_text(doc.page_content)
                else:
                    # Use standard LangChain splitting as fallback
                    doc_chunks = self.text_splitter.split_documents([doc])
                    chunk_texts = [chunk.page_content for chunk in doc_chunks]
                
                # Restore original chunk size if it was changed
                if adaptive_sizing and optimal_size != original_chunk_size:
                    self.reconfigure(chunk_size=original_chunk_size)
                
                # Create Document objects with enhanced metadata
                for i, chunk_text in enumerate(chunk_texts):
                    chunk_metadata = doc.metadata.copy()
                    chunk_metadata.update({
                        "chunk_index": i,
                        "total_chunks": len(chunk_texts),
                        "chunk_size": len(chunk_text),
                        "splitting_method": "content_aware" if self.enable_semantic_chunking else "standard",
                        "has_semantic_overlap": self.enable_semantic_chunking and i > 0,
                        "splitter_config": {
                            "chunk_size": self.chunk_size,
                            "chunk_overlap": self.chunk_overlap,
                            "semantic_chunking": self.enable_semantic_chunking
                        }
                    })
                    
                    chunk_doc = Document(
                        page_content=chunk_text,
                        metadata=chunk_metadata
                    )
                    chunks.append(chunk_doc)
            
            logger.info(f"Created {len(chunks)} chunks from {len(documents)} documents using {'content-aware' if self.enable_semantic_chunking else 'standard'} splitting{'with adaptive sizing' if adaptive_sizing else ''}")
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to split documents: {e}")
            # Fallback to standard splitting on error
            if self.enable_semantic_chunking:
                logger.warning("Content-aware splitting failed, falling back to standard splitting")
                fallback_splitter = ContentAwareDocumentSplitter(
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap,
                    enable_semantic_chunking=False
                )
                return fallback_splitter.split_documents(documents)
            raise
    
    def split_text(self, text: str, metadata: dict = None) -> List[Document]:
        """Split raw text into chunks using content-aware method."""
        try:
            logger.debug(f"Splitting text of length {len(text)} into chunks")
            
            # Create a document from text
            doc = Document(page_content=text, metadata=metadata or {})
            
            # Split into chunks
            chunks = self.split_documents([doc])
            
            logger.info(f"Created {len(chunks)} chunks from text")
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to split text: {e}")
            raise
    
    def get_chunk_stats(self, chunks: List[Document]) -> dict:
        """Get enhanced statistics about chunks including semantic analysis."""
        if not chunks:
            return {"count": 0, "avg_size": 0, "min_size": 0, "max_size": 0}
        
        chunk_sizes = [len(chunk.page_content) for chunk in chunks]
        
        # Count chunks with semantic features
        semantic_chunks = len([c for c in chunks if c.metadata.get("has_semantic_overlap", False)])
        content_aware_chunks = len([c for c in chunks if c.metadata.get("splitting_method") == "content_aware"])
        
        # Analyze overlap quality (simplified)
        overlap_quality = 0
        if len(chunks) > 1:
            overlaps = []
            for i in range(1, len(chunks)):
                prev_chunk = chunks[i-1].page_content
                curr_chunk = chunks[i].page_content
                
                # Simple overlap detection (could be improved with more sophisticated NLP)
                overlap_chars = 0
                min_len = min(len(prev_chunk), len(curr_chunk))
                for j in range(min(200, min_len)):  # Check first 200 chars
                    if j < len(prev_chunk) and j < len(curr_chunk):
                        if prev_chunk[-(j+1)] == curr_chunk[j]:
                            overlap_chars += 1
                        else:
                            break
                
                overlaps.append(overlap_chars)
            
            overlap_quality = sum(overlaps) / len(overlaps) if overlaps else 0
        
        return {
            "count": len(chunks),
            "avg_size": sum(chunk_sizes) / len(chunk_sizes),
            "min_size": min(chunk_sizes),
            "max_size": max(chunk_sizes),
            "total_chars": sum(chunk_sizes),
            "semantic_chunks": semantic_chunks,
            "content_aware_chunks": content_aware_chunks,
            "avg_overlap_quality": overlap_quality,
            "splitting_method": "content_aware" if self.enable_semantic_chunking else "standard"
        }
    
    def analyze_chunk_boundaries(self, chunks: List[Document]) -> Dict[str, int]:
        """Analyze the types of boundaries used for chunking."""
        boundary_types = {
            "paragraph_breaks": 0,
            "sentence_endings": 0,
            "section_headers": 0,
            "arbitrary_cuts": 0
        }
        
        for i, chunk in enumerate(chunks[:-1]):  # Skip last chunk
            chunk_end = chunk.page_content[-50:]  # Last 50 chars
            next_chunk_start = chunks[i + 1].page_content[:50]  # First 50 chars
            
            # Analyze boundary type based on patterns
            if re.search(r'\n\s*\n$', chunk_end):
                boundary_types["paragraph_breaks"] += 1
            elif re.search(r'[.!?]\s*$', chunk_end):
                boundary_types["sentence_endings"] += 1
            elif re.search(r'^#+\s', next_chunk_start) or re.search(r'^(Chapter|Section|Part)\s+\d+', next_chunk_start, re.IGNORECASE):
                boundary_types["section_headers"] += 1
            else:
                boundary_types["arbitrary_cuts"] += 1
        
        return boundary_types


# Legacy class for backward compatibility
class DocumentSplitter(ContentAwareDocumentSplitter):
    """Legacy DocumentSplitter class - now using ContentAwareDocumentSplitter."""
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        """Initialize with content-aware splitting enabled by default."""
        super().__init__(chunk_size=chunk_size, chunk_overlap=chunk_overlap, enable_semantic_chunking=True)


# Global splitter instance with content-aware chunking
document_splitter = ContentAwareDocumentSplitter()


def create_custom_splitter(chunk_size: int, chunk_overlap: int, enable_semantic_chunking: bool = True) -> ContentAwareDocumentSplitter:
    """Create a custom splitter with specific configuration."""
    return ContentAwareDocumentSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        enable_semantic_chunking=enable_semantic_chunking
    )


def get_optimal_chunk_size(content_length: int, target_chunks: int = None) -> int:
    """Calculate optimal chunk size based on content length and target chunk count."""
    if target_chunks:
        # Calculate chunk size to achieve target number of chunks
        base_chunk_size = content_length // target_chunks
        # Round to nearest hundred for consistency
        optimal_size = max(200, round(base_chunk_size / 100) * 100)
        return min(optimal_size, 2000)  # Cap at 2000 chars
    else:
        # Use adaptive sizing based on content length
        if content_length < 1000:
            return content_length  # Single chunk for very short content
        elif content_length < 5000:
            return 800  # Smaller chunks for medium content
        elif content_length < 20000:
            return 1200  # Standard chunks for larger content
        else:
            return 1600  # Larger chunks for very large content