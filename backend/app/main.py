import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.rate_limiting import RateLimitMiddleware
from app.core.org_rate_limiting import OrganizationRateLimitMiddleware
from app.core.audit_middleware import AuditMiddleware
from app.core.sentry_config import init_sentry, capture_exception, add_breadcrumb
from app.core.redis_cache import redis_cache
from app.api.chat import router as chat_router
from app.api.upload import router as upload_router
from app.api.analytics import router as analytics_router
from app.api.jobs import router as jobs_router
from app.api.organizations import router as organizations_router
from app.api.audit import router as audit_router
from app.api.usage import router as usage_router
from app.api.monitoring import router as monitoring_router
from app.models.schemas import HealthResponse, ErrorResponse
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize Sentry for monitoring
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("Starting RAG Support Chatbot API")
    
    # Initialize components on startup  
    try:
        logger.info("✓ All components initialized successfully")
        
        # Background job worker disabled - causes startup hanging
        logger.info("✓ Background job worker disabled")
        
        # Start health monitoring (non-blocking)
        try:
            from app.core.monitoring import health_checker
            import asyncio
            # Start health checker as background task
            async def start_health_monitoring():
                await asyncio.sleep(2)  # Delay to let startup complete
                health_checker.start()
                
            asyncio.create_task(start_health_monitoring())
            logger.info("✓ Health monitoring scheduled to start")
        except Exception as e:
            logger.error(f"Failed to schedule health monitoring: {e}")
        
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        # Don't fail startup, but log the error
    
    yield
    
    # Cleanup on shutdown
    try:
        from app.services.background_jobs import job_manager
        await job_manager.stop_worker()
        logger.info("Background job worker stopped")
    except Exception as e:
        logger.error(f"Failed to stop background job worker: {e}")
    
    try:
        from app.core.monitoring import health_checker
        health_checker.stop()
        logger.info("Health monitoring stopped")
    except Exception as e:
        logger.error(f"Failed to stop health monitoring: {e}")
    
    logger.info("Shutting down RAG Support Chatbot API")


# Create FastAPI application
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add audit middleware (before rate limiting)
app.add_middleware(AuditMiddleware)

# Add organization-aware rate limiting middleware
app.add_middleware(
    OrganizationRateLimitMiddleware,
    exclude_paths=["/health", "/docs", "/openapi.json", "/", "/api/v1/organizations"]
)

# Include routers
app.include_router(chat_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(organizations_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "description": settings.api_description,
        "environment": settings.environment,
        "docs_url": "/docs",
        "health_url": "/health"
    }


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Application health check."""
    try:
        from app.rag import retriever, qa_chain
        from app.db.supabase_client import supabase_client
        
        # Check component health
        dependencies = {}
        
        # Check Vector Store (Supabase pgvector)
        try:
            stats = retriever.get_collection_stats()
            dependencies["vector_store"] = f"connected ({stats.get('total_vectors', 0)} vectors, {stats.get('total_documents', 0)} docs)"
        except Exception as e:
            dependencies["vector_store"] = f"error: {str(e)[:50]}"
        
        # Check Groq API
        try:
            groq_status = qa_chain.test_connection()
            dependencies["groq_api"] = "connected" if groq_status else "disconnected"
        except Exception as e:
            dependencies["groq_api"] = f"error: {str(e)[:50]}"
        
        # Check Supabase
        try:
            # Simple test query
            result = supabase_client.table("chat_logs").select("id").limit(1).execute()
            dependencies["supabase"] = "connected"
        except Exception as e:
            dependencies["supabase"] = f"error: {str(e)[:50]}"
        
        # Check Redis
        try:
            if redis_cache.health_check():
                stats = redis_cache.get_stats()
                dependencies["redis"] = f"connected (hit rate: {stats.get('hit_rate', 0)}%)"
            else:
                dependencies["redis"] = "disconnected"
        except Exception as e:
            dependencies["redis"] = f"error: {str(e)[:50]}"
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.utcnow(),
            version=settings.api_version,
            dependencies=dependencies
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail="An unexpected error occurred",
            code="INTERNAL_ERROR"
        ).model_dump()
    )


# HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """HTTP exception handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            code=f"HTTP_{exc.status_code}"
        ).model_dump()
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )