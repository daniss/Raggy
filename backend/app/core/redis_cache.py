"""Redis caching for query results."""

import json
import hashlib
import logging
from typing import Optional, Any, Dict
from datetime import timedelta

import redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis cache manager for query caching."""
    
    def __init__(self):
        self.client = None
        self.enabled = False
        self._connect()
    
    def _connect(self):
        """Connect to Redis server."""
        try:
            if not hasattr(settings, 'redis_url') or not settings.redis_url:
                logger.info("Redis URL not configured, caching disabled")
                return
            
            self.client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                retry_on_error=[redis.ConnectionError, redis.TimeoutError],
                max_connections=50
            )
            
            # Test connection
            self.client.ping()
            self.enabled = True
            logger.info("Redis cache connected successfully")
            
        except (RedisError, Exception) as e:
            logger.warning(f"Failed to connect to Redis: {e}. Caching disabled.")
            self.enabled = False
            self.client = None
    
    def _generate_key(self, prefix: str, data: Any) -> str:
        """Generate a cache key from prefix and data."""
        # Create a hash of the data for the key
        if isinstance(data, dict):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        
        hash_digest = hashlib.md5(data_str.encode()).hexdigest()
        return f"{prefix}:{hash_digest}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled or not self.client:
            return None
        
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
            return None
            
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Redis get error for key {key}: {e}")
            return None
    
    def set(
        self, 
        key: str, 
        value: Any, 
        expire: Optional[int] = None
    ) -> bool:
        """Set value in cache with optional expiration (in seconds)."""
        if not self.enabled or not self.client:
            return False
        
        try:
            value_str = json.dumps(value)
            
            if expire:
                return self.client.setex(key, expire, value_str)
            else:
                return self.client.set(key, value_str)
                
        except (RedisError, json.JSONEncodeError) as e:
            logger.error(f"Redis set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.enabled or not self.client:
            return False
        
        try:
            return bool(self.client.delete(key))
        except RedisError as e:
            logger.error(f"Redis delete error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        if not self.enabled or not self.client:
            return False
        
        try:
            return bool(self.client.exists(key))
        except RedisError as e:
            logger.error(f"Redis exists error for key {key}: {e}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching a pattern."""
        if not self.enabled or not self.client:
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
            
        except RedisError as e:
            logger.error(f"Redis clear pattern error for {pattern}: {e}")
            return 0
    
    def get_chat_response(
        self, 
        question: str, 
        context_hash: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached chat response."""
        cache_key = self._generate_key("chat", {
            "question": question.lower().strip(),
            "context": context_hash or "default"
        })
        
        return self.get(cache_key)
    
    def set_chat_response(
        self, 
        question: str,
        response: Dict[str, Any],
        context_hash: Optional[str] = None,
        expire_minutes: int = 60
    ) -> bool:
        """Cache a chat response."""
        cache_key = self._generate_key("chat", {
            "question": question.lower().strip(),
            "context": context_hash or "default"
        })
        
        return self.set(
            cache_key, 
            response, 
            expire=expire_minutes * 60
        )
    
    def invalidate_document_cache(self, document_id: str):
        """Invalidate cache entries related to a document."""
        # Clear all chat responses when documents change
        # In production, you might want a more sophisticated strategy
        cleared = self.clear_pattern("chat:*")
        logger.info(f"Cleared {cleared} cache entries after document {document_id} change")
    
    def invalidate_all_cache(self):
        """Invalidate all cache entries (used after bulk operations)."""
        if not self.enabled or not self.client:
            return 0
        
        try:
            # Clear all cache entries
            cleared = self.clear_pattern("*")
            logger.info(f"Cleared all {cleared} cache entries")
            return cleared
        except RedisError as e:
            logger.error(f"Failed to clear all cache: {e}")
            return 0
    
    async def get_int(self, key: str) -> Optional[int]:
        """Get integer value from cache."""
        if not self.enabled or not self.client:
            return None
        
        try:
            value = self.client.get(key)
            return int(value) if value is not None else None
        except (RedisError, ValueError) as e:
            logger.error(f"Failed to get int from cache: {e}")
            return None
    
    async def increment_with_ttl(self, key: str, ttl: int) -> int:
        """Increment a counter with TTL."""
        if not self.enabled or not self.client:
            return 1
        
        try:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = pipe.execute()
            return results[0]
        except RedisError as e:
            logger.error(f"Failed to increment with TTL: {e}")
            return 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.enabled or not self.client:
            return {"enabled": False, "status": "disconnected"}
        
        try:
            info = self.client.info()
            return {
                "enabled": True,
                "status": "connected",
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "total_keys": self.client.dbsize(),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                )
            }
            
        except RedisError as e:
            logger.error(f"Failed to get Redis stats: {e}")
            return {"enabled": True, "status": "error", "error": str(e)}
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage."""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    def health_check(self) -> bool:
        """Check if Redis connection is healthy."""
        if not self.enabled or not self.client:
            return False
        
        try:
            return self.client.ping()
        except RedisError:
            return False


# Global cache instance
redis_cache = RedisCache()