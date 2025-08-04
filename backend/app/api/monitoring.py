"""
Monitoring and alerting API endpoints.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.deps import require_admin, get_current_user, get_current_organization
from app.core.monitoring import alert_manager, AlertSeverity, AlertType
from app.services.audit_logger import audit_logger, AuditAction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def get_system_health(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get comprehensive system health status (admin only).
    """
    try:
        # Trigger a health check
        alerts = await alert_manager.check_system_health()
        
        # Get system metrics
        metrics = await alert_manager.metrics_collector.collect_system_metrics()
        
        # Get alert summary
        alert_summary = alert_manager.get_alert_summary()
        
        # Determine overall health status
        critical_alerts = len([a for a in alerts if a.severity == AlertSeverity.CRITICAL])
        high_alerts = len([a for a in alerts if a.severity == AlertSeverity.HIGH])
        
        if critical_alerts > 0:
            health_status = "critical"
        elif high_alerts > 0:
            health_status = "warning"
        else:
            health_status = "healthy"
        
        # Log the health check access
        await audit_logger.log_event(
            action=AuditAction.DATA_EXPORT,
            resource_type=audit_logger.AuditResourceType.SYSTEM,
            organization_id=current_org["id"],
            user_id=current_user["id"],
            additional_data={
                "health_status": health_status,
                "alert_count": len(alerts)
            }
        )
        
        return {
            "health_status": health_status,
            "timestamp": metrics.get("timestamp"),
            "uptime_seconds": metrics.get("uptime_seconds"),
            "system_metrics": metrics,
            "alert_summary": alert_summary,
            "recent_alerts": [
                {
                    "type": alert.alert_type.value,
                    "severity": alert.severity.value,
                    "message": alert.message,
                    "timestamp": alert.timestamp.isoformat(),
                    "resolved": alert.resolved
                }
                for alert in alerts[-10:]  # Last 10 alerts
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system health")


@router.get("/alerts")
async def get_alerts(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    active_only: bool = Query(True, description="Show only active alerts"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of alerts")
):
    """
    Get system alerts (admin only).
    """
    try:
        # Parse severity filter
        severity_filter = None
        if severity:
            try:
                severity_filter = AlertSeverity(severity.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid severity. Valid values: {[s.value for s in AlertSeverity]}"
                )
        
        # Get alerts
        if active_only:
            alerts = alert_manager.get_active_alerts(severity=severity_filter)
        else:
            all_alerts = alert_manager.alert_history
            if severity_filter:
                all_alerts = [a for a in all_alerts if a.severity == severity_filter]
            alerts = sorted(all_alerts, key=lambda x: x.timestamp, reverse=True)
        
        # Apply limit
        alerts = alerts[:limit]
        
        # Format response
        formatted_alerts = []
        for alert in alerts:
            formatted_alerts.append({
                "id": f"{alert.alert_type.value}_{int(alert.timestamp.timestamp())}",
                "type": alert.alert_type.value,
                "severity": alert.severity.value,
                "message": alert.message,
                "details": alert.details,
                "timestamp": alert.timestamp.isoformat(),
                "resolved": alert.resolved,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                "organization_id": alert.organization_id
            })
        
        return {
            "alerts": formatted_alerts,
            "total_count": len(formatted_alerts),
            "filters": {
                "severity": severity,
                "active_only": active_only,
                "limit": limit
            },
            "alert_summary": alert_manager.get_alert_summary()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve alerts")


@router.get("/metrics")
async def get_system_metrics(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get detailed system metrics (admin only).
    """
    try:
        metrics = await alert_manager.metrics_collector.collect_system_metrics()
        
        return {
            "metrics": metrics,
            "collection_time": metrics.get("timestamp"),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system metrics")


@router.post("/alerts/{alert_type}/resolve")
async def resolve_alert(
    alert_type: str,
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Manually resolve an alert (admin only).
    """
    try:
        # Parse alert type
        try:
            alert_type_enum = AlertType(alert_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid alert type. Valid values: {[t.value for t in AlertType]}"
            )
        
        # Resolve the alert
        await alert_manager.resolve_alert(
            alert_type=alert_type_enum,
            details={"resolved_by": current_user["id"], "manual_resolution": True}
        )
        
        # Log the resolution
        await audit_logger.log_event(
            action=AuditAction.SETTINGS_CHANGE,
            resource_type=audit_logger.AuditResourceType.SYSTEM,
            organization_id=current_org["id"],
            user_id=current_user["id"],
            additional_data={
                "action": "alert_resolved",
                "alert_type": alert_type,
                "manual_resolution": True
            }
        )
        
        return {
            "message": f"Alert {alert_type} resolved successfully",
            "resolved_by": current_user["id"],
            "timestamp": alert_manager.metrics_collector.start_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert {alert_type}: {e}")
        raise HTTPException(status_code=500, detail="Failed to resolve alert")


@router.get("/status")
async def get_service_status():
    """
    Get basic service status (public endpoint for status pages).
    """
    try:
        # Basic health check without detailed metrics
        metrics = await alert_manager.metrics_collector.collect_system_metrics()
        active_alerts = alert_manager.get_active_alerts()
        
        # Determine service status
        critical_alerts = [a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]
        high_alerts = [a for a in active_alerts if a.severity == AlertSeverity.HIGH]
        
        if critical_alerts:
            status = "major_outage"
            message = f"{len(critical_alerts)} critical issues affecting service"
        elif high_alerts:
            status = "partial_outage"
            message = f"{len(high_alerts)} issues may affect some functionality"
        elif len(active_alerts) > 0:
            status = "degraded_performance"
            message = f"{len(active_alerts)} minor issues detected"
        else:
            status = "operational"
            message = "All systems operational"
        
        return {
            "status": status,
            "message": message,
            "timestamp": metrics.get("timestamp"),
            "uptime_seconds": metrics.get("uptime_seconds"),
            "services": {
                "api": "operational" if metrics.get("uptime_seconds", 0) > 0 else "outage",
                "database": metrics.get("database", {}).get("status", "unknown"),
                "cache": metrics.get("redis", {}).get("status", "unknown")
            },
            "incident_count": len(active_alerts)
        }
        
    except Exception as e:
        logger.error(f"Failed to get service status: {e}")
        return {
            "status": "unknown",
            "message": "Status check failed",
            "timestamp": None,
            "error": "Service status unavailable"
        }


@router.get("/diagnostics")
async def run_diagnostics(
    current_user: dict = Depends(require_admin),
    current_org: dict = Depends(get_current_organization)
):
    """
    Run comprehensive system diagnostics (admin only).
    """
    try:
        diagnostics = {
            "timestamp": alert_manager.metrics_collector.start_time,
            "tests": {}
        }
        
        # Test database connectivity
        try:
            from app.db.supabase_client import supabase_client
            result = supabase_client.table("organizations").select("id").limit(1).execute()
            diagnostics["tests"]["database"] = {
                "status": "pass",
                "message": "Database connection successful",
                "response_time_ms": None  # Would need timing code
            }
        except Exception as e:
            diagnostics["tests"]["database"] = {
                "status": "fail",
                "message": f"Database connection failed: {str(e)}",
                "error": str(e)
            }
        
        # Test Redis connectivity
        try:
            from app.core.redis_cache import redis_cache
            if redis_cache.enabled:
                stats = redis_cache.get_stats()
                diagnostics["tests"]["redis"] = {
                    "status": "pass",
                    "message": "Redis connection successful",
                    "details": stats
                }
            else:
                diagnostics["tests"]["redis"] = {
                    "status": "warning",
                    "message": "Redis is disabled",
                    "details": {"enabled": False}
                }
        except Exception as e:
            diagnostics["tests"]["redis"] = {
                "status": "fail",
                "message": f"Redis connection failed: {str(e)}",
                "error": str(e)
            }
        
        # Test RAG components
        try:
            from app.rag import retriever, qa_chain
            
            # Test vector store
            stats = retriever.get_collection_stats()
            diagnostics["tests"]["vector_store"] = {
                "status": "pass",
                "message": "Vector store accessible",
                "details": stats
            }
            
            # Test LLM API
            llm_status = qa_chain.test_connection()
            diagnostics["tests"]["llm_api"] = {
                "status": "pass" if llm_status else "fail",
                "message": "LLM API accessible" if llm_status else "LLM API connection failed"
            }
            
        except Exception as e:
            diagnostics["tests"]["rag_components"] = {
                "status": "fail",
                "message": f"RAG components test failed: {str(e)}",
                "error": str(e)
            }
        
        # Determine overall diagnostic result
        failed_tests = [test for test, result in diagnostics["tests"].items() if result["status"] == "fail"]
        warning_tests = [test for test, result in diagnostics["tests"].items() if result["status"] == "warning"]
        
        if failed_tests:
            diagnostics["overall_status"] = "fail"
            diagnostics["summary"] = f"Failed tests: {', '.join(failed_tests)}"
        elif warning_tests:
            diagnostics["overall_status"] = "warning"
            diagnostics["summary"] = f"Warning tests: {', '.join(warning_tests)}"
        else:
            diagnostics["overall_status"] = "pass"
            diagnostics["summary"] = "All diagnostic tests passed"
        
        return diagnostics
        
    except Exception as e:
        logger.error(f"Diagnostic run failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to run diagnostics")