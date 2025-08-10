"""LLM provider interface and implementations."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
import logging
import aiohttp
import json
from groq import Groq
from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        stream: bool = False,
        **kwargs
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate response from messages."""
        pass
    
    @abstractmethod
    def test_connection(self) -> bool:
        """Test if the LLM provider is available."""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Get provider name."""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Get model name."""
        pass


class GroqLLMProvider(LLMProvider):
    """Groq LLM provider implementation."""
    
    def __init__(self, api_key: str = None, model: str = None):
        """Initialize Groq provider."""
        self.api_key = api_key or settings.groq_api_key
        self._model_name = model or settings.groq_model
        self.client = Groq(api_key=self.api_key)
        
        logger.info(f"Initialized Groq LLM provider with model: {self._model_name}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        stream: bool = False,
        temperature: float = None,
        max_tokens: int = None,
        **kwargs
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate response using Groq API."""
        try:
            # Prepare parameters
            params = {
                "model": self._model_name,
                "messages": messages,
                "temperature": temperature or settings.llm_temperature,
                "max_tokens": max_tokens or settings.max_tokens,
                "stream": stream
            }
            
            if stream:
                return self._stream_response(params)
            else:
                response = self.client.chat.completions.create(**params)
                return response.choices[0].message.content
                
        except Exception as e:
            logger.error(f"Groq generation failed: {e}")
            raise
    
    async def _stream_response(self, params: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """Stream response from Groq."""
        try:
            stream = self.client.chat.completions.create(**params)
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Groq streaming failed: {e}")
            yield f"Error: {str(e)}"
    
    def test_connection(self) -> bool:
        """Test Groq API connection."""
        try:
            # Make a simple test request
            response = self.client.chat.completions.create(
                model=self._model_name,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1,
                temperature=0
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Groq connection test failed: {e}")
            return False
    
    @property
    def provider_name(self) -> str:
        """Get provider name."""
        return "groq"
    
    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._model_name


class LocalLLMProvider(LLMProvider):
    """Local LLM provider for vLLM/TGI servers."""
    
    def __init__(self, base_url: str, model: str = "default", api_key: str = None):
        """Initialize local LLM provider."""
        self.base_url = base_url.rstrip('/')
        self._model_name = model
        self.api_key = api_key
        
        logger.info(f"Initialized local LLM provider: {base_url} with model: {model}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        stream: bool = False,
        temperature: float = None,
        max_tokens: int = None,
        **kwargs
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate response using local LLM server."""
        try:
            # Prepare request data (OpenAI-compatible format)
            data = {
                "model": self._model_name,
                "messages": messages,
                "temperature": temperature or settings.llm_temperature,
                "max_tokens": max_tokens or settings.max_tokens,
                "stream": stream
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            if stream:
                return self._stream_local_response(data, headers)
            else:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/v1/chat/completions",
                        headers=headers,
                        json=data,
                        timeout=aiohttp.ClientTimeout(total=60)
                    ) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            raise Exception(f"Local LLM API error {response.status}: {error_text}")
                        
                        result = await response.json()
                        return result["choices"][0]["message"]["content"]
                        
        except Exception as e:
            logger.error(f"Local LLM generation failed: {e}")
            raise
    
    async def _stream_local_response(self, data: Dict[str, Any], headers: Dict[str, str]) -> AsyncGenerator[str, None]:
        """Stream response from local LLM server."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers=headers,
                    json=data
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        yield f"Error: Local LLM API error {response.status}: {error_text}"
                        return
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]  # Remove 'data: ' prefix
                            
                            if data_str == '[DONE]':
                                break
                            
                            try:
                                chunk_data = json.loads(data_str)
                                content = chunk_data.get("choices", [{}])[0].get("delta", {}).get("content")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue  # Skip malformed chunks
                                
        except Exception as e:
            logger.error(f"Local LLM streaming failed: {e}")
            yield f"Error: {str(e)}"
    
    def test_connection(self) -> bool:
        """Test local LLM server connection."""
        import asyncio
        
        try:
            async def _test():
                async with aiohttp.ClientSession() as session:
                    # Test with a simple health check or minimal request
                    try:
                        async with session.get(
                            f"{self.base_url}/v1/models",
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            return response.status == 200
                    except:
                        # Fallback: try a minimal chat completion
                        headers = {"Content-Type": "application/json"}
                        if self.api_key:
                            headers["Authorization"] = f"Bearer {self.api_key}"
                        
                        data = {
                            "model": self._model_name,
                            "messages": [{"role": "user", "content": "test"}],
                            "max_tokens": 1,
                            "temperature": 0
                        }
                        
                        async with session.post(
                            f"{self.base_url}/v1/chat/completions",
                            headers=headers,
                            json=data,
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            return response.status == 200
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(_test())
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"Local LLM connection test failed: {e}")
            return False
    
    @property
    def provider_name(self) -> str:
        """Get provider name."""
        return "local"
    
    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._model_name


def create_llm_provider() -> LLMProvider:
    """Create LLM provider based on configuration."""
    provider_type = settings.llm_provider.lower()
    
    if provider_type == "groq":
        logger.info("Using Groq LLM provider")
        return GroqLLMProvider()
    elif provider_type == "local":
        base_url = settings.llm_base_url
        if not base_url:
            logger.warning("Local LLM provider selected but LLM_BASE_URL not set, falling back to Groq")
            return GroqLLMProvider()
        
        # Extract model name from config or use default
        model_name = getattr(settings, 'local_llm_model', 'default')
        api_key = getattr(settings, 'local_llm_api_key', None)
        
        logger.info(f"Using local LLM provider: {base_url}")
        return LocalLLMProvider(base_url, model_name, api_key)
    else:
        logger.warning(f"Unknown LLM provider '{provider_type}', falling back to Groq")
        return GroqLLMProvider()


# Global LLM provider instance
llm_provider = create_llm_provider()