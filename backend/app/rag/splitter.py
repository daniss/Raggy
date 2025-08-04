from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class DocumentSplitter:
    """Document text splitter for creating chunks."""
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        """Initialize document splitter."""
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            # Better separators for structured documents like meal plans
            separators=["\n\n\n", "\n\n", "\nDN\n", "\nDJ\n", "\nPD\n", "\n", " ", ""],
            keep_separator=True
        )
        
        logger.info(f"Initialized text splitter with chunk_size={self.chunk_size}, overlap={self.chunk_overlap}")
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks."""
        try:
            logger.debug(f"Splitting {len(documents)} documents into chunks")
            
            chunks = []
            for doc in documents:
                # Split the document
                doc_chunks = self.text_splitter.split_documents([doc])
                
                # Add chunk index to metadata
                for i, chunk in enumerate(doc_chunks):
                    chunk.metadata.update({
                        "chunk_index": i,
                        "total_chunks": len(doc_chunks),
                        "chunk_size": len(chunk.page_content)
                    })
                    chunks.append(chunk)
            
            logger.info(f"Created {len(chunks)} chunks from {len(documents)} documents")
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to split documents: {e}")
            raise
    
    def split_text(self, text: str, metadata: dict = None) -> List[Document]:
        """Split raw text into chunks."""
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
        """Get statistics about chunks."""
        if not chunks:
            return {"count": 0, "avg_size": 0, "min_size": 0, "max_size": 0}
        
        chunk_sizes = [len(chunk.page_content) for chunk in chunks]
        
        return {
            "count": len(chunks),
            "avg_size": sum(chunk_sizes) / len(chunk_sizes),
            "min_size": min(chunk_sizes),
            "max_size": max(chunk_sizes),
            "total_chars": sum(chunk_sizes)
        }


# Global splitter instance
document_splitter = DocumentSplitter()