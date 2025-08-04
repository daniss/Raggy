import pytest
from unittest.mock import Mock, patch
from app.rag.embedder import HuggingFaceEmbedder
from app.rag.loader import DocumentLoader
from app.rag.splitter import DocumentSplitter
from langchain.schema import Document


class TestHuggingFaceEmbedder:
    """Test HuggingFace embeddings functionality."""
    
    @patch('app.rag.embedder.SentenceTransformer')
    def test_embedder_initialization(self, mock_transformer):
        """Test embedder initializes correctly."""
        mock_model = Mock()
        mock_transformer.return_value = mock_model
        
        embedder = HuggingFaceEmbedder()
        
        assert embedder.model_name == "sentence-transformers/all-MiniLM-L6-v2"
        assert embedder.device in ["cuda", "cpu"]
        mock_transformer.assert_called_once()
    
    @patch('app.rag.embedder.SentenceTransformer')
    def test_embed_documents(self, mock_transformer):
        """Test document embedding functionality."""
        mock_model = Mock()
        mock_model.encode.return_value = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        mock_transformer.return_value = mock_model
        
        embedder = HuggingFaceEmbedder()
        texts = ["Hello world", "Test document"]
        
        embeddings = embedder.embed_documents(texts)
        
        assert len(embeddings) == 2
        assert len(embeddings[0]) == 3
        mock_model.encode.assert_called_once()
    
    @patch('app.rag.embedder.SentenceTransformer')
    def test_embed_query(self, mock_transformer):
        """Test query embedding functionality."""
        mock_model = Mock()
        mock_model.encode.return_value = [[0.1, 0.2, 0.3]]
        mock_transformer.return_value = mock_model
        
        embedder = HuggingFaceEmbedder()
        query = "What is this about?"
        
        embedding = embedder.embed_query(query)
        
        assert len(embedding) == 3
        assert embedding == [0.1, 0.2, 0.3]


class TestDocumentLoader:
    """Test document loading functionality."""
    
    def test_loader_initialization(self):
        """Test loader initializes with supported formats."""
        loader = DocumentLoader()
        
        expected_formats = {
            "application/pdf",
            "text/plain", 
            "text/markdown",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        
        assert set(loader.supported_formats.keys()) == expected_formats
    
    def test_get_extension(self):
        """Test file extension detection."""
        loader = DocumentLoader()
        
        assert loader._get_extension("application/pdf") == ".pdf"
        assert loader._get_extension("text/plain") == ".txt"
        assert loader._get_extension("unknown/type") == ".txt"
    
    @patch('builtins.open', create=True)
    def test_load_text_file(self, mock_open):
        """Test loading text files."""
        mock_open.return_value.__enter__.return_value.read.return_value = "Test content"
        
        loader = DocumentLoader()
        documents = loader._load_text("/fake/path.txt", {"filename": "test.txt"})
        
        assert len(documents) == 1
        assert documents[0].page_content == "Test content"
        assert documents[0].metadata["filename"] == "test.txt"


class TestDocumentSplitter:
    """Test document splitting functionality."""
    
    def test_splitter_initialization(self):
        """Test splitter initializes correctly."""
        splitter = DocumentSplitter(chunk_size=500, chunk_overlap=50)
        
        assert splitter.chunk_size == 500
        assert splitter.chunk_overlap == 50
    
    def test_split_documents(self):
        """Test document splitting."""
        splitter = DocumentSplitter(chunk_size=100, chunk_overlap=20)
        
        # Create a long document
        long_text = "This is a test document. " * 20  # ~500 characters
        doc = Document(page_content=long_text, metadata={"source": "test"})
        
        chunks = splitter.split_documents([doc])
        
        assert len(chunks) > 1  # Should be split into multiple chunks
        
        # Check that chunks have proper metadata
        for i, chunk in enumerate(chunks):
            assert "chunk_index" in chunk.metadata
            assert "total_chunks" in chunk.metadata
            assert chunk.metadata["chunk_index"] == i
            assert chunk.metadata["source"] == "test"
    
    def test_split_text(self):
        """Test text splitting."""
        splitter = DocumentSplitter(chunk_size=50, chunk_overlap=10)
        
        text = "This is a long text that should be split into multiple chunks for testing purposes."
        chunks = splitter.split_text(text, {"source": "test"})
        
        assert len(chunks) > 1
        assert all(len(chunk.page_content) <= 60 for chunk in chunks)  # Some tolerance
    
    def test_get_chunk_stats(self):
        """Test chunk statistics calculation."""
        splitter = DocumentSplitter()
        
        chunks = [
            Document(page_content="Short", metadata={}),
            Document(page_content="This is a longer chunk", metadata={}),
            Document(page_content="Medium length", metadata={})
        ]
        
        stats = splitter.get_chunk_stats(chunks)
        
        assert stats["count"] == 3
        assert stats["avg_size"] > 0
        assert stats["min_size"] == 5  # "Short"
        assert stats["max_size"] == 22  # "This is a longer chunk"


class TestRAGIntegration:
    """Test RAG pipeline integration."""
    
    @patch('app.rag.embedder.SentenceTransformer')
    @patch('app.db.supabase_client.supabase_client')
    def test_rag_pipeline_flow(self, mock_supabase, mock_transformer):
        """Test complete RAG pipeline flow."""
        # Mock embedder
        mock_model = Mock()
        mock_model.encode.return_value = [[0.1, 0.2, 0.3]]
        mock_transformer.return_value = mock_model
        
        # Mock Supabase client
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.execute.return_value = Mock(data=[])
        
        # Test document processing
        from app.rag.loader import DocumentLoader
        from app.rag.splitter import DocumentSplitter
        from app.rag.embedder import HuggingFaceEmbedder
        
        loader = DocumentLoader()
        splitter = DocumentSplitter()
        embedder = HuggingFaceEmbedder()
        
        # Create test document
        test_doc = Document(
            page_content="This is a test document for RAG pipeline testing.",
            metadata={"filename": "test.txt"}
        )
        
        # Split document
        chunks = splitter.split_documents([test_doc])
        assert len(chunks) >= 1
        
        # Generate embeddings
        texts = [chunk.page_content for chunk in chunks]
        embeddings = embedder.embed_documents(texts)
        assert len(embeddings) == len(chunks)


@pytest.fixture
def sample_document():
    """Create a sample document for testing."""
    return Document(
        page_content="This is a sample document for testing the RAG pipeline functionality.",
        metadata={"filename": "sample.txt", "source": "test"}
    )


@pytest.fixture
def sample_chunks():
    """Create sample chunks for testing."""
    return [
        Document(
            page_content="First chunk of content",
            metadata={"chunk_index": 0, "filename": "test.txt"}
        ),
        Document(
            page_content="Second chunk of content", 
            metadata={"chunk_index": 1, "filename": "test.txt"}
        ),
        Document(
            page_content="Third chunk of content",
            metadata={"chunk_index": 2, "filename": "test.txt"}
        )
    ]


class TestRAGErrorHandling:
    """Test error handling in RAG components."""
    
    @patch('app.rag.embedder.SentenceTransformer')
    def test_embedder_error_handling(self, mock_transformer):
        """Test embedder handles errors gracefully."""
        mock_transformer.side_effect = Exception("Model loading failed")
        
        with pytest.raises(Exception):
            HuggingFaceEmbedder()
    
    def test_loader_unsupported_format(self):
        """Test loader handles unsupported formats."""
        loader = DocumentLoader()
        
        with pytest.raises(ValueError, match="Unsupported file type"):
            loader.load_from_file("/fake/path.xyz", "application/unknown", {})
    
    def test_splitter_empty_documents(self):
        """Test splitter handles empty documents."""
        splitter = DocumentSplitter()
        
        chunks = splitter.split_documents([])
        assert chunks == []
        
        stats = splitter.get_chunk_stats([])
        assert stats["count"] == 0
        assert stats["avg_size"] == 0