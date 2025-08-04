"""
Application monitoring and alerting system.
"""
import logging
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass
from app.db.supabase_client import supabase_client
from app.core.redis_cache import redis_cache
from app.services.audit_logger import audit_logger, AuditAction

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(Enum):
    """Types of alerts."""
    SYSTEM_ERROR = "system_error"
    HIGH_ERROR_RATE = "high_error_rate"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    DATABASE_CONNECTION = "database_connection"
    REDIS_CONNECTION = "redis_connection"
    DISK_SPACE = "disk_space"
    MEMORY_USAGE = "memory_usage"
    RESPONSE_TIME = "response_time"
    SECURITY_INCIDENT = "security_incident"
    QUOTA_EXCEEDED = "quota_exceeded"


@dataclass
class Alert:
    """Alert data structure."""
    alert_type: AlertType
    severity: AlertSeverity
    message: str
    details: Dict[str, Any]
    timestamp: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    organization_id: Optional[str] = None


class MetricsCollector:
    """Collects application metrics."""
    
    def __init__(self):
        self.metrics_buffer = {}
        self.start_time = time.time()
    
    async def collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system-wide metrics."""
        try:
            metrics = {
                "timestamp": datetime.utcnow().isoformat(),
                "uptime_seconds": int(time.time() - self.start_time),
                "database": await self._collect_database_metrics(),
                "redis": await self._collect_redis_metrics(),
                "application": await self._collect_app_metrics()
            }
            return metrics
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    async def _collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database metrics."""
        try:
            # Get organization count
            org_result = supabase_client.table("organizations").select("id", count="exact").execute()
            org_count = org_result.count or 0
            
            # Get document count
            doc_result = supabase_client.table("documents").select("id", count="exact").execute()
            doc_count = doc_result.count or 0
            
            # Get recent chat logs count (last 24 hours)
            yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
            chat_result = supabase_client.table("chat_logs").select(
                "id", count="exact"
            ).gte("created_at", yesterday).execute()
            chat_count = chat_result.count or 0
            
            # Get audit logs count (last 24 hours)
            audit_result = supabase_client.table("audit_logs").select(
                "id", count="exact"
            ).gte("created_at", yesterday).execute()
            audit_count = audit_result.count or 0
            
            return {
                "status": "connected",
                "organizations": org_count,
                "documents": doc_count,
                "chat_logs_24h": chat_count,
                "audit_logs_24h": audit_count
            }
        except Exception as e:
            logger.error(f"Database metrics collection failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _collect_redis_metrics(self) -> Dict[str, Any]:
        """Collect Redis metrics."""
        try:
            if not redis_cache.enabled:
                return {"status": "disabled"}
            
            stats = redis_cache.get_stats()
            return {
                "status": "connected" if stats.get("enabled") else "disconnected",
                "total_keys": stats.get("total_keys", 0),
                "used_memory": stats.get("used_memory", "unknown"),
                "connected_clients": stats.get("connected_clients", 0),
                "hits": stats.get("hits", 0),
                "misses": stats.get("misses", 0),
                "hit_rate": stats.get("hit_rate", 0)
            }
        except Exception as e:
            logger.error(f"Redis metrics collection failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _collect_app_metrics(self) -> Dict[str, Any]:
        """Collect application-specific metrics."""
        try:
            # This would collect metrics like request counts, response times, etc.
            # For now, return basic info
            return {
                "version": "1.0.0",
                "environment": "production",
                "python_version": "3.9+"
            }
        except Exception as e:
            logger.error(f"App metrics collection failed: {e}")
            return {"error": str(e)}


class AlertManager:
    """Manages alerts and notifications."""
    
    def __init__(self):
        self.active_alerts: List[Alert] = []
        self.alert_history: List[Alert] = []
        self.metrics_collector = MetricsCollector()
    
    async def check_system_health(self) -> List[Alert]:
        """Check system health and generate alerts."""
        alerts = []
        
        try:
            metrics = await self.metrics_collector.collect_system_metrics()
            
            # Check database connectivity
            if metrics.get("database", {}).get("status") != "connected":
                alerts.append(Alert(
                    alert_type=AlertType.DATABASE_CONNECTION,
                    severity=AlertSeverity.CRITICAL,
                    message="Database connection failed",
                    details=metrics.get("database", {}),
                    timestamp=datetime.utcnow()
                ))
            
            # Check Redis connectivity  
            redis_status = metrics.get("redis", {}).get("status")
            if redis_status == "error":
                alerts.append(Alert(
                    alert_type=AlertType.REDIS_CONNECTION,
                    severity=AlertSeverity.HIGH,
                    message="Redis connection failed",
                    details=metrics.get("redis", {}),
                    timestamp=datetime.utcnow()
                ))
            
            # Check for high error rates in recent logs
            await self._check_error_rates(alerts)
            
            # Check for security incidents
            await self._check_security_incidents(alerts)
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            alerts.append(Alert(
                alert_type=AlertType.SYSTEM_ERROR,
                severity=AlertSeverity.HIGH,
                message="Health check system failure",
                details={"error": str(e)},
                timestamp=datetime.utcnow()
            ))
        
        # Update active alerts
        for alert in alerts:
            self._add_alert(alert)
        
        return alerts
    
    async def _check_error_rates(self, alerts: List[Alert]):
        """Check for high error rates in audit logs."""
        try:
            # Check for system errors in the last hour
            one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            
            error_result = supabase_client.table("audit_logs").select(
                "id", count="exact"
            ).eq("action", "system_error").gte("created_at", one_hour_ago).execute()
            
            error_count = error_result.count or 0
            
            if error_count > 10:  # More than 10 errors in an hour
                alerts.append(Alert(
                    alert_type=AlertType.HIGH_ERROR_RATE,
                    severity=AlertSeverity.HIGH,
                    message=f"High error rate detected: {error_count} errors in the last hour",
                    details={"error_count": error_count, "period": "1 hour"},
                    timestamp=datetime.utcnow()
                ))
        except Exception as e:
            logger.error(f"Error rate check failed: {e}")
    
    async def _check_security_incidents(self, alerts: List[Alert]):
        """Check for security incidents."""
        try:
            # Check for suspicious activity in the last hour
            one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            
            security_actions = ["suspicious_activity", "unauthorized_access", "auth_failed"]
            
            for action in security_actions:
                result = supabase_client.table("audit_logs").select(
                    "id", count="exact"
                ).eq("action", action).gte("created_at", one_hour_ago).execute()
                
                count = result.count or 0
                
                if count > 5:  # More than 5 security events in an hour
                    severity = AlertSeverity.CRITICAL if action == "unauthorized_access" else AlertSeverity.HIGH
                    
                    alerts.append(Alert(
                        alert_type=AlertType.SECURITY_INCIDENT,
                        severity=severity,
                        message=f"Security incident detected: {count} {action} events in the last hour",
                        details={"action": action, "count": count, "period": "1 hour"},
                        timestamp=datetime.utcnow()
                    ))
        except Exception as e:
            logger.error(f"Security incident check failed: {e}")
    
    def _add_alert(self, alert: Alert):
        """Add alert to active alerts if not already present."""
        # Check if similar alert already exists
        existing_alert = next(
            (a for a in self.active_alerts 
             if a.alert_type == alert.alert_type and not a.resolved),
            None
        )
        
        if not existing_alert:
            self.active_alerts.append(alert)
            self.alert_history.append(alert)
            logger.warning(f"Alert raised: {alert.severity.value} - {alert.message}")
    
    async def resolve_alert(self, alert_type: AlertType, details: Optional[Dict] = None):
        """Resolve an active alert."""
        for alert in self.active_alerts:
            if alert.alert_type == alert_type and not alert.resolved:
                alert.resolved = True
                alert.resolved_at = datetime.utcnow()
                logger.info(f"Alert resolved: {alert_type.value}")
                break
    
    def get_active_alerts(self, severity: Optional[AlertSeverity] = None) -> List[Alert]:
        """Get active alerts, optionally filtered by severity."""
        alerts = [a for a in self.active_alerts if not a.resolved]
        
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        
        return sorted(alerts, key=lambda x: x.timestamp, reverse=True)
    
    def get_alert_summary(self) -> Dict[str, Any]:
        """Get summary of alerts."""
        active_alerts = self.get_active_alerts()
        
        summary = {
            "active_alerts": len(active_alerts),
            "alerts_by_severity": {
                "critical": len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]),
                "high": len([a for a in active_alerts if a.severity == AlertSeverity.HIGH]),
                "medium": len([a for a in active_alerts if a.severity == AlertSeverity.MEDIUM]),
                "low": len([a for a in active_alerts if a.severity == AlertSeverity.LOW])
            },
            "alerts_by_type": {},
            "last_check": datetime.utcnow().isoformat()
        }
        
        # Count by type
        for alert in active_alerts:
            alert_type = alert.alert_type.value
            summary["alerts_by_type"][alert_type] = summary["alerts_by_type"].get(alert_type, 0) + 1
        
        return summary


class HealthChecker:
    """Periodic health checker."""
    
    def __init__(self, alert_manager: AlertManager):
        self.alert_manager = alert_manager
        self.running = False
        self.check_interval = 300  # 5 minutes
    
    async def start(self):
        """Start the health checker."""
        self.running = True
        logger.info("Health checker started")
        
        while self.running:
            try:
                await self.alert_manager.check_system_health()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Health check cycle failed: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    def stop(self):
        """Stop the health checker."""
        self.running = False
        logger.info("Health checker stopped")


# Global instances
alert_manager = AlertManager()
health_checker = HealthChecker(alert_manager)