import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


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
    use_reranking: bool = Field(default=True, env="USE_RERANKING")
    use_query_enhancement: bool = Field(default=True, env="USE_QUERY_ENHANCEMENT")
    use_semantic_chunking: bool = Field(default=True, env="USE_SEMANTIC_CHUNKING")
    use_adaptive_chunking: bool = Field(default=True, env="USE_ADAPTIVE_CHUNKING")
    
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
    max_tokens: int = Field(default=1000, env="MAX_TOKENS")
    
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