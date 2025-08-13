"""LLM providers for different language models."""

import logging
from typing import Dict, Any, AsyncGenerator
from groq import Groq
from app.core.config import settings
from app.core.retry_handler import retry_external_api

logger = logging.getLogger(__name__)

# Initialize Groq client
groq_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None


class LLMProvider:
    """LLM provider wrapper."""
    
    def __init__(self):
        self.model = settings.groq_model
        self.client = groq_client
        
    @retry_external_api(max_attempts=2, delay=0.5)
    async def generate_response(self, messages: list, **kwargs) -> str:
        """Generate a response using the LLM."""
        if not self.client:
            raise ValueError("Groq API key not configured")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.1),
                max_tokens=kwargs.get('max_tokens', 1000)
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise
    
    @retry_external_api(max_attempts=2, delay=0.5)
    async def stream_response(self, messages: list, **kwargs) -> AsyncGenerator[str, None]:
        """Stream response from the LLM."""
        if not self.client:
            raise ValueError("Groq API key not configured")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.1),
                max_tokens=kwargs.get('max_tokens', 1000),
                stream=True
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"LLM streaming failed: {e}")
            raise


# Global instance
llm_provider = LLMProvider()