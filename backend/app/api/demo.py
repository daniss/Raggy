"""Demo registration and management API endpoints."""

import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel, EmailStr, validator
from app.db.supabase_client import get_supabase_client
from app.core.sentry_config import capture_exception, add_breadcrumb
from app.services.audit_logger import audit_logger
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoRegistrationRequest(BaseModel):
    email: EmailStr
    company_name: str
    source: Optional[str] = "landing"
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    
    @validator('company_name')
    def validate_company_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Company name must be at least 2 characters')
        return v.strip()
    
    @validator('email')
    def validate_email_domain(cls, v):
        # Basic business email validation (exclude common personal domains)
        personal_domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com']
        domain = v.split('@')[1].lower() if '@' in v else ''
        
        # Allow personal domains for demo purposes, but log for analytics
        if domain in personal_domains:
            logger.info(f"Personal email domain used for demo: {domain}")
        
        return v


class DemoRegistrationResponse(BaseModel):
    success: bool
    session_token: str
    expires_at: datetime
    message: str
    demo_documents: list
    sample_questions: list


class DemoActivityRequest(BaseModel):
    session_token: str
    interaction_type: str = "page_view"
    interaction_data: Optional[Dict[str, Any]] = {}


class DemoConversionRequest(BaseModel):
    session_token: str
    conversion_type: str = "quote_request"
    additional_data: Optional[Dict[str, Any]] = {}


async def get_demo_documents():
    """Get list of demo documents available."""
    return [
        {
            "name": "Guide_Conformite_RGPD.pdf",
            "size": "2.3 MB",
            "type": "Juridique",
            "description": "Guide complet de conformité RGPD pour entreprises"
        },
        {
            "name": "Manuel_Procedures_RH_2024.pdf", 
            "size": "1.8 MB",
            "type": "RH",
            "description": "Manuel des procédures ressources humaines 2024"
        },
        {
            "name": "Contrat_Type_Client.docx",
            "size": "156 KB", 
            "type": "Commercial",
            "description": "Modèle de contrat client standard"
        },
        {
            "name": "Analyse_Fiscale_2024.xlsx",
            "size": "789 KB",
            "type": "Finance", 
            "description": "Analyse fiscale et optimisation 2024"
        },
        {
            "name": "Documentation_Technique_Produit.pdf",
            "size": "4.2 MB",
            "type": "Technique",
            "description": "Documentation technique complète produit"
        }
    ]


async def get_sample_questions():
    """Get list of sample questions for demo."""
    return [
        "Quelles sont les obligations RGPD pour le traitement des données clients ?",
        "Quelle est la procédure de recrutement d'un nouveau collaborateur ?", 
        "Quels sont les délais de paiement dans nos contrats types ?",
        "Comment calculer le crédit d'impôt recherche ?",
        "Quelles sont les spécifications techniques de notre produit principal ?"
    ]


@router.post("/register", response_model=DemoRegistrationResponse)
async def register_demo(
    request: DemoRegistrationRequest,
    http_request: Request,
    background_tasks: BackgroundTasks
):
    """Register a new demo session."""
    
    try:
        add_breadcrumb(
            message="Demo registration request",
            category="demo",
            data={
                "email": request.email,
                "company": request.company_name,
                "source": request.source
            }
        )
        
        # Generate unique session token
        session_token = f"demo_{datetime.now().strftime('%Y%m%d')}_{secrets.token_urlsafe(16)}"
        
        # Set expiration to 24 hours from now
        expires_at = datetime.now() + timedelta(hours=24)
        
        # Get client info
        ip_address = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent", "")
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Check for existing active demo for this email
        existing_result = supabase.table("demo_signups").select("*").eq(
            "email", request.email
        ).eq("status", "active").execute()
        
        if existing_result.data:
            existing_demo = existing_result.data[0]
            # If demo is not expired, return existing session
            if datetime.fromisoformat(existing_demo["expires_at"].replace('Z', '+00:00')) > datetime.now():
                logger.info(f"Returning existing demo session for {request.email}")
                
                return DemoRegistrationResponse(
                    success=True,
                    session_token=existing_demo["session_token"],
                    expires_at=datetime.fromisoformat(existing_demo["expires_at"].replace('Z', '+00:00')),
                    message="Session de démo existante réactivée",
                    demo_documents=await get_demo_documents(),
                    sample_questions=await get_sample_questions()
                )
        
        # Create new demo registration
        demo_data = {
            "email": request.email,
            "company_name": request.company_name,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "source": request.source,
            "utm_source": request.utm_source,
            "utm_medium": request.utm_medium,
            "utm_campaign": request.utm_campaign,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "active"
        }
        
        result = supabase.table("demo_signups").insert(demo_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create demo session")
        
        # Log successful registration
        background_tasks.add_task(
            audit_logger.log_event,
            event_type="demo_registration",
            event_data={
                "email": request.email,
                "company": request.company_name,
                "session_token": session_token,
                "source": request.source
            },
            user_id=None,  # Anonymous
            organization_id=None
        )
        
        logger.info(f"Demo registration successful for {request.email} at {request.company_name}")
        
        return DemoRegistrationResponse(
            success=True,
            session_token=session_token,
            expires_at=expires_at,
            message="Session de démo créée avec succès",
            demo_documents=await get_demo_documents(),
            sample_questions=await get_sample_questions()
        )
        
    except Exception as e:
        logger.error(f"Demo registration failed: {e}")
        capture_exception(e)
        
        # Return generic error message for security
        raise HTTPException(
            status_code=500,
            detail="Une erreur est survenue lors de la création de votre session de démo"
        )


@router.post("/activity")
async def track_demo_activity(
    request: DemoActivityRequest,
    background_tasks: BackgroundTasks
):
    """Track demo user activity."""
    
    try:
        supabase = get_supabase_client()
        
        # Use the database function to update activity
        result = supabase.rpc(
            "update_demo_activity",
            {
                "p_session_token": request.session_token,
                "p_interaction_type": request.interaction_type,
                "p_interaction_data": request.interaction_data or {}
            }
        ).execute()
        
        if result.data:
            logger.debug(f"Activity tracked for session {request.session_token}: {request.interaction_type}")
            return {"success": True, "message": "Activity tracked"}
        else:
            # Session not found or expired
            return {"success": False, "message": "Session not found or expired"}
            
    except Exception as e:
        logger.error(f"Activity tracking failed: {e}")
        capture_exception(e)
        return {"success": False, "message": "Failed to track activity"}


@router.post("/convert")
async def convert_demo(
    request: DemoConversionRequest,
    background_tasks: BackgroundTasks
):
    """Mark demo as converted (user requested quote/contact)."""
    
    try:
        supabase = get_supabase_client()
        
        # Use the database function to convert demo
        result = supabase.rpc(
            "convert_demo_signup",
            {
                "p_session_token": request.session_token,
                "p_conversion_type": request.conversion_type
            }
        ).execute()
        
        if result.data:
            # Log conversion for analytics
            background_tasks.add_task(
                audit_logger.log_event,
                event_type="demo_conversion",
                event_data={
                    "session_token": request.session_token,
                    "conversion_type": request.conversion_type,
                    "additional_data": request.additional_data
                },
                user_id=None,
                organization_id=None
            )
            
            logger.info(f"Demo converted: {request.session_token} -> {request.conversion_type}")
            return {"success": True, "message": "Demo converted successfully"}
        else:
            return {"success": False, "message": "Session not found or already converted"}
            
    except Exception as e:
        logger.error(f"Demo conversion failed: {e}")
        capture_exception(e)
        return {"success": False, "message": "Failed to convert demo"}


@router.get("/session/{session_token}")
async def get_demo_session(session_token: str):
    """Get demo session information."""
    
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("demo_signups").select("*").eq(
            "session_token", session_token
        ).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Demo session not found")
        
        demo = result.data
        
        # Check if session is expired
        expires_at = datetime.fromisoformat(demo["expires_at"].replace('Z', '+00:00'))
        if expires_at <= datetime.now() and demo["status"] == "active":
            # Mark as expired
            supabase.table("demo_signups").update({
                "status": "expired"
            }).eq("session_token", session_token).execute()
            
            return {
                "success": False,
                "message": "Demo session has expired",
                "expired": True
            }
        
        return {
            "success": True,
            "session": {
                "email": demo["email"],
                "company_name": demo["company_name"],
                "created_at": demo["created_at"],
                "expires_at": demo["expires_at"],
                "status": demo["status"],
                "questions_asked": demo["questions_asked"],
                "documents_uploaded": demo["documents_uploaded"],
                "total_interactions": demo["total_interactions"]
            },
            "demo_documents": await get_demo_documents(),
            "sample_questions": await get_sample_questions()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get demo session: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to retrieve demo session")


@router.delete("/cleanup")
async def cleanup_expired_demos():
    """Cleanup expired demo sessions (admin endpoint)."""
    
    try:
        supabase = get_supabase_client()
        
        # Use database function to cleanup
        result = supabase.rpc("cleanup_expired_demo_signups").execute()
        
        deleted_count = result.data if result.data else 0
        
        logger.info(f"Cleaned up {deleted_count} expired demo sessions")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} expired demo sessions"
        }
        
    except Exception as e:
        logger.error(f"Demo cleanup failed: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to cleanup demos")


@router.get("/analytics")
async def get_demo_analytics():
    """Get demo analytics (admin endpoint)."""
    
    try:
        supabase = get_supabase_client()
        
        # Get analytics from the view
        result = supabase.table("demo_analytics").select("*").limit(30).execute()
        
        analytics_data = result.data if result.data else []
        
        # Get summary stats
        summary_result = supabase.table("demo_signups").select(
            "status,created_at,questions_asked,total_interactions,conversion_type"
        ).execute()
        
        summary_data = summary_result.data if summary_result.data else []
        
        # Calculate summary metrics
        total_signups = len(summary_data)
        total_conversions = len([d for d in summary_data if d["status"] == "converted"])
        active_demos = len([d for d in summary_data if d["status"] == "active"])
        
        conversion_rate = (total_conversions / total_signups * 100) if total_signups > 0 else 0
        avg_questions = sum(d["questions_asked"] or 0 for d in summary_data) / total_signups if total_signups > 0 else 0
        avg_interactions = sum(d["total_interactions"] or 0 for d in summary_data) / total_signups if total_signups > 0 else 0
        
        return {
            "success": True,
            "summary": {
                "total_signups": total_signups,
                "total_conversions": total_conversions,
                "active_demos": active_demos,
                "conversion_rate": round(conversion_rate, 2),
                "avg_questions_per_demo": round(avg_questions, 1),
                "avg_interactions_per_demo": round(avg_interactions, 1)
            },
            "daily_analytics": analytics_data
        }
        
    except Exception as e:
        logger.error(f"Failed to get demo analytics: {e}")
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")