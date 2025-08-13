"""
Security, compliance, and audit API endpoints.
Handles security incidents, DPO activities, compliance audits, and GDPR compliance.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks

from app.models.enterprise_schemas import (
    SecurityIncidentCreate, SecurityIncidentInfo, 
    ComplianceAuditCreate, ComplianceAuditInfo,
    SuccessResponse, PaginatedResponse, BulkOperationResult,
    SeverityLevel
)
from app.core.deps_enterprise import get_current_user, get_current_organization
from app.utils.permissions import check_permission, require_permission
from app.db.supabase_client import supabase_client
from app.services.email_service import send_security_alert_email, send_notification_email
from app.core.config import settings

router = APIRouter(prefix="/security", tags=["security"])
logger = logging.getLogger(__name__)

# =============================================================================
# SECURITY INCIDENT MANAGEMENT
# =============================================================================

@router.get("/incidents", response_model=PaginatedResponse)
async def get_security_incidents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    severity: Optional[SeverityLevel] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get security incidents with filtering and pagination."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build query
        query = supabase_client.table("security_incidents").select(
            "*, assigned_user:assigned_to(name, email), reporter:reported_by(name, email)",
            count="exact"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if severity:
            query = query.eq("severity", severity.value)
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("category", category)
        
        # Get total count
        count_result = query.execute()
        total = count_result.count or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        incidents_result = query.order("detected_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        # Transform data
        incidents = []
        for incident in incidents_result.data:
            incidents.append(SecurityIncidentInfo(
                id=incident["id"],
                organization_id=incident["organization_id"],
                title=incident["title"],
                description=incident.get("description"),
                severity=SeverityLevel(incident["severity"]),
                category=incident["category"],
                status=incident["status"],
                affected_users=incident.get("affected_users", 0),
                affected_documents=incident.get("affected_documents", 0),
                data_types_affected=incident.get("data_types_affected", []),
                detected_at=datetime.fromisoformat(incident["detected_at"]),
                resolved_at=datetime.fromisoformat(incident["resolved_at"]) if incident.get("resolved_at") else None,
                assigned_to=incident.get("assigned_to"),
                reported_by=incident.get("reported_by")
            ))
        
        return PaginatedResponse(
            items=incidents,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting security incidents: {e}")
        raise HTTPException(status_code=500, detail="Failed to get security incidents")

@router.post("/incidents", response_model=SuccessResponse)
async def create_security_incident(
    incident_data: SecurityIncidentCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Create a new security incident."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Create incident record
        incident_record = {
            "organization_id": current_org["id"],
            "title": incident_data.title,
            "description": incident_data.description,
            "severity": incident_data.severity.value,
            "category": incident_data.category,
            "status": "open",
            "affected_users": incident_data.affected_users,
            "affected_documents": incident_data.affected_documents,
            "data_types_affected": incident_data.data_types_affected,
            "detected_at": datetime.utcnow().isoformat(),
            "reported_by": current_user["id"]
        }
        
        result = supabase_client.table("security_incidents").insert(incident_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create incident")
        
        incident_id = result.data[0]["id"]
        
        # Send notifications for high/critical severity incidents
        if incident_data.severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL]:
            background_tasks.add_task(
                _notify_security_incident,
                current_org["id"],
                current_org["name"],
                incident_data,
                datetime.utcnow()
            )
        
        return SuccessResponse(
            message="Security incident created successfully",
            data={"incident_id": incident_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating security incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to create security incident")

@router.put("/incidents/{incident_id}", response_model=SuccessResponse)
async def update_security_incident(
    incident_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[SeverityLevel] = None,
    assigned_to: Optional[str] = None,
    resolution_notes: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Update security incident."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build update data
        update_data = {}
        if title:
            update_data["title"] = title
        if description is not None:
            update_data["description"] = description
        if status:
            update_data["status"] = status
            if status in ["resolved", "closed"]:
                update_data["resolved_at"] = datetime.utcnow().isoformat()
        if severity:
            update_data["severity"] = severity.value
        if assigned_to:
            update_data["assigned_to"] = assigned_to
        if resolution_notes:
            update_data["resolution_notes"] = resolution_notes
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Update incident
        result = supabase_client.table("security_incidents").update(
            update_data
        ).eq("id", incident_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Security incident not found")
        
        return SuccessResponse(message="Security incident updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating security incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to update security incident")

@router.get("/incidents/stats", response_model=Dict[str, Any])
async def get_incident_statistics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get security incident statistics."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get incident counts by severity
        severity_stats = supabase_client.table("security_incidents").select(
            "severity, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "detected_at", start_date.isoformat()
        ).group("severity").execute()
        
        # Get incident counts by status
        status_stats = supabase_client.table("security_incidents").select(
            "status, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "detected_at", start_date.isoformat()
        ).group("status").execute()
        
        # Get incident trends (daily)
        trends = supabase_client.table("security_incidents").select(
            "DATE(detected_at) as date, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "detected_at", start_date.isoformat()
        ).group("DATE(detected_at)").order("date").execute()
        
        # Calculate resolution time
        resolved_incidents = supabase_client.table("security_incidents").select(
            "detected_at, resolved_at"
        ).eq("organization_id", current_org["id"]).eq("status", "resolved").not_.is_(
            "resolved_at", "null"
        ).gte("detected_at", start_date.isoformat()).execute()
        
        avg_resolution_time = 0
        if resolved_incidents.data:
            total_time = 0
            for incident in resolved_incidents.data:
                detected = datetime.fromisoformat(incident["detected_at"])
                resolved = datetime.fromisoformat(incident["resolved_at"])
                total_time += (resolved - detected).total_seconds()
            avg_resolution_time = total_time / len(resolved_incidents.data) / 3600  # Convert to hours
        
        return {
            "organization_id": current_org["id"],
            "period": {"days": days, "start_date": start_date.date(), "end_date": date.today()},
            "summary": {
                "total_incidents": sum(item["count"] for item in severity_stats.data or []),
                "critical_incidents": next((item["count"] for item in severity_stats.data or [] if item["severity"] == "critical"), 0),
                "open_incidents": next((item["count"] for item in status_stats.data or [] if item["status"] == "open"), 0),
                "avg_resolution_hours": round(avg_resolution_time, 1)
            },
            "by_severity": {item["severity"]: item["count"] for item in severity_stats.data or []},
            "by_status": {item["status"]: item["count"] for item in status_stats.data or []},
            "trends": trends.data or [],
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting incident statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get incident statistics")

# =============================================================================
# COMPLIANCE AUDIT MANAGEMENT
# =============================================================================

@router.get("/audits", response_model=PaginatedResponse)
async def get_compliance_audits(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    framework: Optional[str] = Query(None, description="Filter by framework"),
    status: Optional[str] = Query(None, description="Filter by status"),
    audit_type: Optional[str] = Query(None, description="Filter by audit type"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get compliance audits with filtering and pagination."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build query
        query = supabase_client.table("compliance_audits").select(
            "*, dpo_user:dpo_assigned(name, email)",
            count="exact"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if framework:
            query = query.eq("framework", framework)
        if status:
            query = query.eq("status", status)
        if audit_type:
            query = query.eq("audit_type", audit_type)
        
        # Get total count
        count_result = query.execute()
        total = count_result.count or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        audits_result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        # Transform data
        audits = []
        for audit in audits_result.data:
            audits.append(ComplianceAuditInfo(
                id=audit["id"],
                organization_id=audit["organization_id"],
                audit_type=audit["audit_type"],
                framework=audit["framework"],
                title=audit["title"],
                description=audit.get("description"),
                scope=audit.get("scope"),
                status=audit["status"],
                planned_date=date.fromisoformat(audit["planned_date"]) if audit.get("planned_date") else None,
                started_at=datetime.fromisoformat(audit["started_at"]) if audit.get("started_at") else None,
                completed_at=datetime.fromisoformat(audit["completed_at"]) if audit.get("completed_at") else None,
                score=audit.get("score"),
                auditor_name=audit.get("auditor_name"),
                created_at=datetime.fromisoformat(audit["created_at"])
            ))
        
        return PaginatedResponse(
            items=audits,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting compliance audits: {e}")
        raise HTTPException(status_code=500, detail="Failed to get compliance audits")

@router.post("/audits", response_model=SuccessResponse)
async def create_compliance_audit(
    audit_data: ComplianceAuditCreate,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Create a new compliance audit."""
    # Check permissions (DPO or admin can create audits)
    if not await check_permission(current_user["id"], current_org["id"], "security", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Create audit record
        audit_record = {
            "organization_id": current_org["id"],
            "audit_type": audit_data.audit_type,
            "framework": audit_data.framework,
            "title": audit_data.title,
            "description": audit_data.description,
            "scope": audit_data.scope,
            "status": "planned",
            "planned_date": audit_data.planned_date.isoformat() if audit_data.planned_date else None,
            "auditor_name": audit_data.auditor_name,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase_client.table("compliance_audits").insert(audit_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create audit")
        
        audit_id = result.data[0]["id"]
        
        return SuccessResponse(
            message="Compliance audit created successfully",
            data={"audit_id": audit_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating compliance audit: {e}")
        raise HTTPException(status_code=500, detail="Failed to create compliance audit")

@router.put("/audits/{audit_id}", response_model=SuccessResponse)
async def update_compliance_audit(
    audit_id: str,
    status: Optional[str] = None,
    score: Optional[int] = None,
    findings: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Update compliance audit."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build update data
        update_data = {}
        if status:
            update_data["status"] = status
            if status == "in_progress" and not update_data.get("started_at"):
                update_data["started_at"] = datetime.utcnow().isoformat()
            elif status in ["completed", "failed"]:
                update_data["completed_at"] = datetime.utcnow().isoformat()
        
        if score is not None:
            if not (0 <= score <= 100):
                raise HTTPException(status_code=400, detail="Score must be between 0 and 100")
            update_data["score"] = score
        
        if findings is not None:
            update_data["findings"] = findings
        
        if recommendations is not None:
            update_data["recommendations"] = recommendations
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Update audit
        result = supabase_client.table("compliance_audits").update(
            update_data
        ).eq("id", audit_id).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Compliance audit not found")
        
        return SuccessResponse(message="Compliance audit updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating compliance audit: {e}")
        raise HTTPException(status_code=500, detail="Failed to update compliance audit")

# =============================================================================
# DATA PROCESSING ACTIVITIES (GDPR)
# =============================================================================

@router.get("/data-processing", response_model=PaginatedResponse)
async def get_data_processing_activities(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get data processing activities for GDPR compliance."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get data processing activities
        offset = (page - 1) * page_size
        
        result = supabase_client.table("data_processing_activities").select(
            "*, creator:created_by(name, email)",
            count="exact"
        ).eq("organization_id", current_org["id"]).order(
            "created_at", desc=True
        ).range(offset, offset + page_size - 1).execute()
        
        total = result.count or 0
        
        return PaginatedResponse(
            items=result.data or [],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting data processing activities: {e}")
        raise HTTPException(status_code=500, detail="Failed to get data processing activities")

@router.post("/data-processing", response_model=SuccessResponse)
async def create_data_processing_activity(
    name: str,
    description: str,
    purpose: str,
    legal_basis: str,
    data_categories: List[str],
    data_subjects: List[str],
    automated_processing: bool = False,
    profiling_involved: bool = False,
    retention_period_months: Optional[int] = None,
    third_parties_involved: bool = False,
    third_party_details: Optional[Dict[str, Any]] = None,
    privacy_impact_score: Optional[int] = None,
    risk_mitigation_measures: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Create a new data processing activity."""
    # Check permissions (DPO or admin)
    if not await check_permission(current_user["id"], current_org["id"], "security", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        activity_record = {
            "organization_id": current_org["id"],
            "name": name,
            "description": description,
            "purpose": purpose,
            "legal_basis": legal_basis,
            "data_categories": data_categories,
            "data_subjects": data_subjects,
            "automated_processing": automated_processing,
            "profiling_involved": profiling_involved,
            "retention_period_months": retention_period_months,
            "third_parties_involved": third_parties_involved,
            "third_party_details": third_party_details or {},
            "privacy_impact_score": privacy_impact_score,
            "risk_mitigation_measures": risk_mitigation_measures,
            "created_by": current_user["id"],
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase_client.table("data_processing_activities").insert(activity_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create data processing activity")
        
        return SuccessResponse(
            message="Data processing activity created successfully",
            data={"activity_id": result.data[0]["id"]}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating data processing activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to create data processing activity")

# =============================================================================
# COMPLIANCE REPORTING AND EXPORT
# =============================================================================

@router.get("/reports/gdpr-register", response_model=Dict[str, Any])
async def generate_gdpr_register(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Generate GDPR data processing register."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get all data processing activities
        activities = supabase_client.table("data_processing_activities").select(
            "*"
        ).eq("organization_id", current_org["id"]).order("name").execute()
        
        # Group by legal basis
        by_legal_basis = {}
        for activity in activities.data or []:
            basis = activity["legal_basis"]
            if basis not in by_legal_basis:
                by_legal_basis[basis] = []
            by_legal_basis[basis].append(activity)
        
        # Calculate risk profile
        high_risk_activities = [
            activity for activity in activities.data or []
            if activity.get("privacy_impact_score", 0) >= 7 or activity.get("profiling_involved")
        ]
        
        return {
            "organization_id": current_org["id"],
            "organization_name": current_org["name"],
            "generated_at": datetime.utcnow(),
            "summary": {
                "total_activities": len(activities.data or []),
                "high_risk_activities": len(high_risk_activities),
                "automated_processing_count": sum(1 for a in activities.data or [] if a.get("automated_processing")),
                "third_party_processing_count": sum(1 for a in activities.data or [] if a.get("third_parties_involved"))
            },
            "activities": activities.data or [],
            "by_legal_basis": by_legal_basis,
            "high_risk_activities": high_risk_activities
        }
        
    except Exception as e:
        logger.error(f"Error generating GDPR register: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate GDPR register")

@router.get("/reports/security-dashboard", response_model=Dict[str, Any])
async def get_security_dashboard(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get comprehensive security dashboard."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "security", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get security metrics
        incidents_stats = await get_incident_statistics(days, current_user, current_org)
        
        # Get recent audit results
        audits = supabase_client.table("compliance_audits").select(
            "framework, status, score, completed_at"
        ).eq("organization_id", current_org["id"]).eq("status", "completed").order(
            "completed_at", desc=True
        ).limit(10).execute()
        
        # Calculate compliance score
        recent_audits = [a for a in audits.data or [] if a.get("score")]
        avg_compliance_score = sum(a["score"] for a in recent_audits) / len(recent_audits) if recent_audits else 0
        
        # Get PII incidents
        pii_incidents = supabase_client.table("security_incidents").select(
            "COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).contains(
            "data_types_affected", ["pii"]
        ).gte("detected_at", start_date.isoformat()).execute()
        
        return {
            "organization_id": current_org["id"],
            "period": {"days": days, "start_date": start_date.date(), "end_date": date.today()},
            "security_posture": {
                "risk_level": _calculate_risk_level(incidents_stats, avg_compliance_score),
                "incidents_summary": incidents_stats["summary"],
                "compliance_score": round(avg_compliance_score, 1),
                "pii_incidents": pii_incidents.data[0]["count"] if pii_incidents.data else 0
            },
            "recent_audits": audits.data or [],
            "recommendations": _generate_security_recommendations(incidents_stats, avg_compliance_score),
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting security dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to get security dashboard")

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _notify_security_incident(
    org_id: str, 
    org_name: str, 
    incident_data: SecurityIncidentCreate,
    detected_at: datetime
):
    """Send notifications for security incidents."""
    try:
        # Get admin and DPO users
        admins = supabase_client.table("organization_members").select(
            "users!inner(email)"
        ).eq("organization_id", org_id).in_("role", ["admin", "dpo"]).eq("status", "active").execute()
        
        admin_emails = [member["users"]["email"] for member in admins.data or []]
        
        if admin_emails:
            # Send security alert emails
            for email in admin_emails:
                await send_security_alert_email(
                    email=email,
                    organization_name=org_name,
                    incident_title=incident_data.title,
                    incident_description=incident_data.description or "",
                    severity=incident_data.severity.value,
                    detected_at=detected_at,
                    affected_users=incident_data.affected_users,
                    affected_documents=incident_data.affected_documents
                )
        
    except Exception as e:
        logger.error(f"Error sending incident notifications: {e}")

def _calculate_risk_level(incidents_stats: Dict[str, Any], compliance_score: float) -> str:
    """Calculate overall security risk level."""
    critical_incidents = incidents_stats["summary"].get("critical_incidents", 0)
    open_incidents = incidents_stats["summary"].get("open_incidents", 0)
    
    # Risk scoring logic
    risk_score = 0
    
    # Critical incidents add significant risk
    risk_score += critical_incidents * 30
    
    # Open incidents add moderate risk
    risk_score += open_incidents * 10
    
    # Low compliance score increases risk
    if compliance_score > 0:
        risk_score += max(0, (80 - compliance_score))
    else:
        risk_score += 50  # No compliance data available
    
    # Classify risk level
    if risk_score >= 70:
        return "high"
    elif risk_score >= 30:
        return "medium"
    else:
        return "low"

def _generate_security_recommendations(incidents_stats: Dict[str, Any], compliance_score: float) -> List[Dict[str, str]]:
    """Generate security recommendations based on current state."""
    recommendations = []
    
    # Incident-based recommendations
    critical_incidents = incidents_stats["summary"].get("critical_incidents", 0)
    open_incidents = incidents_stats["summary"].get("open_incidents", 0)
    
    if critical_incidents > 0:
        recommendations.append({
            "priority": "critical",
            "category": "incident_response",
            "title": "Address critical security incidents",
            "description": f"You have {critical_incidents} critical security incidents that require immediate attention."
        })
    
    if open_incidents > 5:
        recommendations.append({
            "priority": "high",
            "category": "incident_management",
            "title": "Improve incident response time",
            "description": f"You have {open_incidents} open incidents. Consider improving your incident response processes."
        })
    
    # Compliance-based recommendations
    if compliance_score < 70:
        recommendations.append({
            "priority": "high",
            "category": "compliance",
            "title": "Improve compliance posture",
            "description": f"Your compliance score is {compliance_score}%. Consider conducting additional audits and addressing findings."
        })
    elif compliance_score < 85:
        recommendations.append({
            "priority": "medium",
            "category": "compliance",
            "title": "Maintain compliance efforts",
            "description": "Continue your compliance improvement efforts to achieve and maintain high scores."
        })
    
    # General recommendations if no specific issues
    if not recommendations:
        recommendations.append({
            "priority": "low",
            "category": "continuous_improvement",
            "title": "Maintain current security posture",
            "description": "Your security posture is good. Continue monitoring and regular assessments."
        })
    
    return recommendations