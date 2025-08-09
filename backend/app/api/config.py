"""
Configuration API endpoints for client-specific settings.

Provides endpoints to fetch client configuration, theme settings,
and feature flags for the frontend application.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import logging

from ..core.client_config import get_client_config, config_manager, ClientConfig
from ..core.config import client_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config", tags=["configuration"])


@router.get("/client/{client_id}")
async def get_client_configuration(client_id: str) -> Dict[str, Any]:
    """
    Get complete client configuration including branding, features, and settings.
    
    Args:
        client_id: Unique client identifier
        
    Returns:
        Dict containing client configuration
    """
    try:
        client_config = get_client_config(client_id)
        
        return {
            "client_id": client_config.client_id,
            "client_name": client_config.client_name,
            "language": client_config.language,
            "country": client_config.country,
            "industry": client_config.industry,
            "branding": {
                "company_name": client_config.branding.company_name,
                "logo_path": client_config.branding.logo_path,
                "favicon_path": client_config.branding.favicon_path,
                "colors": client_config.branding.primary_color,  # Simplified for API
                "theme": client_config.branding.theme,
                "show_powered_by": client_config.branding.show_powered_by
            },
            "features": {
                "document_upload": client_config.features.document_upload,
                "chat_interface": client_config.features.chat_interface,
                "search": client_config.features.search,
                "analytics": client_config.features.analytics,
                "admin_panel": client_config.features.admin_panel,
                "api_access": client_config.features.api_access,
                "collaboration": client_config.features.collaboration,
                "workflow_automation": client_config.features.workflow_automation,
            },
            "limits": {
                "max_documents": client_config.limits.max_documents,
                "max_document_size_mb": client_config.limits.max_document_size_mb,
                "max_users": client_config.limits.max_users,
                "max_queries_per_day": client_config.limits.max_queries_per_day
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get client configuration for {client_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Client configuration not found: {client_id}")


@router.get("/current")
async def get_current_client_configuration() -> Dict[str, Any]:
    """Get configuration for the current client (from environment)."""
    from ..core.client_config import get_current_client_id
    
    client_id = get_current_client_id()
    return await get_client_configuration(client_id)


@router.get("/theme/{client_id}")
async def get_client_theme(client_id: str) -> Dict[str, Any]:
    """
    Get theme-specific configuration for a client.
    
    Args:
        client_id: Unique client identifier
        
    Returns:
        Dict containing theme configuration
    """
    try:
        client_config = get_client_config(client_id)
        
        return {
            "client_id": client_id,
            "branding": {
                "company_name": client_config.branding.company_name,
                "logo_path": client_config.branding.logo_path,
                "favicon_path": client_config.branding.favicon_path,
                "colors": {
                    "primary": client_config.branding.primary_color,
                    "secondary": client_config.branding.secondary_color,
                    # Add more colors as needed
                },
                "fonts": {
                    "heading": "Inter",  # Default for now
                    "body": "Inter",
                    "mono": "JetBrains Mono"
                },
                "theme": client_config.branding.theme,
                "layout": "modern",  # Default for now
                "sidebar_position": "left",  # Default for now
                "show_logo_in_chat": True,  # Default for now
                "show_powered_by": client_config.branding.show_powered_by
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get theme configuration for {client_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Theme configuration not found: {client_id}")


@router.get("/features/{client_id}")
async def get_client_features(client_id: str) -> Dict[str, bool]:
    """
    Get feature flags for a client.
    
    Args:
        client_id: Unique client identifier
        
    Returns:
        Dict of feature flags
    """
    try:
        client_config = get_client_config(client_id)
        
        return {
            "document_upload": client_config.features.document_upload,
            "chat_interface": client_config.features.chat_interface,
            "search": client_config.features.search,
            "analytics": client_config.features.analytics,
            "admin_panel": client_config.features.admin_panel,
            "user_management": client_config.features.user_management,
            "api_access": client_config.features.api_access,
            "export_data": client_config.features.export_data,
            "audit_logs": client_config.features.audit_logs,
            "collaboration": client_config.features.collaboration,
            "workflow_automation": client_config.features.workflow_automation,
            "integrations": client_config.features.integrations,
            "mobile_app": client_config.features.mobile_app,
            "offline_mode": client_config.features.offline_mode
        }
        
    except Exception as e:
        logger.error(f"Failed to get features for {client_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Features not found: {client_id}")


@router.get("/settings/{client_id}")
async def get_client_settings(client_id: str) -> Dict[str, Any]:
    """
    Get application settings for a client (merged with base settings).
    
    Args:
        client_id: Unique client identifier
        
    Returns:
        Dict containing application settings
    """
    try:
        settings_dict = client_settings.get_for_client(client_id)
        
        # Return only safe settings (no API keys or secrets)
        safe_settings = {
            "client_id": settings_dict.get("client_id"),
            "client_name": settings_dict.get("client_name"),
            "client_language": settings_dict.get("client_language"),
            "client_industry": settings_dict.get("client_industry"),
            "api_title": settings_dict.get("api_title"),
            "api_version": settings_dict.get("api_version"),
            "api_description": settings_dict.get("api_description"),
            "embedding_model": settings_dict.get("embedding_model"),
            "retrieval_k": settings_dict.get("retrieval_k"),
            "use_hybrid_search": settings_dict.get("use_hybrid_search"),
            "use_reranking": settings_dict.get("use_reranking"),
            "use_query_enhancement": settings_dict.get("use_query_enhancement"),
            "max_documents_per_org": settings_dict.get("max_documents_per_org"),
            "max_users_per_org": settings_dict.get("max_users_per_org"),
            "max_document_size_mb": settings_dict.get("max_document_size_mb"),
        }
        
        return safe_settings
        
    except Exception as e:
        logger.error(f"Failed to get settings for {client_id}: {e}")
        raise HTTPException(status_code=404, detail=f"Settings not found: {client_id}")


@router.get("/clients")
async def list_available_clients() -> Dict[str, Any]:
    """List all available client configurations."""
    try:
        clients = config_manager.list_clients()
        
        client_info = []
        for client_id in clients:
            try:
                config = get_client_config(client_id)
                client_info.append({
                    "client_id": client_id,
                    "client_name": config.client_name,
                    "industry": config.industry,
                    "language": config.language,
                    "company_name": config.branding.company_name
                })
            except Exception as e:
                logger.warning(f"Failed to load info for client {client_id}: {e}")
                client_info.append({
                    "client_id": client_id,
                    "client_name": "Unknown",
                    "industry": "unknown",
                    "language": "unknown",
                    "company_name": "Unknown"
                })
        
        return {
            "clients": client_info,
            "total": len(client_info)
        }
        
    except Exception as e:
        logger.error(f"Failed to list clients: {e}")
        raise HTTPException(status_code=500, detail="Failed to list clients")


@router.post("/reload/{client_id}")
async def reload_client_configuration(client_id: str) -> Dict[str, str]:
    """
    Reload client configuration from disk.
    
    Args:
        client_id: Unique client identifier
        
    Returns:
        Success message
    """
    try:
        config_manager.reload_config(client_id)
        return {"message": f"Configuration reloaded for client {client_id}"}
        
    except Exception as e:
        logger.error(f"Failed to reload configuration for {client_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reload configuration: {e}")


@router.get("/health")
async def configuration_health() -> Dict[str, Any]:
    """Health check for configuration system."""
    try:
        from ..core.client_config import get_current_client_id
        
        client_id = get_current_client_id()
        client_config = get_client_config(client_id)
        
        return {
            "status": "healthy",
            "current_client": client_id,
            "client_name": client_config.client_name,
            "config_loaded": True,
            "available_clients": len(config_manager.list_clients())
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "config_loaded": False
        }