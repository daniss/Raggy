import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.core.config import settings
from app.core.sentry_config import init_sentry
from app.api.chat import router as chat_router
from app.api.chat_stream import router as chat_stream_router
from app.api.upload import router as upload_router
from app.api.config import router as config_router
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
    logger.info("Starting RAG Consulting Platform API")
    
    # Initialize components on startup  
    try:
        logger.info("✓ Core components initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        # Don't fail startup, but log the error
    
    yield
    
    logger.info("Shutting down RAG Consulting Platform API")


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

# Include essential routers only
app.include_router(chat_router, prefix="/api/v1")
app.include_router(chat_stream_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(config_router, prefix="/api/v1")


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


# Simplified health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check for consulting platform."""
    try:
        from app.db.supabase_client import supabase_client
        
        # Check component health
        dependencies = {}
        overall_healthy = True
        
        # Check Supabase database
        try:
            result = supabase_client.table("organizations").select("id").limit(1).execute()
            dependencies["supabase"] = "connected"
        except Exception as e:
            dependencies["supabase"] = f"error: {str(e)[:50]}"
            overall_healthy = False
        
        # Check configuration system
        try:
            from app.core.client_config import get_current_client_id
            client_id = get_current_client_id()
            dependencies["client_config"] = f"loaded (client: {client_id})"
        except Exception as e:
            dependencies["client_config"] = f"error: {str(e)[:50]}"
            overall_healthy = False
        
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
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    try:
        error_response = ErrorResponse(
            error="Internal server error",
            detail="An unexpected error occurred",
            code="INTERNAL_ERROR"
        )
        
        serializable_content = jsonable_encoder(error_response.model_dump())
        
        return JSONResponse(
            status_code=500,
            content=serializable_content
        )
    except Exception as serialization_error:
        logger.error(f"Error in exception handler serialization: {serialization_error}")
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
    """HTTP exception handler."""
    try:
        error_response = ErrorResponse(
            error=exc.detail,
            code=f"HTTP_{exc.status_code}"
        )
        
        serializable_content = jsonable_encoder(error_response.model_dump())
        
        return JSONResponse(
            status_code=exc.status_code,
            content=serializable_content
        )
    except Exception as serialization_error:
        logger.error(f"Error in HTTP exception handler serialization: {serialization_error}")
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