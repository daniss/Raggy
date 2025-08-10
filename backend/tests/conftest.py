"""
Shared test fixtures and configuration for Raggy tests.
"""

import pytest
import asyncio
import tempfile
import os
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any, Generator
from pathlib import Path

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.db.supabase_client import supabase_client


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def client():
    """Create a test client for the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def demo_org_id():
    """Demo organization ID used across tests."""
    return getattr(settings, 'demo_org_id', 'demo-org-12345')


@pytest.fixture(scope="session")
def test_org_id():
    """Test organization ID for isolated testing."""
    return "test-org-pytest-12345"


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for testing."""
    with patch('app.db.supabase_client.supabase_client') as mock_client:
        # Configure mock client with common responses
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        
        # Mock common query patterns
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.delete.return_value = mock_table
        mock_table.limit.return_value = mock_table
        
        # Default execute response
        mock_table.execute.return_value = Mock(data=[], count=0)
        
        yield mock_client


@pytest.fixture
def mock_embedder():
    """Mock HuggingFace embedder for testing."""
    with patch('app.rag.embedder.HuggingFaceEmbedder') as mock_embedder_class:
        # Mock embedder instance
        mock_embedder_instance = Mock()
        
        # Mock embedding methods
        mock_embedder_instance.embed_documents.return_value = [[0.1] * 384] * 10
        mock_embedder_instance.embed_query.return_value = [0.1] * 384
        mock_embedder_instance.model_name = "test-embedding-model"
        mock_embedder_instance.device = "cpu"
        
        mock_embedder_class.return_value = mock_embedder_instance
        yield mock_embedder_instance


@pytest.fixture
def mock_groq():
    """Mock Groq API client for testing."""
    with patch('app.rag.qa_chain.groq_client') as mock_client:
        # Mock chat completion response
        mock_response = Mock()
        mock_response.choices = [
            Mock(message=Mock(content="This is a mocked response from the RAG system."))
        ]
        
        mock_client.chat.completions.create.return_value = mock_response
        yield mock_client


@pytest.fixture
def mock_retriever():
    """Mock retriever for testing."""
    with patch('app.rag.retriever') as mock_retriever:
        # Mock similarity search
        mock_retriever.similarity_search.return_value = [
            {
                "content": "This is test content from the RAG system.",
                "metadata": {
                    "filename": "test_document.pdf",
                    "chunk_index": 0
                },
                "relevance_score": 0.85
            }
        ]
        
        # Mock collection stats
        mock_retriever.get_collection_stats.return_value = {
            "total_documents": 5,
            "total_vectors": 25,
            "embedding_dimension": 384
        }
        
        yield mock_retriever


@pytest.fixture
def sample_document_data():
    """Sample document data for testing."""
    return {
        "id": "test-doc-123",
        "organization_id": "demo-org-12345",
        "filename": "test_document.pdf",
        "title": "Test Document for RAG",
        "content_type": "application/pdf",
        "file_size": 1024,
        "upload_status": "completed",
        "processing_status": "completed",
        "vector_count": 5,
        "metadata": {
            "category": "test",
            "uploaded_by": "test_user"
        }
    }


@pytest.fixture
def sample_vector_data():
    """Sample vector data for testing."""
    return {
        "id": "test-vector-123",
        "organization_id": "demo-org-12345",
        "document_id": "test-doc-123",
        "chunk_index": 0,
        "content": "This is a test chunk of content for vector embedding.",
        "embedding": [0.1] * 384,
        "metadata": {
            "filename": "test_document.pdf",
            "chunk_size": 64
        }
    }


@pytest.fixture
def temp_file():
    """Create a temporary file for testing."""
    with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt') as f:
        f.write("This is test content for file processing.")
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        pass


@pytest.fixture
def temp_pdf_file():
    """Create a temporary PDF-like file for testing."""
    content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 24 Tf
100 700 Td
(Test RAG Document) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000110 00000 n 
0000000190 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
287
%%EOF"""
    
    with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.pdf') as f:
        f.write(content)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        pass


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    with patch('app.core.redis_cache.redis_cache') as mock_cache:
        # Mock cache operations
        mock_cache.get.return_value = None
        mock_cache.set.return_value = True
        mock_cache.delete.return_value = True
        mock_cache.health_check.return_value = True
        mock_cache.get_stats.return_value = {
            "hit_rate": 85,
            "total_keys": 100,
            "memory_usage": "2.5MB"
        }
        
        yield mock_cache


@pytest.fixture(autouse=True)
def mock_external_services(mock_embedder, mock_groq, mock_redis):
    """Automatically mock external services for all tests."""
    # This fixture runs automatically for all tests
    # Individual tests can override specific mocks if needed
    pass


@pytest.fixture
def clean_test_data():
    """Fixture to clean test data before and after tests."""
    # Cleanup before test
    try:
        supabase_client.table("document_vectors").delete().eq("organization_id", "test-org-pytest-12345").execute()
        supabase_client.table("documents").delete().eq("organization_id", "test-org-pytest-12345").execute()
    except Exception:
        pass  # Ignore cleanup errors
    
    yield
    
    # Cleanup after test
    try:
        supabase_client.table("document_vectors").delete().eq("organization_id", "test-org-pytest-12345").execute()
        supabase_client.table("documents").delete().eq("organization_id", "test-org-pytest-12345").execute()
    except Exception:
        pass  # Ignore cleanup errors


@pytest.fixture
def mock_settings():
    """Mock application settings for testing."""
    test_settings = {
        "demo_org_id": "demo-org-12345",
        "enable_demo_mode": True,
        "max_documents": 1000,
        "max_upload_size_mb": 50,
        "embedding_model": "test-embedding-model",
        "groq_model": "test-groq-model",
        "debug": True,
        "testing": True
    }
    
    with patch.multiple(settings, **test_settings):
        yield test_settings


@pytest.fixture
def sample_chat_request():
    """Sample chat request data for testing."""
    return {
        "question": "What is the purpose of this RAG system?",
        "organization_id": "demo-org-12345",
        "conversation_id": "test-conversation-123"
    }


@pytest.fixture
def sample_upload_file():
    """Sample file upload data for testing."""
    return {
        "filename": "test_document.pdf",
        "content_type": "application/pdf",
        "file_size": 1024,
        "organization_id": "demo-org-12345"
    }


# Pytest markers for test organization
pytest.main.pytest_plugins = [
    "pytest_asyncio",
    "pytest_cov"
]


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: mark test as unit test")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "demo: mark test as demo flow test")
    config.addinivalue_line("markers", "purge: mark test as purge functionality test")
    config.addinivalue_line("markers", "api: mark test as API endpoint test")
    config.addinivalue_line("markers", "rag: mark test as RAG pipeline test")
    config.addinivalue_line("markers", "database: mark test as database related")


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically."""
    for item in items:
        # Auto-mark tests based on file names
        if "test_demo_flow" in str(item.fspath):
            item.add_marker(pytest.mark.demo)
            item.add_marker(pytest.mark.integration)
        
        if "test_purge" in str(item.fspath):
            item.add_marker(pytest.mark.purge)
            item.add_marker(pytest.mark.integration)
        
        if "test_main" in str(item.fspath):
            item.add_marker(pytest.mark.api)
            item.add_marker(pytest.mark.unit)
        
        if "test_rag" in str(item.fspath):
            item.add_marker(pytest.mark.rag)
            item.add_marker(pytest.mark.unit)
        
        # Mark async tests
        if asyncio.iscoroutinefunction(item.obj):
            item.add_marker(pytest.mark.asyncio)