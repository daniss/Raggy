"""
Performance optimization utilities and monitoring.
Provides caching, query optimization, and performance monitoring for enterprise RAG system.
"""
import logging
import time
import asyncio
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime, timedelta
from functools import wraps
import hashlib
import json
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.redis_cache import redis_cache

logger = logging.getLogger(__name__)

# =============================================================================
# CACHING DECORATORS
# =============================================================================

def cache_result(ttl_seconds: int = 300, key_prefix: str = "cache"):
    """
    Decorator to cache function results.
    
    Args:
        ttl_seconds: Cache TTL in seconds
        key_prefix: Cache key prefix
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = _generate_cache_key(key_prefix, func.__name__, args, kwargs)
            
            try:
                # Try to get from cache
                cached_result = await redis_cache.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return json.loads(cached_result)
            except Exception as e:
                logger.warning(f"Cache get error for {cache_key}: {e}")
            
            # Execute function
            result = await func(*args, **kwargs)
            
            try:
                # Store in cache
                await redis_cache.set(cache_key, json.dumps(result, default=str), ttl_seconds)
                logger.debug(f"Cached result for {cache_key}")
            except Exception as e:
                logger.warning(f"Cache set error for {cache_key}: {e}")
            
            return result
        
        return wrapper
    return decorator

def invalidate_cache(key_patterns: List[str]):
    """
    Decorator to invalidate cache patterns after function execution.
    
    Args:
        key_patterns: List of cache key patterns to invalidate
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate cache patterns
            for pattern in key_patterns:
                try:
                    await redis_cache.delete_pattern(pattern)
                    logger.debug(f"Invalidated cache pattern: {pattern}")
                except Exception as e:
                    logger.warning(f"Cache invalidation error for {pattern}: {e}")
            
            return result
        
        return wrapper
    return decorator

# =============================================================================
# PERFORMANCE MONITORING
# =============================================================================

class PerformanceMonitor:
    """Performance monitoring and metrics collection."""
    
    def __init__(self):
        self.metrics = {}
        self.slow_query_threshold = 2.0  # seconds
        self.memory_threshold_mb = 1000  # MB
    
    @asynccontextmanager
    async def monitor_operation(self, operation_name: str, context: Optional[Dict[str, Any]] = None):
        """Monitor operation performance and collect metrics."""
        start_time = time.time()
        start_memory = self._get_memory_usage()
        
        try:
            yield
        except Exception as e:
            # Log error with context
            logger.error(f"Operation {operation_name} failed: {e}", extra=context or {})
            raise
        finally:
            # Calculate metrics
            duration = time.time() - start_time
            end_memory = self._get_memory_usage()
            memory_delta = end_memory - start_memory
            
            # Record metrics
            self._record_metrics(operation_name, duration, memory_delta, context)
            
            # Log slow operations
            if duration > self.slow_query_threshold:
                logger.warning(
                    f"Slow operation detected: {operation_name} took {duration:.2f}s",
                    extra={
                        "operation": operation_name,
                        "duration": duration,
                        "memory_delta_mb": memory_delta,
                        "context": context or {}
                    }
                )
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB."""
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024  # Convert to MB
        except ImportError:
            return 0.0
        except Exception as e:
            logger.warning(f"Error getting memory usage: {e}")
            return 0.0
    
    def _record_metrics(self, operation: str, duration: float, memory_delta: float, context: Optional[Dict[str, Any]]):
        """Record performance metrics."""
        try:
            # Store in Redis for real-time monitoring
            metric_key = f"perf:metrics:{operation}"
            metric_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "duration": duration,
                "memory_delta_mb": memory_delta,
                "context": context or {}
            }
            
            # Store latest metrics (keep last 100 entries)
            asyncio.create_task(redis_cache.lpush(metric_key, json.dumps(metric_data)))
            asyncio.create_task(redis_cache.ltrim(metric_key, 0, 99))
            asyncio.create_task(redis_cache.expire(metric_key, 3600))  # 1 hour TTL
            
        except Exception as e:
            logger.warning(f"Error recording metrics: {e}")
    
    async def get_performance_stats(self, operation: str = None, minutes: int = 60) -> Dict[str, Any]:
        """Get performance statistics for operations."""
        try:
            if operation:
                # Get stats for specific operation
                metric_key = f"perf:metrics:{operation}"
                raw_metrics = await redis_cache.lrange(metric_key, 0, -1)
            else:
                # Get stats for all operations
                pattern = "perf:metrics:*"
                keys = await redis_cache.keys(pattern)
                raw_metrics = []
                for key in keys:
                    metrics = await redis_cache.lrange(key, 0, -1)
                    raw_metrics.extend(metrics)
            
            if not raw_metrics:
                return {"operations": 0, "avg_duration": 0, "avg_memory_delta": 0}
            
            # Parse metrics
            metrics = []
            cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)
            
            for raw_metric in raw_metrics:
                try:
                    metric = json.loads(raw_metric)
                    metric_time = datetime.fromisoformat(metric["timestamp"])
                    if metric_time > cutoff_time:
                        metrics.append(metric)
                except Exception as e:
                    logger.warning(f"Error parsing metric: {e}")
                    continue
            
            if not metrics:
                return {"operations": 0, "avg_duration": 0, "avg_memory_delta": 0}
            
            # Calculate statistics
            total_ops = len(metrics)
            avg_duration = sum(m["duration"] for m in metrics) / total_ops
            avg_memory = sum(m["memory_delta_mb"] for m in metrics) / total_ops
            
            # Find slow operations
            slow_ops = [m for m in metrics if m["duration"] > self.slow_query_threshold]
            
            return {
                "operations": total_ops,
                "avg_duration": round(avg_duration, 3),
                "avg_memory_delta": round(avg_memory, 2),
                "slow_operations": len(slow_ops),
                "slow_percentage": round(len(slow_ops) / total_ops * 100, 1) if total_ops > 0 else 0,
                "period_minutes": minutes
            }
            
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {"error": str(e)}

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

# =============================================================================
# DATABASE QUERY OPTIMIZATION
# =============================================================================

class QueryOptimizer:
    """Database query optimization utilities."""
    
    @staticmethod
    def optimize_pagination_query(
        base_query: str,
        page: int,
        page_size: int,
        order_by: str = "created_at",
        order_direction: str = "DESC"
    ) -> Dict[str, Any]:
        """
        Optimize pagination queries to reduce database load.
        
        Args:
            base_query: Base SQL query without LIMIT/OFFSET
            page: Page number (1-based)
            page_size: Items per page
            order_by: Column to order by
            order_direction: ASC or DESC
        
        Returns:
            Dict with optimized query components
        """
        # Calculate offset
        offset = (page - 1) * page_size
        
        # For large offsets, use cursor-based pagination when possible
        if offset > 10000:
            logger.warning(f"Large offset detected ({offset}). Consider cursor-based pagination.")
        
        return {
            "query": base_query,
            "order_by": order_by,
            "order_direction": order_direction,
            "limit": page_size,
            "offset": offset,
            "use_cursor": offset > 10000
        }
    
    @staticmethod
    def build_filter_conditions(filters: Dict[str, Any], table_prefix: str = "") -> Dict[str, Any]:
        """
        Build optimized filter conditions for database queries.
        
        Args:
            filters: Dictionary of filter conditions
            table_prefix: Optional table prefix for columns
        
        Returns:
            Dict with filter conditions and parameters
        """
        conditions = []
        parameters = {}
        
        for key, value in filters.items():
            if value is None:
                continue
            
            column = f"{table_prefix}.{key}" if table_prefix else key
            
            if isinstance(value, list):
                # IN clause for list values
                condition = f"{column} = ANY(%(param_{key})s)"
                parameters[f"param_{key}"] = value
            elif isinstance(value, str) and value.startswith('%') and value.endswith('%'):
                # ILIKE for partial string matches
                condition = f"{column} ILIKE %(param_{key})s"
                parameters[f"param_{key}"] = value
            else:
                # Exact match
                condition = f"{column} = %(param_{key})s"
                parameters[f"param_{key}"] = value
            
            conditions.append(condition)
        
        return {
            "conditions": conditions,
            "parameters": parameters,
            "where_clause": " AND ".join(conditions) if conditions else "1=1"
        }

# =============================================================================
# ANALYTICS QUERY OPTIMIZATION
# =============================================================================

class AnalyticsOptimizer:
    """Specialized optimization for analytics queries."""
    
    @staticmethod
    @cache_result(ttl_seconds=300, key_prefix="analytics")
    async def get_cached_daily_analytics(
        organization_id: str,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Get cached daily analytics data with automatic cache warming.
        
        This function is automatically cached for 5 minutes to reduce database load
        for frequently accessed analytics data.
        """
        # This would be implemented with actual database queries
        # For now, return placeholder
        return []
    
    @staticmethod
    def optimize_time_series_query(
        start_date: datetime,
        end_date: datetime,
        granularity: str = "daily"
    ) -> Dict[str, Any]:
        """
        Optimize time series queries based on date range and granularity.
        
        Args:
            start_date: Start of time range
            end_date: End of time range
            granularity: Time granularity (hourly, daily, weekly, monthly)
        
        Returns:
            Optimized query parameters
        """
        # Calculate optimal aggregation level
        days_diff = (end_date - start_date).days
        
        # Auto-adjust granularity for large date ranges
        if granularity == "hourly" and days_diff > 7:
            logger.warning(f"Hourly granularity requested for {days_diff} days. Consider using daily.")
            suggested_granularity = "daily"
        elif granularity == "daily" and days_diff > 90:
            suggested_granularity = "weekly"
        elif granularity == "weekly" and days_diff > 365:
            suggested_granularity = "monthly"
        else:
            suggested_granularity = granularity
        
        # Choose appropriate date truncation
        date_trunc_map = {
            "hourly": "hour",
            "daily": "day", 
            "weekly": "week",
            "monthly": "month"
        }
        
        return {
            "date_trunc": date_trunc_map.get(suggested_granularity, "day"),
            "suggested_granularity": suggested_granularity,
            "optimization_applied": suggested_granularity != granularity,
            "estimated_points": _estimate_data_points(start_date, end_date, suggested_granularity)
        }

# =============================================================================
# BATCH PROCESSING OPTIMIZATION  
# =============================================================================

class BatchProcessor:
    """Optimized batch processing for large operations."""
    
    def __init__(self, batch_size: int = 100, max_concurrent: int = 5):
        self.batch_size = batch_size
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_in_batches(
        self,
        items: List[Any],
        processor_func: Callable,
        progress_callback: Optional[Callable] = None
    ) -> List[Any]:
        """
        Process items in optimized batches with concurrency control.
        
        Args:
            items: List of items to process
            processor_func: Async function to process each batch
            progress_callback: Optional callback for progress updates
        
        Returns:
            List of processed results
        """
        results = []
        total_batches = (len(items) + self.batch_size - 1) // self.batch_size
        
        # Create batches
        batches = [
            items[i:i + self.batch_size]
            for i in range(0, len(items), self.batch_size)
        ]
        
        # Process batches concurrently
        async def process_batch(batch_items: List[Any], batch_num: int):
            async with self.semaphore:
                try:
                    batch_results = await processor_func(batch_items)
                    
                    if progress_callback:
                        progress = (batch_num + 1) / total_batches * 100
                        await progress_callback(progress, batch_num + 1, total_batches)
                    
                    return batch_results
                except Exception as e:
                    logger.error(f"Error processing batch {batch_num}: {e}")
                    return []
        
        # Execute all batches
        tasks = [process_batch(batch, i) for i, batch in enumerate(batches)]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect results
        for batch_result in batch_results:
            if isinstance(batch_result, Exception):
                logger.error(f"Batch processing error: {batch_result}")
                continue
            
            if isinstance(batch_result, list):
                results.extend(batch_result)
            else:
                results.append(batch_result)
        
        return results

# =============================================================================
# CONNECTION POOL OPTIMIZATION
# =============================================================================

class ConnectionPoolManager:
    """Optimize database connection pooling."""
    
    def __init__(self):
        self.pool_stats = {
            "active_connections": 0,
            "idle_connections": 0,
            "total_connections": 0,
            "connection_errors": 0
        }
    
    async def get_pool_health(self) -> Dict[str, Any]:
        """Get connection pool health metrics."""
        try:
            # This would integrate with actual connection pool
            # For now, return mock data
            return {
                "healthy": True,
                "active_connections": self.pool_stats["active_connections"],
                "idle_connections": self.pool_stats["idle_connections"], 
                "total_connections": self.pool_stats["total_connections"],
                "utilization_percentage": 0,
                "connection_errors": self.pool_stats["connection_errors"],
                "recommendations": self._get_pool_recommendations()
            }
        except Exception as e:
            logger.error(f"Error getting pool health: {e}")
            return {"healthy": False, "error": str(e)}
    
    def _get_pool_recommendations(self) -> List[str]:
        """Get connection pool optimization recommendations."""
        recommendations = []
        
        utilization = self.pool_stats["active_connections"] / max(self.pool_stats["total_connections"], 1)
        
        if utilization > 0.8:
            recommendations.append("Consider increasing connection pool size")
        elif utilization < 0.2:
            recommendations.append("Consider reducing connection pool size to save resources")
        
        if self.pool_stats["connection_errors"] > 10:
            recommendations.append("High connection error rate detected - check database health")
        
        return recommendations

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _generate_cache_key(prefix: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """Generate deterministic cache key from function parameters."""
    # Create a hash of the arguments
    key_data = {
        "func": func_name,
        "args": args,
        "kwargs": sorted(kwargs.items())  # Sort for consistency
    }
    
    key_string = json.dumps(key_data, sort_keys=True, default=str)
    key_hash = hashlib.sha256(key_string.encode()).hexdigest()[:16]
    
    return f"{prefix}:{func_name}:{key_hash}"

def _estimate_data_points(start_date: datetime, end_date: datetime, granularity: str) -> int:
    """Estimate number of data points for a time range and granularity."""
    days_diff = (end_date - start_date).days
    
    estimates = {
        "hourly": days_diff * 24,
        "daily": days_diff,
        "weekly": days_diff // 7,
        "monthly": days_diff // 30
    }
    
    return estimates.get(granularity, days_diff)

# =============================================================================
# PERFORMANCE MIDDLEWARE
# =============================================================================

class PerformanceMiddleware:
    """FastAPI middleware for performance monitoring."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        
        # Wrap send to capture response
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Add performance headers
                duration = time.time() - start_time
                message.setdefault("headers", [])
                message["headers"].append([
                    b"x-response-time",
                    f"{duration:.3f}s".encode()
                ])
                
                # Log slow requests
                if duration > 2.0:
                    path = scope.get("path", "unknown")
                    method = scope.get("method", "unknown")
                    logger.warning(f"Slow request: {method} {path} took {duration:.3f}s")
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)

# =============================================================================
# EXPORT OPTIMIZED FUNCTIONS
# =============================================================================

# Export commonly used optimizers
query_optimizer = QueryOptimizer()
analytics_optimizer = AnalyticsOptimizer()
batch_processor = BatchProcessor()
connection_pool_manager = ConnectionPoolManager()

# Export decorators for easy use
__all__ = [
    "cache_result",
    "invalidate_cache", 
    "performance_monitor",
    "query_optimizer",
    "analytics_optimizer",
    "batch_processor",
    "connection_pool_manager",
    "PerformanceMiddleware"
]