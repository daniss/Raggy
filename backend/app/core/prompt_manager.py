"""
Prompt Management System

This module provides a centralized system for managing client-specific prompts
and templates. It supports dynamic prompt loading, template variable substitution,
and prompt customization per client.
"""

import os
from typing import Dict, Any, Optional, List
from pathlib import Path
import string
import logging
from functools import lru_cache

from .client_config import get_client_config, get_current_client_id

logger = logging.getLogger(__name__)


class PromptTemplate:
    """Represents a prompt template with variable substitution"""
    
    def __init__(self, template: str, name: str = ""):
        self.template = template
        self.name = name
        self.variables = self._extract_variables()
    
    def _extract_variables(self) -> List[str]:
        """Extract template variables from the prompt"""
        formatter = string.Formatter()
        return [field_name for _, field_name, _, _ in formatter.parse(self.template) 
                if field_name is not None]
    
    def render(self, **kwargs) -> str:
        """Render the template with provided variables"""
        try:
            return self.template.format(**kwargs)
        except KeyError as e:
            logger.warning(f"Missing variable in prompt template '{self.name}': {e}")
            # Return template with unresolved variables as-is
            return self.template
        except Exception as e:
            logger.error(f"Error rendering prompt template '{self.name}': {e}")
            return self.template
    
    def get_required_variables(self) -> List[str]:
        """Get list of required variables for this template"""
        return self.variables


class PromptManager:
    """
    Manages client-specific prompts and templates.
    
    Supports hierarchical prompt loading:
    1. Default prompts (fallback)
    2. Client-specific prompts
    3. Runtime template variable substitution
    """
    
    def __init__(self, base_path: str = "/clients"):
        self.base_path = Path(base_path)
        self._prompt_cache: Dict[str, Dict[str, PromptTemplate]] = {}
        self._default_prompts: Dict[str, str] = {}
        
        # Fallback to local clients directory during development
        if not self.base_path.exists():
            self.base_path = Path(__file__).parent.parent.parent.parent / "clients"
        
        logger.info(f"PromptManager initialized with base path: {self.base_path}")
        self._load_default_prompts()
    
    def _load_default_prompts(self):
        """Load default prompts from the existing prompts.py file"""
        
        # Import existing prompts as defaults
        from ..rag.prompts import (
            ENTERPRISE_RAG_SYSTEM_PROMPT,
            STREAMING_RAG_PROMPT,
            MULTI_AGENT_EXTRACTION_PROMPT,
            MULTI_AGENT_VERIFICATION_PROMPT,
            QUERY_ENHANCEMENT_PROMPT,
            CONFIDENCE_SCORING_TEMPLATE
        )
        
        self._default_prompts = {
            "system_default": ENTERPRISE_RAG_SYSTEM_PROMPT,
            "system_streaming": STREAMING_RAG_PROMPT,
            "extraction": MULTI_AGENT_EXTRACTION_PROMPT,
            "verification": MULTI_AGENT_VERIFICATION_PROMPT,
            "query_enhancement": QUERY_ENHANCEMENT_PROMPT,
            "confidence_scoring": CONFIDENCE_SCORING_TEMPLATE,
            "answer_generation": """Basé sur le contexte fourni, réponds à la question de l'utilisateur de manière précise et professionnelle.

CONTEXTE:
{context}

QUESTION:
{query}

INSTRUCTIONS:
- Réponds uniquement avec les informations du contexte
- Cite tes sources avec [Source: document]
- Si l'information n'existe pas, dis-le clairement
- Utilise un ton professionnel approprié pour {industry}
- Réponds en {language}""",
            
            "system_legal": """Tu es un assistant juridique spécialisé pour {organization_name}.

EXPERTISE:
- Analyse de contrats et clauses
- Recherche de jurisprudence
- Conformité réglementaire
- Interprétation de textes légaux

RÈGLES STRICTES:
- Cites précisément les articles et références juridiques
- Distingues obligations légales vs recommandations  
- Signales les conflits entre provisions
- Précises la juridiction ({country})
- AVERTISSEMENT: Ceci est informatif, consulte un avocat qualifié

Réponds en {language} avec la terminologie juridique appropriée.""",
            
            "system_technical": """Tu es un assistant technique spécialisé pour {organization_name}.

EXPERTISE:
- Documentation technique
- Procédures opérationnelles  
- Spécifications produits
- Guides de dépannage

RÈGLES:
- Fournis des instructions étape par étape
- Inclus les références techniques exactes
- Signales les prérequis et dépendances
- Adaptes le niveau technique à l'utilisateur

Réponds en {language} de manière claire et précise."""
        }
    
    @lru_cache(maxsize=128)
    def get_prompt(self, prompt_name: str, client_id: Optional[str] = None) -> PromptTemplate:
        """
        Get a prompt template for the specified client.
        
        Args:
            prompt_name: Name of the prompt template
            client_id: Client identifier (uses current client if None)
            
        Returns:
            PromptTemplate: The loaded prompt template
        """
        if client_id is None:
            client_id = get_current_client_id()
        
        # Check cache first
        if client_id in self._prompt_cache and prompt_name in self._prompt_cache[client_id]:
            return self._prompt_cache[client_id][prompt_name]
        
        # Load prompt template
        prompt_text = self._load_prompt_text(prompt_name, client_id)
        template = PromptTemplate(prompt_text, prompt_name)
        
        # Cache the template
        if client_id not in self._prompt_cache:
            self._prompt_cache[client_id] = {}
        self._prompt_cache[client_id][prompt_name] = template
        
        return template
    
    def _load_prompt_text(self, prompt_name: str, client_id: str) -> str:
        """Load prompt text with fallback hierarchy"""
        
        # Try client-specific prompt file
        client_prompt_path = self.base_path / client_id / "prompts" / f"{prompt_name}.txt"
        if client_prompt_path.exists():
            try:
                with open(client_prompt_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to load client prompt {client_prompt_path}: {e}")
        
        # Try template directory
        template_prompt_path = self.base_path / "template" / "prompts" / f"{prompt_name}.txt"
        if template_prompt_path.exists():
            try:
                with open(template_prompt_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to load template prompt {template_prompt_path}: {e}")
        
        # Fall back to default prompts
        if prompt_name in self._default_prompts:
            return self._default_prompts[prompt_name]
        
        # Last resort: return empty template
        logger.error(f"Prompt not found: {prompt_name} for client {client_id}")
        return f"[PROMPT ERROR: {prompt_name} not found]"
    
    def render_prompt(
        self, 
        prompt_name: str, 
        client_id: Optional[str] = None, 
        **variables
    ) -> str:
        """
        Render a prompt with variables and client context.
        
        Args:
            prompt_name: Name of the prompt template
            client_id: Client identifier
            **variables: Template variables to substitute
            
        Returns:
            str: Rendered prompt text
        """
        if client_id is None:
            client_id = get_current_client_id()
        
        # Get client configuration for context variables
        client_config = get_client_config(client_id)
        
        # Build context variables from client config
        context_vars = {
            "organization_name": client_config.branding.company_name,
            "client_name": client_config.client_name,
            "language": client_config.language,
            "country": client_config.country,
            "industry": client_config.industry,
            "client_id": client_id,
        }
        
        # Merge with provided variables (provided variables take precedence)
        context_vars.update(variables)
        
        # Get and render template
        template = self.get_prompt(prompt_name, client_id)
        return template.render(**context_vars)
    
    def list_prompts(self, client_id: Optional[str] = None) -> List[str]:
        """List available prompts for a client"""
        if client_id is None:
            client_id = get_current_client_id()
        
        prompts = set()
        
        # Add default prompts
        prompts.update(self._default_prompts.keys())
        
        # Add template prompts
        template_dir = self.base_path / "template" / "prompts"
        if template_dir.exists():
            for file_path in template_dir.glob("*.txt"):
                prompts.add(file_path.stem)
        
        # Add client-specific prompts
        client_dir = self.base_path / client_id / "prompts"
        if client_dir.exists():
            for file_path in client_dir.glob("*.txt"):
                prompts.add(file_path.stem)
        
        return sorted(list(prompts))
    
    def validate_prompt(
        self, 
        prompt_name: str, 
        required_variables: List[str], 
        client_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate that a prompt has all required variables.
        
        Returns validation report with missing variables and recommendations.
        """
        if client_id is None:
            client_id = get_current_client_id()
        
        template = self.get_prompt(prompt_name, client_id)
        available_vars = template.get_required_variables()
        missing_vars = [var for var in required_variables if var not in available_vars]
        extra_vars = [var for var in available_vars if var not in required_variables]
        
        return {
            "prompt_name": prompt_name,
            "client_id": client_id,
            "valid": len(missing_vars) == 0,
            "available_variables": available_vars,
            "required_variables": required_variables,
            "missing_variables": missing_vars,
            "extra_variables": extra_vars,
            "template_length": len(template.template),
        }
    
    def create_prompt_template(
        self, 
        prompt_name: str, 
        content: str, 
        client_id: Optional[str] = None
    ):
        """Create a new prompt template for a client"""
        if client_id is None:
            client_id = get_current_client_id()
        
        # Create client prompts directory if it doesn't exist
        client_prompts_dir = self.base_path / client_id / "prompts"
        client_prompts_dir.mkdir(parents=True, exist_ok=True)
        
        # Write prompt file
        prompt_path = client_prompts_dir / f"{prompt_name}.txt"
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Clear cache for this client
        if client_id in self._prompt_cache:
            self._prompt_cache[client_id].pop(prompt_name, None)
        
        logger.info(f"Created prompt template {prompt_name} for client {client_id}")
    
    def reload_prompts(self, client_id: Optional[str] = None):
        """Reload prompts from disk"""
        if client_id is None:
            client_id = get_current_client_id()
        
        # Clear cache
        if client_id in self._prompt_cache:
            del self._prompt_cache[client_id]
        
        # Clear LRU cache
        self.get_prompt.cache_clear()
        
        logger.info(f"Reloaded prompts for client {client_id}")


# Global prompt manager instance
prompt_manager = PromptManager()


def get_prompt(prompt_name: str, client_id: Optional[str] = None, **variables) -> str:
    """
    Get and render a prompt template.
    
    Args:
        prompt_name: Name of the prompt template
        client_id: Client identifier (uses current client if None)
        **variables: Template variables to substitute
        
    Returns:
        str: Rendered prompt text
    """
    return prompt_manager.render_prompt(prompt_name, client_id, **variables)


def get_system_prompt(client_id: Optional[str] = None, **variables) -> str:
    """Get the main system prompt for a client"""
    if client_id is None:
        client_id = get_current_client_id()
    
    client_config = get_client_config(client_id)
    
    # Choose prompt based on industry
    if client_config.industry == "legal":
        prompt_name = "system_legal"
    elif client_config.industry in ["tech", "engineering", "manufacturing"]:
        prompt_name = "system_technical"
    else:
        prompt_name = "system_default"
    
    return get_prompt(prompt_name, client_id, **variables)


def get_answer_generation_prompt(
    context: str, 
    query: str, 
    client_id: Optional[str] = None, 
    **variables
) -> str:
    """Get the answer generation prompt with context and query"""
    return get_prompt(
        "answer_generation", 
        client_id, 
        context=context, 
        query=query, 
        **variables
    )