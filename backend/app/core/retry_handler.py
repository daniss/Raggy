"""Enhanced error handling with retry mechanisms and circuit breaker pattern."""

import asyncio
import logging
import time
import functools
from typing import Callable, Any, Optional, List, Dict, Type
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RetryStrategy(Enum):
    """Retry strategies for different types of operations."""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"  
    FIXED_DELAY = "fixed_delay"
    FIBONACCI_BACKOFF = "fibonacci_backoff"


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit is open, failing fast
    HALF_OPEN = "half_open"  # Testing if service is back


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_exceptions: List[Type[Exception]] = field(default_factory=lambda: [Exception])
    non_retryable_exceptions: List[Type[Exception]] = field(default_factory=list)


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    expected_exception: Type[Exception] = Exception
    half_open_max_calls: int = 3


class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open."""
    pass


class CircuitBreaker:
    """Circuit breaker implementation for handling service failures."""
    
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.half_open_calls = 0
        
    def _should_attempt_reset(self) -> bool:
        """Check if we should attempt to reset the circuit breaker."""
        if self.state != CircuitBreakerState.OPEN:
            return False
            
        if self.last_failure_time is None:
            return True
            
        return datetime.now() - self.last_failure_time > timedelta(seconds=self.config.recovery_timeout)
    
    def _on_success(self):
        """Handle successful operation."""
        self.failure_count = 0
        self.half_open_calls = 0
        self.state = CircuitBreakerState.CLOSED
        
    def _on_failure(self):
        """Handle failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN
        elif self.failure_count >= self.config.failure_threshold:
            self.state = CircuitBreakerState.OPEN
    
    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitBreakerOpenException(f"Circuit breaker is open. Service unavailable.")
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            if self.half_open_calls >= self.config.half_open_max_calls:
                raise CircuitBreakerOpenException(f"Half-open call limit reached")
                
            self.half_open_calls += 1
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.config.expected_exception as e:
            self._on_failure()
            raise
    
    async def async_call(self, func: Callable, *args, **kwargs):
        """Execute async function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitBreakerOpenException(f"Circuit breaker is open. Service unavailable.")
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            if self.half_open_calls >= self.config.half_open_max_calls:
                raise CircuitBreakerOpenException(f"Half-open call limit reached")
                
            self.half_open_calls += 1
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.config.expected_exception as e:
            self._on_failure()
            raise
    
    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "half_open_calls": self.half_open_calls
        }


class RetryHandler:
    """Advanced retry handler with multiple strategies and circuit breaker integration."""
    
    def __init__(self, config: RetryConfig, circuit_breaker: Optional[CircuitBreaker] = None):
        self.config = config
        self.circuit_breaker = circuit_breaker
        
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay based on retry strategy."""
        if self.config.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = self.config.base_delay * (self.config.exponential_base ** (attempt - 1))
        elif self.config.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = self.config.base_delay * attempt
        elif self.config.strategy == RetryStrategy.FIBONACCI_BACKOFF:
            # Simple Fibonacci: 1, 1, 2, 3, 5, 8...
            if attempt <= 2:
                delay = self.config.base_delay
            else:
                fib_a, fib_b = 1, 1
                for _ in range(attempt - 2):
                    fib_a, fib_b = fib_b, fib_a + fib_b
                delay = self.config.base_delay * fib_b
        else:  # FIXED_DELAY
            delay = self.config.base_delay
        
        # Apply max delay limit
        delay = min(delay, self.config.max_delay)
        
        # Add jitter to prevent thundering herd
        if self.config.jitter:
            import random
            delay = delay * (0.5 + random.random() * 0.5)
            
        return delay
    
    def _is_retryable_exception(self, exception: Exception) -> bool:
        """Check if exception is retryable."""
        # Check non-retryable exceptions first
        for non_retryable in self.config.non_retryable_exceptions:
            if isinstance(exception, non_retryable):
                return False
        
        # Check retryable exceptions
        for retryable in self.config.retryable_exceptions:
            if isinstance(exception, retryable):
                return True
        
        return False
    
    def retry(self, func: Callable[..., Any]) -> Callable[..., Any]:
        """Decorator for adding retry logic to functions."""
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(1, self.config.max_attempts + 1):
                try:
                    if self.circuit_breaker:
                        return self.circuit_breaker.call(func, *args, **kwargs)
                    else:
                        return func(*args, **kwargs)
                        
                except Exception as e:
                    last_exception = e
                    
                    # Log the attempt
                    logger.warning(f"Attempt {attempt}/{self.config.max_attempts} failed: {type(e).__name__}: {str(e)}")
                    
                    # Check if we should retry
                    if not self._is_retryable_exception(e):
                        logger.error(f"Non-retryable exception: {type(e).__name__}")
                        raise
                    
                    # Don't delay on last attempt
                    if attempt < self.config.max_attempts:
                        delay = self._calculate_delay(attempt)
                        logger.info(f"Retrying in {delay:.2f} seconds...")
                        time.sleep(delay)
                    
            # All attempts failed
            logger.error(f"All {self.config.max_attempts} attempts failed. Last exception: {type(last_exception).__name__}: {str(last_exception)}")
            raise last_exception
            
        return wrapper
    
    def async_retry(self, func: Callable[..., Any]) -> Callable[..., Any]:
        """Decorator for adding retry logic to async functions."""
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(1, self.config.max_attempts + 1):
                try:
                    if self.circuit_breaker:
                        return await self.circuit_breaker.async_call(func, *args, **kwargs)
                    else:
                        if asyncio.iscoroutinefunction(func):
                            return await func(*args, **kwargs)
                        else:
                            return func(*args, **kwargs)
                        
                except Exception as e:
                    last_exception = e
                    
                    # Log the attempt
                    logger.warning(f"Async attempt {attempt}/{self.config.max_attempts} failed: {type(e).__name__}: {str(e)}")
                    
                    # Check if we should retry
                    if not self._is_retryable_exception(e):
                        logger.error(f"Non-retryable exception: {type(e).__name__}")
                        raise
                    
                    # Don't delay on last attempt
                    if attempt < self.config.max_attempts:
                        delay = self._calculate_delay(attempt)
                        logger.info(f"Retrying in {delay:.2f} seconds...")
                        await asyncio.sleep(delay)
                    
            # All attempts failed
            logger.error(f"All {self.config.max_attempts} attempts failed. Last exception: {type(last_exception).__name__}: {str(last_exception)}")
            raise last_exception
            
        return wrapper


# Predefined configurations for common scenarios
class RetryConfigs:
    """Predefined retry configurations for common use cases."""
    
    # For external API calls (Groq, etc.)
    EXTERNAL_API = RetryConfig(
        max_attempts=3,
        base_delay=1.0,
        max_delay=30.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retryable_exceptions=[ConnectionError, TimeoutError, Exception],
        non_retryable_exceptions=[ValueError, TypeError, KeyError]
    )
    
    # For database operations  
    DATABASE = RetryConfig(
        max_attempts=5,
        base_delay=0.5,
        max_delay=10.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retryable_exceptions=[ConnectionError, TimeoutError],
        non_retryable_exceptions=[ValueError, TypeError]
    )
    
    # For file operations
    FILE_OPERATIONS = RetryConfig(
        max_attempts=3,
        base_delay=0.1,
        max_delay=2.0,
        strategy=RetryStrategy.LINEAR_BACKOFF,
        retryable_exceptions=[IOError, OSError],
        non_retryable_exceptions=[PermissionError, FileNotFoundError]
    )
    
    # For network operations
    NETWORK = RetryConfig(
        max_attempts=4,
        base_delay=2.0,
        max_delay=60.0,
        strategy=RetryStrategy.FIBONACCI_BACKOFF,
        retryable_exceptions=[ConnectionError, TimeoutError],
        non_retryable_exceptions=[ValueError, TypeError]
    )


# Circuit breaker configurations
class CircuitBreakerConfigs:
    """Predefined circuit breaker configurations."""
    
    # For external APIs
    EXTERNAL_API = CircuitBreakerConfig(
        failure_threshold=5,
        recovery_timeout=60.0,
        expected_exception=Exception,
        half_open_max_calls=3
    )
    
    # For database connections
    DATABASE = CircuitBreakerConfig(
        failure_threshold=3,
        recovery_timeout=30.0,
        expected_exception=ConnectionError,
        half_open_max_calls=2
    )


# Global instances for common use cases
groq_circuit_breaker = CircuitBreaker(CircuitBreakerConfigs.EXTERNAL_API)
database_circuit_breaker = CircuitBreaker(CircuitBreakerConfigs.DATABASE)

groq_retry_handler = RetryHandler(RetryConfigs.EXTERNAL_API, groq_circuit_breaker)
database_retry_handler = RetryHandler(RetryConfigs.DATABASE, database_circuit_breaker)
file_retry_handler = RetryHandler(RetryConfigs.FILE_OPERATIONS)
network_retry_handler = RetryHandler(RetryConfigs.NETWORK)


# Convenience decorators
def retry_external_api(func):
    """Decorator for external API calls with retry and circuit breaker."""
    return groq_retry_handler.async_retry(func) if asyncio.iscoroutinefunction(func) else groq_retry_handler.retry(func)


def retry_database(func):
    """Decorator for database operations with retry and circuit breaker."""
    return database_retry_handler.async_retry(func) if asyncio.iscoroutinefunction(func) else database_retry_handler.retry(func)


def retry_file_ops(func):
    """Decorator for file operations with retry."""
    return file_retry_handler.async_retry(func) if asyncio.iscoroutinefunction(func) else file_retry_handler.retry(func)


def retry_network(func):
    """Decorator for network operations with retry."""
    return network_retry_handler.async_retry(func) if asyncio.iscoroutinefunction(func) else network_retry_handler.retry(func)