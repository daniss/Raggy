"""Advanced caching system for RAG components with async support."""

import logging
import json
import hashlib
import pickle
from typing import Any, Dict, List, Optional, Union
import asyncio
from dataclasses import dataclass
import time
from app.core.redis_cache import redis_cache
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    data: Any
    timestamp: float
    ttl: int
    access_count: int = 0
    hit_count: int = 0


class AdvancedRAGCache:
    """Advanced caching system for RAG operations."""
    
    def __init__(self):
        """Initialize the advanced cache."""
        self.redis = redis_cache
        self.memory_cache: Dict[str, CacheEntry] = {}
        self.max_memory_entries = 1000
        self.default_ttl = settings.cache_ttl_minutes * 60  # Convert to seconds
        
        # Cache prefixes for different types
        self.prefixes = {
            'embedding': 'rag:emb:',
            'query': 'rag:query:',
            'retrieval': 'rag:retr:',
            'rerank': 'rag:rerank:',
            'enhancement': 'rag:enhance:'
        }
        
        logger.info("Advanced RAG cache initialized")
    
    def _generate_key(self, prefix: str, data: Union[str, Dict, List]) -> str:
        """Generate a cache key from data."""
        if isinstance(data, str):
            content = data
        else:
            content = json.dumps(data, sort_keys=True)
        
        hash_obj = hashlib.md5(content.encode('utf-8'))
        return f"{prefix}{hash_obj.hexdigest()}"
    
    def _is_expired(self, entry: CacheEntry) -> bool:
        """Check if cache entry is expired."""
        return time.time() - entry.timestamp > entry.ttl
    
    def _cleanup_memory_cache(self):
        """Clean up expired entries from memory cache."""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.memory_cache.items()
            if current_time - entry.timestamp > entry.ttl
        ]
        
        for key in expired_keys:
            del self.memory_cache[key]
        
        # Remove least accessed entries if we're over the limit
        if len(self.memory_cache) > self.max_memory_entries:
            sorted_entries = sorted(
                self.memory_cache.items(),
                key=lambda x: x[1].access_count
            )
            
            excess_count = len(self.memory_cache) - self.max_memory_entries
            for key, _ in sorted_entries[:excess_count]:
                del self.memory_cache[key]
    
    async def get_embedding(self, text: str, model_name: str) -> Optional[List[float]]:
        """Get cached embedding."""
        if not settings.enable_embedding_cache:
            return None
        
        try:
            cache_key = self._generate_key(
                self.prefixes['embedding'], 
                f"{model_name}:{text}"
            )
            
            # Check memory cache first
            if cache_key in self.memory_cache:
                entry = self.memory_cache[cache_key]
                if not self._is_expired(entry):
                    entry.access_count += 1
                    entry.hit_count += 1
                    logger.debug(f"Memory cache hit for embedding: {text[:50]}...")
                    return entry.data
                else:
                    del self.memory_cache[cache_key]
            
            # Check Redis cache
            cached_data = self.redis.get_embedding(cache_key)
            if cached_data:
                # Store in memory cache for faster access
                self.memory_cache[cache_key] = CacheEntry(
                    data=cached_data,
                    timestamp=time.time(),
                    ttl=self.default_ttl
                )
                logger.debug(f"Redis cache hit for embedding: {text[:50]}...")
                return cached_data
            
            return None
            
        except Exception as e:
            logger.warning(f"Error getting cached embedding: {e}")
            return None
    
    async def set_embedding(self, text: str, model_name: str, embedding: List[float]):
        """Cache an embedding."""
        if not settings.enable_embedding_cache:
            return
        
        try:
            cache_key = self._generate_key(
                self.prefixes['embedding'], 
                f"{model_name}:{text}"
            )
            
            # Store in memory cache
            self.memory_cache[cache_key] = CacheEntry(
                data=embedding,
                timestamp=time.time(),
                ttl=self.default_ttl
            )
            
            # Store in Redis cache
            self.redis.set_embedding(cache_key, embedding, self.default_ttl // 60)
            
            # Cleanup if needed
            self._cleanup_memory_cache()
            
        except Exception as e:
            logger.warning(f"Error caching embedding: {e}")
    
    async def get_query_result(self, query: str, org_id: str, config: Dict) -> Optional[Dict]:
        """Get cached query result."""
        if not settings.enable_query_cache:
            return None
        
        try:
            cache_data = {
                'query': query,
                'org_id': org_id,
                'config': config
            }
            cache_key = self._generate_key(self.prefixes['query'], cache_data)
            
            # Check memory cache first
            if cache_key in self.memory_cache:
                entry = self.memory_cache[cache_key]
                if not self._is_expired(entry):
                    entry.access_count += 1
                    entry.hit_count += 1
                    logger.debug(f"Memory cache hit for query: {query[:50]}...")
                    return entry.data
                else:
                    del self.memory_cache[cache_key]
            
            # Check Redis cache
            cached_result = self.redis.get_chat_response(cache_key)
            if cached_result:
                # Store in memory cache
                self.memory_cache[cache_key] = CacheEntry(
                    data=cached_result,
                    timestamp=time.time(),
                    ttl=self.default_ttl
                )
                logger.debug(f"Redis cache hit for query: {query[:50]}...")
                return cached_result
                
            return None
            
        except Exception as e:
            logger.warning(f"Error getting cached query result: {e}")
            return None
    
    async def set_query_result(self, query: str, org_id: str, config: Dict, result: Dict):
        """Cache a query result."""
        if not settings.enable_query_cache:
            return
        
        try:
            cache_data = {
                'query': query,
                'org_id': org_id,
                'config': config
            }
            cache_key = self._generate_key(self.prefixes['query'], cache_data)
            
            # Store in memory cache
            self.memory_cache[cache_key] = CacheEntry(
                data=result,
                timestamp=time.time(),
                ttl=self.default_ttl
            )
            
            # Store in Redis cache
            self.redis.set_chat_response(cache_key, result, self.default_ttl // 60)
            
            # Cleanup if needed
            self._cleanup_memory_cache()
            
        except Exception as e:
            logger.warning(f"Error caching query result: {e}")
    
    async def get_retrieval_result(self, query: str, org_id: str, k: int) -> Optional[List]:
        """Get cached retrieval result."""
        try:
            cache_data = {
                'query': query,
                'org_id': org_id,
                'k': k,
                'type': 'retrieval'
            }
            cache_key = self._generate_key(self.prefixes['retrieval'], cache_data)
            
            if cache_key in self.memory_cache:
                entry = self.memory_cache[cache_key]
                if not self._is_expired(entry):
                    entry.access_count += 1
                    logger.debug(f"Cache hit for retrieval: {query[:50]}...")
                    return entry.data
                else:
                    del self.memory_cache[cache_key]
            
            return None
            
        except Exception as e:
            logger.warning(f"Error getting cached retrieval: {e}")
            return None
    
    async def set_retrieval_result(self, query: str, org_id: str, k: int, result: List):
        """Cache a retrieval result."""
        try:
            cache_data = {
                'query': query,
                'org_id': org_id,
                'k': k,
                'type': 'retrieval'
            }
            cache_key = self._generate_key(self.prefixes['retrieval'], cache_data)
            
            # Store in memory cache with shorter TTL for retrieval
            self.memory_cache[cache_key] = CacheEntry(
                data=result,
                timestamp=time.time(),
                ttl=self.default_ttl // 2  # Shorter TTL for retrieval results
            )
            
            self._cleanup_memory_cache()
            
        except Exception as e:
            logger.warning(f"Error caching retrieval result: {e}")
    
    async def get_enhancement_result(self, query: str) -> Optional[Dict]:
        """Get cached query enhancement result."""
        try:
            cache_key = self._generate_key(self.prefixes['enhancement'], query)
            
            if cache_key in self.memory_cache:
                entry = self.memory_cache[cache_key]
                if not self._is_expired(entry):
                    entry.access_count += 1
                    logger.debug(f"Cache hit for enhancement: {query[:50]}...")
                    return entry.data
                else:
                    del self.memory_cache[cache_key]
            
            return None
            
        except Exception as e:
            logger.warning(f"Error getting cached enhancement: {e}")
            return None
    
    async def set_enhancement_result(self, query: str, result: Dict):
        """Cache a query enhancement result."""
        try:
            cache_key = self._generate_key(self.prefixes['enhancement'], query)
            
            self.memory_cache[cache_key] = CacheEntry(
                data=result,
                timestamp=time.time(),
                ttl=self.default_ttl * 2  # Longer TTL for enhancement results
            )
            
            self._cleanup_memory_cache()
            
        except Exception as e:
            logger.warning(f"Error caching enhancement result: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_entries = len(self.memory_cache)
        total_hits = sum(entry.hit_count for entry in self.memory_cache.values())
        total_accesses = sum(entry.access_count for entry in self.memory_cache.values())
        
        hit_rate = (total_hits / total_accesses) * 100 if total_accesses > 0 else 0
        
        return {
            'memory_cache_entries': total_entries,
            'total_hits': total_hits,
            'total_accesses': total_accesses,
            'hit_rate_percent': round(hit_rate, 2),
            'cache_enabled': {
                'embeddings': settings.enable_embedding_cache,
                'queries': settings.enable_query_cache
            }
        }
    
    async def clear_cache(self, cache_type: Optional[str] = None):
        """Clear cache entries."""
        try:
            if cache_type and cache_type in self.prefixes:
                # Clear specific cache type
                keys_to_remove = [
                    key for key in self.memory_cache.keys()
                    if key.startswith(self.prefixes[cache_type])
                ]
                for key in keys_to_remove:
                    del self.memory_cache[key]
                    
                logger.info(f"Cleared {len(keys_to_remove)} {cache_type} cache entries")
            else:
                # Clear all
                self.memory_cache.clear()
                logger.info("Cleared all cache entries")
                
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")


# Global advanced cache instance
advanced_cache = AdvancedRAGCache()