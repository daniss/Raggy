import os
import tempfile
from typing import List, Dict, Any
import fitz  # PyMuPDF
from unstructured.partition.auto import partition
from langchain.schema import Document
import logging

logger = logging.getLogger(__name__)


class DocumentLoader:
    """Document loader for various file formats."""
    
    def __init__(self):
        """Initialize document loader."""
        self.supported_formats = {
            "application/pdf": self._load_pdf,
            "text/plain": self._load_text,
            "text/markdown": self._load_text,
            "text/csv": self._load_csv,
            "application/csv": self._load_csv,
            "application/msword": self._load_with_unstructured,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": self._load_with_unstructured,
        }
    
    def load_from_file(self, file_path: str, content_type: str, metadata: Dict[str, Any] = None) -> List[Document]:
        """Load documents from file."""
        try:
            if content_type not in self.supported_formats:
                raise ValueError(f"Unsupported file type: {content_type}")
            
            loader_func = self.supported_formats[content_type]
            documents = loader_func(file_path, metadata or {})
            
            logger.info(f"Loaded {len(documents)} documents from {file_path}")
            return documents
            
        except Exception as e:
            logger.error(f"Failed to load document from {file_path}: {e}")
            raise
    
    def load_from_bytes(self, file_bytes: bytes, content_type: str, filename: str, metadata: Dict[str, Any] = None) -> List[Document]:
        """Load documents from bytes."""
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=self._get_extension(content_type)) as tmp_file:
                tmp_file.write(file_bytes)
                tmp_file_path = tmp_file.name
            
            try:
                # Add filename to metadata
                file_metadata = metadata or {}
                file_metadata.update({
                    "filename": filename,
                    "content_type": content_type,
                    "size_bytes": len(file_bytes)
                })
                
                documents = self.load_from_file(tmp_file_path, content_type, file_metadata)
                return documents
                
            finally:
                # Clean up temporary file
                os.unlink(tmp_file_path)
                
        except Exception as e:
            logger.error(f"Failed to load document from bytes: {e}")
            raise
    
    def _load_pdf(self, file_path: str, metadata: Dict[str, Any]) -> List[Document]:
        """Load PDF document using PyMuPDF."""
        try:
            documents = []
            pdf_doc = fitz.open(file_path)
            
            for page_num, page in enumerate(pdf_doc):
                text = page.get_text()
                if text.strip():  # Skip empty pages
                    page_metadata = metadata.copy()
                    page_metadata.update({
                        "page": page_num + 1,
                        "total_pages": len(pdf_doc)
                    })
                    
                    documents.append(Document(
                        page_content=text,
                        metadata=page_metadata
                    ))
            
            pdf_doc.close()
            return documents
            
        except Exception as e:
            logger.error(f"Failed to load PDF: {e}")
            raise
    
    def _load_text(self, file_path: str, metadata: Dict[str, Any]) -> List[Document]:
        """Load text document."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
            
            return [Document(
                page_content=text,
                metadata=metadata
            )]
            
        except Exception as e:
            logger.error(f"Failed to load text file: {e}")
            raise
    
    def _load_csv(self, file_path: str, metadata: Dict[str, Any]) -> List[Document]:
        """Load CSV document using unstructured library."""
        try:
            # Use unstructured's partition function which will automatically detect CSV
            elements = partition(filename=file_path)
            
            documents = []
            for element in elements:
                if hasattr(element, 'text') and element.text.strip():
                    element_metadata = metadata.copy()
                    element_metadata.update({
                        "element_type": element.category if hasattr(element, 'category') else "table",
                        "file_type": "csv"
                    })
                    
                    documents.append(Document(
                        page_content=element.text,
                        metadata=element_metadata
                    ))
            
            # If no elements were extracted, try to read as plain text
            if not documents:
                logger.warning(f"No structured elements found in CSV, reading as plain text")
                with open(file_path, 'r', encoding='utf-8') as file:
                    text = file.read()
                if text.strip():
                    documents.append(Document(
                        page_content=text,
                        metadata=metadata
                    ))
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            raise
    
    def _load_with_unstructured(self, file_path: str, metadata: Dict[str, Any]) -> List[Document]:
        """Load document using unstructured library."""
        try:
            elements = partition(filename=file_path)
            
            documents = []
            for element in elements:
                if hasattr(element, 'text') and element.text.strip():
                    element_metadata = metadata.copy()
                    element_metadata.update({
                        "element_type": element.category if hasattr(element, 'category') else "unknown"
                    })
                    
                    documents.append(Document(
                        page_content=element.text,
                        metadata=element_metadata
                    ))
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to load with unstructured: {e}")
            raise
    
    def _get_extension(self, content_type: str) -> str:
        """Get file extension from content type."""
        extensions = {
            "application/pdf": ".pdf",
            "text/plain": ".txt",
            "text/markdown": ".md",
            "text/csv": ".csv",
            "application/csv": ".csv",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        }
        return extensions.get(content_type, ".txt")


# Global loader instance
document_loader = DocumentLoader()