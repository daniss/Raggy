import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from .client_config import get_client_config, get_current_client_id, ClientConfig


class Settings(BaseSettings):
    """Application settings configuration."""
    
    # API Configuration
    api_title: str = "Raggy - SaaS RAG Platform API"
    api_version: str = "1.0.0"
    api_description: str = "Plateforme SaaS RAG pour entreprises françaises - Assistant IA privé multi-tenant"
    
    # Environment
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=True, env="DEBUG")
    
    # CORS
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"], 
        env="CORS_ORIGINS"
    )
    
    # Groq API
    groq_api_key: str = Field(..., env="GROQ_API_KEY")
    groq_model: str = Field(default="deepseek-r1-distill-llama-70b", env="GROQ_MODEL")
    
    # Supabase
    supabase_url: str = Field(..., env="SUPABASE_URL")
    supabase_service_key: str = Field(..., env="SUPABASE_SERVICE_KEY")
    
    # Database
    database_url: str = Field(..., env="DATABASE_URL")
    
    # RAG Configuration
    embedding_model: str = Field(
        default="intfloat/multilingual-e5-base", 
        env="EMBEDDING_MODEL"
    )
    chunk_size: int = Field(default=1000, env="CHUNK_SIZE")
    chunk_overlap: int = Field(default=200, env="CHUNK_OVERLAP")
    retrieval_k: int = Field(default=8, env="RETRIEVAL_K")
    
    # Advanced RAG Configuration
    use_hybrid_search: bool = Field(default=True, env="USE_HYBRID_SEARCH")
    use_reranking: bool = Field(default=False, env="USE_RERANKING")  # Disabled by default for speed
    use_query_enhancement: bool = Field(default=False, env="USE_QUERY_ENHANCEMENT")  # Disabled by default for speed
    use_semantic_chunking: bool = Field(default=True, env="USE_SEMANTIC_CHUNKING")
    use_adaptive_chunking: bool = Field(default=True, env="USE_ADAPTIVE_CHUNKING")
    
    # Performance Configuration
    fast_mode: bool = Field(default=True, env="FAST_MODE")  # Enable fast mode by default
    max_context_docs: int = Field(default=5, env="MAX_CONTEXT_DOCS")  # Limit context documents
    enable_lightweight_rerank: bool = Field(default=True, env="ENABLE_LIGHTWEIGHT_RERANK")
    
    # Hybrid Search Configuration
    dense_weight: float = Field(default=0.7, env="DENSE_WEIGHT")
    sparse_weight: float = Field(default=0.3, env="SPARSE_WEIGHT")
    bm25_k1: float = Field(default=1.2, env="BM25_K1")
    bm25_b: float = Field(default=0.75, env="BM25_B")
    
    # Reranking Configuration
    max_rerank_docs: int = Field(default=20, env="MAX_RERANK_DOCS")
    final_top_k: int = Field(default=8, env="FINAL_TOP_K")
    cross_encoder_model: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2", 
        env="CROSS_ENCODER_MODEL"
    )
    
    # Cache Configuration
    cache_ttl_minutes: int = Field(default=60, env="CACHE_TTL_MINUTES")
    enable_embedding_cache: bool = Field(default=True, env="ENABLE_EMBEDDING_CACHE")
    enable_query_cache: bool = Field(default=True, env="ENABLE_QUERY_CACHE")
    
    # LLM Configuration
    llm_temperature: float = Field(default=0.0, env="LLM_TEMPERATURE")
    max_tokens: int = Field(default=3000, env="MAX_TOKENS")
    
    # Monitoring
    sentry_dsn: str = Field(default="", env="SENTRY_DSN")
    
    # Redis Configuration
    redis_url: Optional[str] = Field(default=None, env="REDIS_URL")
    
    # Organization & SaaS Configuration
    default_org_plan: str = Field(default="free", env="DEFAULT_ORG_PLAN")
    max_orgs_per_user: int = Field(default=1, env="MAX_ORGS_PER_USER")
    max_users_per_org_free: int = Field(default=10, env="MAX_USERS_PER_ORG_FREE")
    max_documents_per_org_free: int = Field(default=100, env="MAX_DOCUMENTS_PER_ORG_FREE")
    max_storage_mb_per_org_free: int = Field(default=500, env="MAX_STORAGE_MB_PER_ORG_FREE")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


class ClientAwareSettings:
    """
    Settings wrapper that integrates client-specific configuration.
    This allows the application to dynamically adapt based on the current client.
    """
    
    def __init__(self):
        self._base_settings = settings
        self._client_config_cache = {}
    
    def get_client_settings(self, client_id: Optional[str] = None) -> dict:
        """Get settings combined with client-specific configuration"""
        if client_id is None:
            client_id = get_current_client_id()
        
        if client_id not in self._client_config_cache:
            client_config = get_client_config(client_id)
            self._client_config_cache[client_id] = self._merge_settings(client_config)
        
        return self._client_config_cache[client_id]
    
    def _merge_settings(self, client_config: ClientConfig) -> dict:
        """Merge base settings with client configuration"""
        merged = self._base_settings.dict()
        
        # Override with client-specific values
        merged.update({
            # Client info
            "client_id": client_config.client_id,
            "client_name": client_config.client_name,
            "client_language": client_config.language,
            "client_industry": client_config.industry,
            
            # API configuration
            "api_title": f"{client_config.branding.company_name} - RAG Platform API",
            "api_description": f"Private RAG platform for {client_config.branding.company_name}",
            
            # RAG configuration from client config
            "groq_model": client_config.rag.model.get("default", merged["groq_model"]),
            "embedding_model": client_config.rag.embedding_model,
            "llm_temperature": client_config.rag.temperature,
            "max_tokens": client_config.rag.max_tokens,
            "retrieval_k": client_config.rag.top_k,
            
            # Hybrid search weights
            "dense_weight": client_config.rag.vector_weight,
            "sparse_weight": client_config.rag.keyword_weight,
            
            # Feature flags
            "use_hybrid_search": client_config.rag.retrieval_strategy == "hybrid",
            "use_reranking": client_config.rag.reranking_enabled,
            "use_query_enhancement": client_config.rag.query_enhancement_enabled,
            
            # Plan limits
            "max_users_per_org": client_config.limits.max_users,
            "max_documents_per_org": client_config.limits.max_documents,
            "max_document_size_mb": client_config.limits.max_document_size_mb,
            "max_queries_per_day": client_config.limits.max_queries_per_day,
        })
        
        return merged
    
    def __getattr__(self, name):
        """Fallback to base settings for attributes not handled by client config"""
        return getattr(self._base_settings, name)
    
    def get_for_client(self, client_id: str) -> dict:
        """Get settings for a specific client"""
        return self.get_client_settings(client_id)


# Global client-aware settings instance
client_settings = ClientAwareSettings()