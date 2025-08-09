"""
Abstract LLM Provider Interface

This module provides a unified interface for different LLM providers (Groq, OpenAI, Anthropic, etc.)
to enable easy switching between providers based on client configuration.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, AsyncIterator, List
from dataclasses import dataclass
import json
import httpx
import logging
from groq import AsyncGroq
import openai
import anthropic

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """Standardized message format"""
    role: str  # system, user, assistant
    content: str
    metadata: Dict[str, Any] = None


@dataclass
class LLMResponse:
    """Standardized response format"""
    content: str
    model: str
    usage: Dict[str, Any] = None
    metadata: Dict[str, Any] = None


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.client = None
        self._initialize_client()
    
    @abstractmethod
    def _initialize_client(self):
        """Initialize the provider-specific client"""
        pass
    
    @abstractmethod
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from the LLM"""
        pass
    
    @abstractmethod
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response from the LLM"""
        pass
    
    async def health_check(self) -> bool:
        """Check if the provider is available"""
        try:
            test_messages = [LLMMessage(role="user", content="Hello")]
            await self.generate(test_messages, max_tokens=5)
            return True
        except Exception as e:
            logger.error(f"Health check failed for {self.__class__.__name__}: {e}")
            return False


class GroqProvider(LLMProvider):
    """Groq LLM Provider"""
    
    def _initialize_client(self):
        api_key = self.config.get("api_key")
        if not api_key:
            raise ValueError("Groq API key is required")
        
        self.client = AsyncGroq(api_key=api_key)
        self.model = self.config.get("model", "deepseek-r1-distill-llama-70b")
        self.timeout = self.config.get("timeout", 30)
        self.retry_attempts = self.config.get("retry_attempts", 3)
    
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Groq"""
        
        # Convert to Groq format
        groq_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        for attempt in range(self.retry_attempts):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=groq_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=self.timeout,
                    **kwargs
                )
                
                return LLMResponse(
                    content=response.choices[0].message.content,
                    model=response.model,
                    usage={
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    },
                    metadata={"provider": "groq", "attempt": attempt + 1}
                )
                
            except Exception as e:
                logger.warning(f"Groq attempt {attempt + 1} failed: {e}")
                if attempt == self.retry_attempts - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response using Groq"""
        
        groq_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=groq_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                timeout=self.timeout,
                **kwargs
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Groq streaming failed: {e}")
            raise


class OpenAIProvider(LLMProvider):
    """OpenAI LLM Provider"""
    
    def _initialize_client(self):
        api_key = self.config.get("api_key")
        if not api_key:
            raise ValueError("OpenAI API key is required")
        
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = self.config.get("model", "gpt-4-turbo-preview")
        self.timeout = self.config.get("timeout", 30)
        self.organization = self.config.get("organization")
    
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate response using OpenAI"""
        
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=self.timeout,
                **kwargs
            )
            
            return LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                metadata={"provider": "openai"}
            )
            
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response using OpenAI"""
        
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                timeout=self.timeout,
                **kwargs
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"OpenAI streaming failed: {e}")
            raise


class AnthropicProvider(LLMProvider):
    """Anthropic Claude LLM Provider"""
    
    def _initialize_client(self):
        api_key = self.config.get("api_key")
        if not api_key:
            raise ValueError("Anthropic API key is required")
        
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = self.config.get("model", "claude-3-opus-20240229")
        self.timeout = self.config.get("timeout", 30)
    
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Anthropic"""
        
        # Separate system message from other messages
        system_message = None
        claude_messages = []
        
        for msg in messages:
            if msg.role == "system":
                system_message = msg.content
            else:
                claude_messages.append({"role": msg.role, "content": msg.content})
        
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_message,
                messages=claude_messages,
                timeout=self.timeout,
                **kwargs
            )
            
            return LLMResponse(
                content=response.content[0].text,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                },
                metadata={"provider": "anthropic"}
            )
            
        except Exception as e:
            logger.error(f"Anthropic generation failed: {e}")
            raise
    
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response using Anthropic"""
        
        # Separate system message
        system_message = None
        claude_messages = []
        
        for msg in messages:
            if msg.role == "system":
                system_message = msg.content
            else:
                claude_messages.append({"role": msg.role, "content": msg.content})
        
        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_message,
                messages=claude_messages,
                timeout=self.timeout,
                **kwargs
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                    
        except Exception as e:
            logger.error(f"Anthropic streaming failed: {e}")
            raise


class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI LLM Provider"""
    
    def _initialize_client(self):
        api_key = self.config.get("api_key")
        endpoint = self.config.get("endpoint")
        api_version = self.config.get("api_version", "2023-05-15")
        
        if not api_key or not endpoint:
            raise ValueError("Azure OpenAI API key and endpoint are required")
        
        self.client = openai.AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
        self.model = self.config.get("deployment_name", "gpt-4")
        self.timeout = self.config.get("timeout", 30)
    
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Azure OpenAI"""
        
        azure_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=azure_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=self.timeout,
                **kwargs
            )
            
            return LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                metadata={"provider": "azure_openai"}
            )
            
        except Exception as e:
            logger.error(f"Azure OpenAI generation failed: {e}")
            raise
    
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response using Azure OpenAI"""
        
        azure_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=azure_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                timeout=self.timeout,
                **kwargs
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Azure OpenAI streaming failed: {e}")
            raise


class LLMProviderFactory:
    """Factory for creating LLM providers"""
    
    _providers = {
        "groq": GroqProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "azure": AzureOpenAIProvider,
    }
    
    @classmethod
    def create_provider(cls, provider_type: str, config: Dict[str, Any]) -> LLMProvider:
        """Create an LLM provider instance"""
        
        if provider_type not in cls._providers:
            available = ", ".join(cls._providers.keys())
            raise ValueError(f"Unknown provider type: {provider_type}. Available: {available}")
        
        provider_class = cls._providers[provider_type]
        return provider_class(config)
    
    @classmethod
    def register_provider(cls, name: str, provider_class: type):
        """Register a custom provider"""
        if not issubclass(provider_class, LLMProvider):
            raise ValueError("Provider class must inherit from LLMProvider")
        
        cls._providers[name] = provider_class
    
    @classmethod
    def list_providers(cls) -> List[str]:
        """List available provider types"""
        return list(cls._providers.keys())


class LLMManager:
    """
    Manager for handling multiple LLM providers with fallback support.
    This enables robust client deployments with provider redundancy.
    """
    
    def __init__(self, primary_config: Dict[str, Any], fallback_configs: List[Dict[str, Any]] = None):
        self.primary_provider = self._create_provider(primary_config)
        self.fallback_providers = []
        
        if fallback_configs:
            for config in fallback_configs:
                try:
                    provider = self._create_provider(config)
                    self.fallback_providers.append(provider)
                except Exception as e:
                    logger.warning(f"Failed to initialize fallback provider: {e}")
    
    def _create_provider(self, config: Dict[str, Any]) -> LLMProvider:
        """Create provider from configuration"""
        provider_type = config.get("provider")
        if not provider_type:
            raise ValueError("Provider type is required in configuration")
        
        return LLMProviderFactory.create_provider(provider_type, config)
    
    async def generate(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate response with fallback support"""
        
        # Try primary provider
        try:
            return await self.primary_provider.generate(
                messages, temperature, max_tokens, **kwargs
            )
        except Exception as e:
            logger.warning(f"Primary provider failed: {e}")
        
        # Try fallback providers
        for i, provider in enumerate(self.fallback_providers):
            try:
                logger.info(f"Trying fallback provider {i + 1}")
                return await provider.generate(
                    messages, temperature, max_tokens, **kwargs
                )
            except Exception as e:
                logger.warning(f"Fallback provider {i + 1} failed: {e}")
        
        # All providers failed
        raise Exception("All LLM providers failed to generate response")
    
    async def stream(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.1,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response with fallback support"""
        
        # Try primary provider
        try:
            async for chunk in self.primary_provider.stream(
                messages, temperature, max_tokens, **kwargs
            ):
                yield chunk
            return
        except Exception as e:
            logger.warning(f"Primary provider streaming failed: {e}")
        
        # Try fallback providers
        for i, provider in enumerate(self.fallback_providers):
            try:
                logger.info(f"Trying fallback provider {i + 1} for streaming")
                async for chunk in provider.stream(
                    messages, temperature, max_tokens, **kwargs
                ):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"Fallback provider {i + 1} streaming failed: {e}")
        
        # All providers failed
        raise Exception("All LLM providers failed to stream response")
    
    async def health_check(self) -> Dict[str, bool]:
        """Check health of all providers"""
        results = {
            "primary": await self.primary_provider.health_check()
        }
        
        for i, provider in enumerate(self.fallback_providers):
            results[f"fallback_{i + 1}"] = await provider.health_check()
        
        return results