import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.core.config import settings
# Simplified - removed multi-tenant middleware and rate limiting (handled by nginx)
from app.core.sentry_config import init_sentry, capture_exception, add_breadcrumb
from app.core.redis_cache import redis_cache
from app.api.chat import router as chat_router
from app.api.chat_stream import router as chat_stream_router
from app.api.upload import router as upload_router
from app.api.system_health import router as system_health_router
from app.api.demo import router as demo_router
from app.api.demo_health import router as demo_health_router
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
        
        # Start background job worker in a non-blocking way
        try:
            from app.services.background_jobs import job_manager
            import asyncio
            
            async def start_background_worker():
                await asyncio.sleep(1)  # Let the app startup complete
                await job_manager.start_worker()
            
            asyncio.create_task(start_background_worker())
            logger.info("✓ Background job worker scheduled to start")
        except Exception as e:
            logger.error(f"Failed to schedule background job worker: {e}")
        
        # Health monitoring removed - simplified deployment
        
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
    
    # Simplified shutdown
    
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

# Simplified middleware - basic rate limiting only
# Rate limiting handled by nginx/reverse proxy in production

# Include routers
app.include_router(chat_router, prefix="/api/v1")
app.include_router(chat_stream_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(system_health_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")
app.include_router(demo_health_router, prefix="/api/v1")


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
    """Application health check with enhanced monitoring."""
    try:
        from app.rag import retriever, qa_chain
        from app.db.supabase_client import supabase_client
        
        # Check component health
        dependencies = {}
        overall_healthy = True
        
        # Check Vector Store (Supabase pgvector)
        try:
            stats = retriever.get_collection_stats()
            dependencies["vector_store"] = f"connected ({stats.get('total_vectors', 0)} vectors, {stats.get('total_documents', 0)} docs)"
        except Exception as e:
            dependencies["vector_store"] = f"error: {str(e)[:50]}"
            overall_healthy = False
        
        # Check Groq API
        try:
            groq_status = qa_chain.test_connection()
            dependencies["groq_api"] = "connected" if groq_status else "disconnected"
            
            if not groq_status:
                overall_healthy = False
        except Exception as e:
            dependencies["groq_api"] = f"error: {str(e)[:50]}"
            overall_healthy = False
        
        # Check Supabase
        try:
            result = supabase_client.table("chat_logs").select("id").limit(1).execute()
            dependencies["supabase"] = "connected"
        except Exception as e:
            dependencies["supabase"] = f"error: {str(e)[:50]}"
            overall_healthy = False
        
        # Check Redis (optional)
        try:
            if redis_cache.health_check():
                stats = redis_cache.get_stats()
                dependencies["redis"] = f"connected (hit rate: {stats.get('hit_rate', 0)}%)"
            else:
                dependencies["redis"] = "disconnected (optional)"
        except Exception as e:
            dependencies["redis"] = "not configured (optional)"
        
        # Simplified system status
        dependencies["deployment_mode"] = "single-client"
        dependencies["version"] = settings.api_version
        
        status = "healthy" if overall_healthy else "degraded"
        
        return HealthResponse(
            status=status,
            timestamp=datetime.utcnow(),
            services=dependencies
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler with datetime serialization support."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    try:
        error_response = ErrorResponse(
            error="Internal server error",
            detail="An unexpected error occurred",
            code="INTERNAL_ERROR"
        )
        
        # Use jsonable_encoder to handle datetime and other complex objects
        serializable_content = jsonable_encoder(error_response.model_dump())
        
        return JSONResponse(
            status_code=500,
            content=serializable_content
        )
    except Exception as serialization_error:
        logger.error(f"Error in exception handler serialization: {serialization_error}")
        # Fallback to basic error response
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": "An unexpected error occurred",
                "code": "INTERNAL_ERROR",
                "timestamp": datetime.now().isoformat()
            }
        )


# HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP exception handler with datetime serialization support."""
    try:
        error_response = ErrorResponse(
            error=exc.detail,
            code=f"HTTP_{exc.status_code}"
        )
        
        # Use jsonable_encoder to handle datetime and other complex objects
        serializable_content = jsonable_encoder(error_response.model_dump())
        
        return JSONResponse(
            status_code=exc.status_code,
            content=serializable_content
        )
    except Exception as serialization_error:
        logger.error(f"Error in HTTP exception handler serialization: {serialization_error}")
        # Fallback to basic error response
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": str(exc.detail),
                "code": f"HTTP_{exc.status_code}",
                "timestamp": datetime.now().isoformat()
            }
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