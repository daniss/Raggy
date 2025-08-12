"""System health and monitoring endpoints with circuit breaker status."""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from app.core.deps import get_current_user, require_admin
from app.core.retry_handler import groq_circuit_breaker, database_circuit_breaker
from app.rag import qa_chain
from app.db.supabase_client import supabase_client
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system-health"])


@router.get("/health/detailed")
async def get_detailed_health(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get detailed system health including circuit breaker states."""
    try:
        health_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": "healthy",
            "components": {},
            "circuit_breakers": {},
            "performance_metrics": {}
        }
        
        # Skip Groq API test - wasteful on tokens
        # Just check if API key is configured
        from app.core.config import settings
        if settings.groq_api_key:
            health_data["components"]["groq_api"] = {
                "status": "configured",
                "last_check": datetime.utcnow().isoformat()
            }
        else:
            health_data["components"]["groq_api"] = {
                "status": "not_configured",
                "last_check": datetime.utcnow().isoformat()
            }
        
        # Check database health  
        try:
            db_result = supabase_client.table("chat_logs").select("id").limit(1).execute()
            health_data["components"]["database"] = {
                "status": "healthy",
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            health_data["components"]["database"] = {
                "status": "unhealthy", 
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }
        
        # Get circuit breaker states
        health_data["circuit_breakers"] = {
            "groq_api": groq_circuit_breaker.get_state(),
            "database": database_circuit_breaker.get_state()
        }
        
        # Determine overall status
        unhealthy_components = [
            comp for comp, data in health_data["components"].items() 
            if data["status"] != "healthy"
        ]
        
        open_breakers = [
            name for name, state in health_data["circuit_breakers"].items()
            if state["state"] == "open"
        ]
        
        if unhealthy_components or open_breakers:
            health_data["overall_status"] = "degraded" if not open_breakers else "unhealthy"
            health_data["issues"] = {
                "unhealthy_components": unhealthy_components,
                "open_circuit_breakers": open_breakers
            }
        
        return health_data
        
    except Exception as e:
        logger.error(f"Failed to get detailed health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system health")


@router.get("/health/circuit-breakers")
async def get_circuit_breaker_status(
    current_user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Get detailed circuit breaker status (admin only)."""
    try:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "circuit_breakers": {
                "groq_api": {
                    **groq_circuit_breaker.get_state(),
                    "config": {
                        "failure_threshold": groq_circuit_breaker.config.failure_threshold,
                        "recovery_timeout": groq_circuit_breaker.config.recovery_timeout,
                        "half_open_max_calls": groq_circuit_breaker.config.half_open_max_calls
                    }
                },
                "database": {
                    **database_circuit_breaker.get_state(),
                    "config": {
                        "failure_threshold": database_circuit_breaker.config.failure_threshold,
                        "recovery_timeout": database_circuit_breaker.config.recovery_timeout,
                        "half_open_max_calls": database_circuit_breaker.config.half_open_max_calls
                    }
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get circuit breaker status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve circuit breaker status")


@router.post("/health/circuit-breakers/{breaker_name}/reset")
async def reset_circuit_breaker(
    breaker_name: str,
    current_user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Reset a circuit breaker (admin only)."""
    try:
        if breaker_name == "groq_api":
            groq_circuit_breaker.failure_count = 0
            groq_circuit_breaker.state = groq_circuit_breaker.state.CLOSED
            groq_circuit_breaker.half_open_calls = 0
            breaker = groq_circuit_breaker
        elif breaker_name == "database":
            database_circuit_breaker.failure_count = 0
            database_circuit_breaker.state = database_circuit_breaker.state.CLOSED
            database_circuit_breaker.half_open_calls = 0
            breaker = database_circuit_breaker
        else:
            raise HTTPException(status_code=404, detail=f"Circuit breaker '{breaker_name}' not found")
        
        logger.info(f"Circuit breaker '{breaker_name}' reset by admin user {current_user.get('id')}")
        
        return {
            "message": f"Circuit breaker '{breaker_name}' reset successfully",
            "new_state": breaker.get_state(),
            "reset_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset circuit breaker {breaker_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")


@router.get("/metrics/retry-stats")
async def get_retry_statistics(
    current_user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Get retry mechanism statistics (admin only)."""
    try:
        # In a full implementation, you'd track these metrics in a monitoring system
        # For now, return circuit breaker states as a proxy for retry health
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "circuit_breaker_states": {
                "groq_api": groq_circuit_breaker.get_state(),
                "database": database_circuit_breaker.get_state()
            },
            "retry_configurations": {
                "groq_api": {
                    "max_attempts": 3,
                    "base_delay": 1.0,
                    "max_delay": 30.0,
                    "strategy": "exponential_backoff"
                },
                "database": {
                    "max_attempts": 5,
                    "base_delay": 0.5,
                    "max_delay": 10.0,
                    "strategy": "exponential_backoff"
                }
            },
            "recommendations": _get_system_recommendations()
        }
        
    except Exception as e:
        logger.error(f"Failed to get retry statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve retry statistics")


def _get_system_recommendations() -> List[Dict[str, str]]:
    """Generate system health recommendations based on current state."""
    recommendations = []
    
    # Check Groq circuit breaker
    groq_state = groq_circuit_breaker.get_state()
    if groq_state["state"] == "open":
        recommendations.append({
            "component": "groq_api",
            "severity": "high",
            "message": "Groq API circuit breaker is open. Check API service status and consider increasing timeout limits.",
            "action": "Monitor Groq API status and consider manual reset if service is restored."
        })
    elif groq_state["failure_count"] > 2:
        recommendations.append({
            "component": "groq_api", 
            "severity": "medium",
            "message": f"Groq API has {groq_state['failure_count']} recent failures. Monitor closely.",
            "action": "Check Groq API response times and error rates."
        })
    
    # Check database circuit breaker
    db_state = database_circuit_breaker.get_state()
    if db_state["state"] == "open":
        recommendations.append({
            "component": "database",
            "severity": "high", 
            "message": "Database circuit breaker is open. Check Supabase connection and network connectivity.",
            "action": "Verify Supabase service status and network configuration."
        })
    elif db_state["failure_count"] > 1:
        recommendations.append({
            "component": "database",
            "severity": "medium",
            "message": f"Database has {db_state['failure_count']} recent failures. Monitor connection stability.",
            "action": "Check database connection pool and query performance."
        })
    
    # General recommendations
    if not recommendations:
        recommendations.append({
            "component": "system",
            "severity": "info",
            "message": "All systems operating normally. Continue monitoring.",
            "action": "Maintain current monitoring and alerting practices."
        })
        
    return recommendations


@router.get("/diagnostics/run")
async def run_system_diagnostics(
    current_user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Run comprehensive system diagnostics (admin only)."""
    try:
        diagnostics = {
            "timestamp": datetime.utcnow().isoformat(),
            "tests": {},
            "overall_result": "pass"
        }
        
        # Skip Groq API test - wasteful on tokens
        # Just check if API key is configured
        from app.core.config import settings
        if settings.groq_api_key:
            diagnostics["tests"]["groq_connection"] = {
                "status": "pass",
                "message": "Groq API key configured",
                "execution_time": "0s"
            }
        else:
            diagnostics["tests"]["groq_connection"] = {
                "status": "fail",
                "message": "Groq API key not configured",
                "execution_time": "0s"
            }
            diagnostics["overall_result"] = "fail"
        
        # Test database connection
        try:
            db_result = supabase_client.table("documents").select("id").limit(1).execute()
            diagnostics["tests"]["database_connection"] = {
                "status": "pass",
                "message": "Database connection successful",
                "execution_time": "< 1s"
            }
        except Exception as e:
            diagnostics["tests"]["database_connection"] = {
                "status": "fail", 
                "message": f"Database test failed: {str(e)}",
                "execution_time": "timeout"
            }
            diagnostics["overall_result"] = "fail"
        
        # Test vector store
        try:
            from app.rag import retriever
            stats = retriever.get_collection_stats()
            diagnostics["tests"]["vector_store"] = {
                "status": "pass",
                "message": f"Vector store accessible with {stats.get('total_vectors', 0)} vectors",
                "execution_time": "< 1s"
            }
        except Exception as e:
            diagnostics["tests"]["vector_store"] = {
                "status": "fail",
                "message": f"Vector store test failed: {str(e)}",
                "execution_time": "timeout"
            }
            diagnostics["overall_result"] = "fail"
        
        # Add circuit breaker status
        diagnostics["circuit_breaker_status"] = {
            "groq_api": groq_circuit_breaker.get_state(),
            "database": database_circuit_breaker.get_state()
        }
        
        return diagnostics
        
    except Exception as e:
        logger.error(f"Failed to run system diagnostics: {e}")
        raise HTTPException(status_code=500, detail="Failed to run system diagnostics")