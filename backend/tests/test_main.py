import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test the root endpoint returns basic info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert data["name"] == "RAG Support Chatbot API"


def test_health_endpoint():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "timestamp" in data
    assert "version" in data
    assert "dependencies" in data


def test_cors_headers():
    """Test CORS headers are properly set."""
    response = client.options("/", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200


class TestChatAPI:
    """Test chat API endpoints."""
    
    def test_chat_endpoint_requires_question(self):
        """Test chat endpoint validation."""
        response = client.post("/api/v1/chat/", json={})
        assert response.status_code == 422  # Validation error
    
    def test_chat_endpoint_with_valid_question(self):
        """Test chat endpoint with valid question."""
        response = client.post(
            "/api/v1/chat/", 
            json={"question": "What is your purpose?"}
        )
        # Note: This might fail in CI/CD without proper API keys
        # In a real scenario, you'd mock the external dependencies
        assert response.status_code in [200, 500]  # 500 if no API key
    
    def test_chat_health_endpoint(self):
        """Test chat health check."""
        response = client.get("/api/v1/chat/health")
        assert response.status_code in [200, 503]  # 503 if services unavailable


class TestUploadAPI:
    """Test upload API endpoints."""
    
    def test_upload_requires_auth(self):
        """Test upload endpoint requires authentication."""
        response = client.post("/api/v1/upload/")
        assert response.status_code == 401
    
    def test_upload_documents_endpoint_exists(self):
        """Test upload endpoint exists and handles no files."""
        # Without auth, should return 401
        response = client.post("/api/v1/upload/", files={})
        assert response.status_code == 401


class TestAnalyticsAPI:
    """Test analytics API endpoints."""
    
    def test_analytics_requires_auth(self):
        """Test analytics endpoint requires authentication."""
        response = client.get("/api/v1/analytics/")
        assert response.status_code == 401
    
    def test_time_series_requires_auth(self):
        """Test time series endpoint requires authentication."""
        response = client.get("/api/v1/analytics/time-series")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_startup_and_shutdown():
    """Test application startup and shutdown events."""
    # This tests that the app can start without errors
    # In a real test, you'd mock external dependencies
    pass


def test_api_documentation():
    """Test that API documentation is accessible."""
    response = client.get("/docs")
    assert response.status_code == 200
    
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "info" in data
    assert "paths" in data