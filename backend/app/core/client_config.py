"""
Client Configuration Management System

This module provides a centralized system for loading and managing client-specific configurations.
It supports hierarchical configuration loading (defaults -> client -> environment) and runtime
configuration updates for the consulting-ready RAG platform.
"""

import os
import yaml
from typing import Dict, Any, Optional, List
from pathlib import Path
from functools import lru_cache
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)


class ClientConfigError(Exception):
    """Exception raised for client configuration errors"""
    pass


class RAGConfig(BaseModel):
    """RAG Pipeline Configuration"""
    provider: str = "groq"
    model: Dict[str, str] = Field(default_factory=lambda: {"default": "deepseek-r1-distill-llama-70b"})
    temperature: float = 0.1
    max_tokens: int = 2048
    streaming: bool = True
    
    # Embeddings
    embedding_model: str = "intfloat/multilingual-e5-large-instruct"
    embedding_dimensions: int = 384
    
    # Retrieval
    retrieval_strategy: str = "hybrid"
    vector_weight: float = 0.7
    keyword_weight: float = 0.3
    top_k: int = 10
    reranking_enabled: bool = True
    query_enhancement_enabled: bool = True


class SecurityConfig(BaseModel):
    """Security Configuration"""
    auth_methods: List[str] = Field(default_factory=lambda: ["supabase"])
    password_min_length: int = 12
    session_timeout_minutes: int = 30
    encryption_at_rest: bool = True
    ip_whitelist: List[str] = Field(default_factory=list)


class LimitsConfig(BaseModel):
    """Usage Limits Configuration"""
    max_users: int = 100
    max_documents: int = 10000
    max_document_size_mb: int = 50
    max_queries_per_day: int = 10000
    max_api_calls_per_minute: int = 100


class BrandingConfig(BaseModel):
    """UI Branding Configuration"""
    company_name: str = "RAG System"
    logo_path: str = "assets/logo.svg"
    primary_color: str = "#0066CC"
    secondary_color: str = "#6B7280"
    theme: str = "light"


class FeaturesConfig(BaseModel):
    """Feature Flags Configuration"""
    document_upload: bool = True
    chat_interface: bool = True
    search: bool = True
    analytics: bool = True
    admin_panel: bool = True
    api_access: bool = True
    collaboration: bool = False
    workflow_automation: bool = False


class ClientConfig(BaseModel):
    """Complete Client Configuration"""
    client_id: str
    client_name: str
    environment: str = "production"
    language: str = "fr"
    country: str = "FR"
    industry: str = "general"
    
    # Sub-configurations
    rag: RAGConfig = Field(default_factory=RAGConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    branding: BrandingConfig = Field(default_factory=BrandingConfig)
    features: FeaturesConfig = Field(default_factory=FeaturesConfig)
    
    # Additional configuration
    custom_config: Dict[str, Any] = Field(default_factory=dict)


class ClientConfigManager:
    """
    Manages client-specific configurations with hierarchical loading and caching.
    
    Configuration loading order:
    1. Default configuration
    2. Client-specific configuration
    3. Environment variables override
    """
    
    def __init__(self, base_path: str = "/clients"):
        self.base_path = Path(base_path)
        self._config_cache: Dict[str, ClientConfig] = {}
        self._default_config: Optional[ClientConfig] = None
        
        # Ensure base path exists
        if not self.base_path.exists():
            # Fallback to local clients directory during development
            self.base_path = Path(__file__).parent.parent.parent.parent / "clients"
            
        logger.info(f"ClientConfigManager initialized with base path: {self.base_path}")
    
    @lru_cache(maxsize=None)
    def get_client_config(self, client_id: str) -> ClientConfig:
        """
        Load and cache client configuration.
        
        Args:
            client_id: Unique client identifier
            
        Returns:
            ClientConfig: Complete client configuration
            
        Raises:
            ClientConfigError: If configuration cannot be loaded
        """
        if client_id in self._config_cache:
            return self._config_cache[client_id]
        
        try:
            config = self._load_client_config(client_id)
            self._config_cache[client_id] = config
            return config
            
        except Exception as e:
            logger.error(f"Failed to load configuration for client {client_id}: {e}")
            raise ClientConfigError(f"Configuration error for client {client_id}: {e}")
    
    def _load_client_config(self, client_id: str) -> ClientConfig:
        """Load client configuration from files and environment"""
        
        # Load default configuration
        default_config = self._load_default_config()
        
        # Load client-specific configuration
        client_path = self.base_path / client_id / "config"
        if not client_path.exists():
            logger.warning(f"Client configuration path not found: {client_path}")
            # Use template as fallback
            client_path = self.base_path / "template" / "config"
        
        # Load main client config
        client_config_data = {}
        client_yaml_path = client_path / "client.yaml"
        if client_yaml_path.exists():
            with open(client_yaml_path, 'r', encoding='utf-8') as f:
                client_config_data = yaml.safe_load(f) or {}
        
        # Load RAG config
        rag_config_data = {}
        rag_yaml_path = client_path / "rag.yaml"
        if rag_yaml_path.exists():
            with open(rag_yaml_path, 'r', encoding='utf-8') as f:
                rag_config_data = yaml.safe_load(f) or {}
        
        # Merge configurations
        merged_config = self._merge_configs(default_config, client_config_data, rag_config_data)
        merged_config["client_id"] = client_id
        
        # Apply environment variable overrides
        merged_config = self._apply_env_overrides(merged_config, client_id)
        
        return ClientConfig(**merged_config)
    
    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration"""
        if self._default_config is not None:
            return self._default_config.dict()
        
        default_config = {
            "client_id": "default",
            "client_name": "Default Client",
            "environment": "production",
            "language": "fr",
            "country": "FR",
            "industry": "general"
        }
        
        self._default_config = ClientConfig(**default_config)
        return default_config
    
    def _merge_configs(self, base_config: Dict[str, Any], 
                      client_config: Dict[str, Any], 
                      rag_config: Dict[str, Any]) -> Dict[str, Any]:
        """Merge multiple configuration dictionaries"""
        
        merged = base_config.copy()
        
        # Deep merge client configuration
        self._deep_merge(merged, client_config)
        
        # Add RAG configuration
        if rag_config:
            merged["rag"] = rag_config.get("llm", {})
            if "embeddings" in rag_config:
                merged["rag"].update(rag_config["embeddings"])
            if "retrieval" in rag_config:
                merged["rag"].update(rag_config["retrieval"])
        
        return merged
    
    def _deep_merge(self, target: Dict[str, Any], source: Dict[str, Any]):
        """Recursively merge dictionaries"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._deep_merge(target[key], value)
            else:
                target[key] = value
    
    def _apply_env_overrides(self, config: Dict[str, Any], client_id: str) -> Dict[str, Any]:
        """Apply environment variable overrides"""
        
        # Client-specific environment variables
        env_prefix = f"{client_id.upper().replace('-', '_')}_"
        
        # Common overrides
        env_overrides = {
            f"{env_prefix}LANGUAGE": "language",
            f"{env_prefix}ENVIRONMENT": "environment",
            "CLIENT_ID": "client_id",
            "RAG_PROVIDER": "rag.provider",
            "RAG_MODEL": "rag.model.default",
            "RAG_TEMPERATURE": "rag.temperature",
            "EMBEDDING_MODEL": "rag.embedding_model",
        }
        
        for env_var, config_path in env_overrides.items():
            value = os.getenv(env_var)
            if value is not None:
                self._set_nested_value(config, config_path, value)
        
        return config
    
    def _set_nested_value(self, config: Dict[str, Any], path: str, value: Any):
        """Set nested dictionary value using dot notation"""
        keys = path.split('.')
        current = config
        
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        # Type conversion for common values
        if value.lower() in ('true', 'false'):
            value = value.lower() == 'true'
        elif value.isdigit():
            value = int(value)
        elif value.replace('.', '', 1).isdigit():
            value = float(value)
        
        current[keys[-1]] = value
    
    def reload_config(self, client_id: str):
        """Reload configuration for a specific client"""
        if client_id in self._config_cache:
            del self._config_cache[client_id]
        self.get_client_config.cache_clear()
        return self.get_client_config(client_id)
    
    def get_prompt_template(self, client_id: str, template_name: str) -> str:
        """Load prompt template for client"""
        client_path = self.base_path / client_id / "prompts"
        if not client_path.exists():
            client_path = self.base_path / "template" / "prompts"
        
        template_path = client_path / f"{template_name}.txt"
        if not template_path.exists():
            raise ClientConfigError(f"Prompt template not found: {template_name}")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def list_clients(self) -> List[str]:
        """List all available client configurations"""
        if not self.base_path.exists():
            return []
        
        clients = []
        for path in self.base_path.iterdir():
            if path.is_dir() and (path / "config" / "client.yaml").exists():
                clients.append(path.name)
        
        return clients


# Global configuration manager instance
config_manager = ClientConfigManager()


def get_client_config(client_id: Optional[str] = None) -> ClientConfig:
    """
    Get client configuration. 
    Falls back to environment variable CLIENT_ID if not provided.
    """
    if client_id is None:
        client_id = os.getenv("CLIENT_ID", "template")
    
    return config_manager.get_client_config(client_id)


def get_current_client_id() -> str:
    """Get the current client ID from environment or default"""
    return os.getenv("CLIENT_ID", "template")


def get_prompt_template(template_name: str, client_id: Optional[str] = None) -> str:
    """Get prompt template for current or specified client"""
    if client_id is None:
        client_id = get_current_client_id()
    
    return config_manager.get_prompt_template(client_id, template_name)