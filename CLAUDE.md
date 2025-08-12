# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Raggy is a **single-client RAG (Retrieval-Augmented Generation) consulting platform** for French companies, particularly SMEs. Originally designed as a multi-tenant SaaS, it has been transformed into a **premium consulting deployment model** (€15,000 per client) with complete infrastructure sovereignty. Each client receives a fully customized, brandable RAG assistant with their own dedicated infrastructure.

**Current Architecture**: Single-client deployment with demo sandbox capabilities for prospect evaluation.

## Tech Stack

### Backend (FastAPI + Python 3.11+)
- **Framework**: FastAPI 0.116.0+ with async/await patterns
- **AI/ML**: LangChain 0.3.27+, Groq API (deepseek-r1-distill-llama-70b), Sentence Transformers 3.3.0+
- **Database**: Supabase (PostgreSQL + pgvector) or local PostgreSQL with vector extension
- **Auth**: Supabase Auth with JWT (for multi-user deployments) or simplified demo auth
- **Caching**: Redis 5.0+ for job queues and performance optimization
- **Monitoring**: Sentry for error tracking and performance monitoring
- **Document Processing**: PyMuPDF 1.26+, unstructured 0.16+, openpyxl 3.1+ for various file formats

### Frontend (Next.js 14 + TypeScript)
- **Framework**: Next.js 14.2.31 with App Router
- **UI**: shadcn/ui components + Tailwind CSS 3.4+ with Radix UI primitives
- **Auth**: Supabase Auth integration with SSR support (@supabase/ssr 0.6.1)
- **State**: React hooks + SWR 2.2.4 for data fetching
- **Styling**: Framer Motion 10.18 for animations, Lucide React 0.303 for icons
- **Markdown**: react-markdown 10.1 with remark-gfm for rich text rendering

## Key Commands

### Docker Commands (Recommended)
```bash
# Start all services (development)
make docker-up
# or
docker-compose up -d

# Start production services
make docker-up-prod
# or  
docker-compose -f docker-compose.prod.yml up -d

# View service logs
make docker-logs
# or
docker-compose logs -f

# Stop all services
make docker-down
# or
docker-compose down

# Rebuild Docker images
make docker-build
# or
docker-compose build
```

### Backend Development
```bash
cd backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# or with make
make install-backend-dev

# Run tests
pytest tests/ -v --cov=app
# or comprehensive tests
python run_tests.py
# or with make
make test-backend
make test-coverage  # with HTML coverage report

# Linting and formatting
black app --line-length=120
flake8 app --max-line-length=120 --extend-ignore=E203,W503
mypy app --ignore-missing-imports
# or with make
make format
make lint
make type-check
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install
# or with make
make install-frontend

# Run development server
npm run dev
# Access at: http://localhost:3000

# Build for production
npm run build
npm start

# Type checking and linting
npm run type-check
npm run lint
# or with make
make test-frontend
```

## Architecture & Code Organization

### Single-Client Deployment Model
Raggy has been transformed from multi-tenant SaaS to single-client consulting deployments:
- **Each client gets their own dedicated infrastructure** (complete isolation)
- **Demo mode**: Single demo organization (`demo-org-12345`) for prospect evaluation
- **Client deployments**: Fully customized with client branding and configuration
- **Session-based demo**: 24-hour temporary sessions for prospects
- **Simplified authentication**: Optional Supabase Auth or demo-friendly simplified auth

### Backend Structure
```
backend/
├── app/
│   ├── api/                    # API endpoints
│   │   ├── chat.py            # Chat interface (non-streaming)
│   │   ├── chat_stream.py     # Streaming chat responses  
│   │   ├── upload.py          # Document upload and processing
│   │   ├── demo.py            # Demo sandbox endpoints
│   │   ├── demo_health.py     # Demo health checks
│   │   └── system_health.py   # System health monitoring
│   ├── core/                  # Core configuration and utilities
│   │   ├── config.py          # Settings and environment variables
│   │   ├── deps.py            # Dependency injection
│   │   ├── redis_cache.py     # Redis caching layer
│   │   ├── sentry_config.py   # Error monitoring setup
│   │   └── validation.py      # Input validation schemas
│   ├── rag/                   # RAG pipeline components
│   │   ├── embedder.py        # Text embeddings (local/remote)
│   │   ├── loader.py          # Document processing (PDF, CSV, TXT, DOCX)
│   │   ├── splitter.py        # Text chunking strategies
│   │   ├── adaptive_splitter.py # Dynamic chunking based on content
│   │   ├── retriever.py       # Basic vector similarity search
│   │   ├── hybrid_retriever.py # Dense + sparse (BM25) search
│   │   ├── enhanced_retriever.py # Advanced retrieval with reranking
│   │   ├── reranker.py        # Cross-encoder relevance reranking
│   │   ├── qa.py              # QA chain with Groq integration
│   │   └── prompts.py         # System prompts and templates
│   ├── db/                    # Database layer
│   │   └── supabase_client.py # Supabase connection and queries
│   ├── services/              # Background services
│   │   ├── background_jobs.py # Redis-based job processing
│   │   ├── task_handlers.py   # Async document processing
│   │   └── audit_logger.py    # Activity logging
│   ├── models/                # Data models and schemas
│   │   └── schemas.py         # Pydantic response/request models
│   └── main.py               # FastAPI application setup
├── migrations/               # Database migrations
├── tests/                   # Test suites
├── scripts/                 # Utility scripts
└── requirements.txt         # Python dependencies
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # French landing page with pricing
│   │   ├── layout.tsx         # Root layout with metadata
│   │   ├── demo/              # Demo sandbox interface
│   │   │   ├── page.tsx       # Demo landing and file upload
│   │   │   ├── upload/        # Document upload interface
│   │   │   └── health/        # Demo health endpoint
│   │   ├── demo-assistant/    # Demo chat interface
│   │   │   └── page.tsx       # Chat UI with streaming
│   │   └── health/            # Frontend health check
│   ├── components/            # Reusable React components
│   │   ├── ui/               # shadcn/ui components (Button, Input, etc.)
│   │   ├── LoadingSpinner.tsx # Loading states
│   │   ├── ErrorBoundary.tsx  # Error handling
│   │   ├── Pricing.tsx        # Pricing display component
│   │   ├── Compliance.tsx     # GDPR compliance info
│   │   └── DocumentPreview.tsx # File preview component
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx    # Authentication state management
│   ├── hooks/                 # Custom React hooks
│   │   └── useRetry.ts        # Retry logic for failed requests
│   ├── utils/                 # Utility functions
│   │   ├── api.ts            # API client with typed endpoints
│   │   ├── supabase.ts       # Supabase client setup
│   │   └── supabase-server.ts # Server-side Supabase
│   ├── types/                 # TypeScript definitions
│   │   └── supabase.ts        # Database type definitions
│   ├── styles/               # Global styles
│   │   └── globals.css        # Tailwind CSS imports
│   └── lib/                   # Utility libraries
│       └── utils.ts           # Common utility functions
├── public/                    # Static assets
│   ├── og/                   # Open Graph images
│   └── docs/                 # Static documentation
└── package.json              # Node.js dependencies
```

### RAG Pipeline Flow
1. **Document Upload**: PDF/CSV/TXT → Load → Split into chunks → Generate embeddings → Store in pgvector
2. **Query Processing**: User question → Query Enhancement → Hybrid Search (Dense + BM25) → Reranking → Generate answer with Groq
3. **Background Processing**: Async document processing via Redis job queue for scalability

### Advanced RAG Features
- **Hybrid Search**: Dense vector search (70%) + Sparse BM25 retrieval (30%)
- **Cross-encoder Reranking**: Improved relevance scoring with cross-attention models
- **Query Enhancement**: Multiple query variations for better retrieval coverage
- **Adaptive Chunking**: Dynamic chunk sizes (400-800 tokens) based on document type
- **HNSW Vector Index**: 5-10x faster similarity search with graph-based indexing

### Key API Endpoints

**Current Active Endpoints (Single-Client Model)**:
- `/api/v1/chat`: Non-streaming chat responses
- `/api/v1/chat/stream`: Server-sent events streaming chat
- `/api/v1/upload`: Document upload with async processing
- `/api/v1/demo/upload`: Demo-specific upload with session management  
- `/api/v1/demo/chat`: Demo chat with temporary sessions
- `/api/v1/demo/health`: Demo system health check
- `/api/v1/system/health`: Comprehensive system health monitoring
- `/health`: Basic application health check
- `/`: API information and metadata

**Archived Endpoints (Multi-tenant features moved to `/archive/`)**:
- `/api/v1/organizations/*`: Organization management (multi-tenant)
- `/api/v1/analytics/*`: Advanced analytics and dashboards
- `/api/v1/admin/*`: Administrative interfaces
- `/api/v1/audit/*`: Audit logging and compliance

## Important Considerations

### Security
- Always check `organization_id` in all queries
- Use Supabase RLS policies for database-level security
- Validate JWT tokens on all protected endpoints
- Never expose service keys or API keys

### Performance
- Use streaming for chat responses
- Implement proper caching strategies
- Batch document processing operations
- Monitor rate limits per organization

### Database Migrations

Current migration files in `backend/migrations/`:
```bash
# Core schema
backend/database_schema.sql              # Base schema for single-client
backend/database_schema_simple.sql       # Simplified schema

# Migration files (apply in order):
migrations/002_enhance_document_schema.sql    # Enhanced document metadata
migrations/002_optimize_vector_index.sql     # HNSW vector index optimization  
migrations/003_add_conversation_id.sql       # Conversation threading support
migrations/003_demo_signups.sql              # Demo session management
migrations/004_fix_demo_sessions_conflict.sql # Demo session conflict resolution
```

**Apply migrations**:
```bash
# Via Supabase dashboard SQL editor
# OR using make commands:
make db-setup    # Initialize database with extensions
make db-migrate  # Apply pending migrations (when implemented)

# For local PostgreSQL:
docker-compose exec postgres psql -U postgres -d raggy_db -f /path/to/migration.sql
```

### Environment Variables

**Critical variables that must be set**:
- `GROQ_API_KEY`: Groq API key for LLM inference (deepseek-r1-distill-llama-70b)
- `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: Database connection
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Frontend auth
- `DATABASE_URL`: PostgreSQL connection string (optional, for migrations)
- `REDIS_URL`: Redis connection for job queues (defaults to redis://redis:6379/0)

**Application Configuration**:
- `ENVIRONMENT`: deployment environment (development/demo/production)
- `DEBUG`: enable debug logging (true/false)
- `CLIENT_NAME`: client organization name for branding
- `CLIENT_SLUG`: URL-friendly client identifier

**RAG Configuration (Performance-Optimized Defaults)**:
- `EMBEDDING_MODEL`: `dangvantuan/sentence-camembert-base` (French-optimized, 384 dimensions)
- `FAST_MODE`: `true` (enable optimized performance mode)
- `USE_HYBRID_SEARCH`: `true` (dense vector + BM25 sparse search)
- `USE_RERANKING`: `false` (disabled by default for speed)
- `USE_QUERY_ENHANCEMENT`: `false` (disabled by default for speed)
- `MAX_CONTEXT_DOCS`: `5` (limit context documents for faster responses)
- `CHUNK_SIZE`: `800` tokens (optimized chunk size)
- `CHUNK_OVERLAP`: `100` tokens

**Demo Configuration**:
- `DEMO_ORG_ID`: `demo-org-12345` (fixed demo organization)
- `MAX_DEMO_DOCUMENTS`: `100` (document limit for demo)
- `DEMO_SESSION_EXPIRE_HOURS`: `24` (demo session duration)

**See `/home/danis/code/Raggy/.env.example` for complete configuration reference**

## Common Development Tasks

### Adding a New API Endpoint
1. Create router in `backend/app/api/`
2. Add dependency injection for organization context
3. Include router in `main.py`
4. Add frontend API client in `frontend/src/utils/api.ts`

### Working with RAG Components
- Retriever: `app/rag/supabase_retriever.py` - handles vector similarity search
- QA Chain: `app/rag/qa.py` - manages Groq API interactions
- Document Loader: `app/rag/loader.py` - processes various file formats

### Testing Framework

**Available Test Suites**:
```bash
# All tests
make test

# Backend tests with coverage
make test-coverage  # Generates htmlcov/index.html report

# Specific test suites
make test-demo      # Demo flow and session management
make test-integration # Integration tests
make test-purge     # Data purge functionality

# Direct pytest commands
cd backend
pytest tests/test_demo_flow.py -v          # Demo-specific tests
pytest tests/test_rag.py -v                # RAG pipeline tests
pytest tests/test_multi_tenancy.py -v      # Legacy multi-tenant tests
python run_tests.py                        # Custom test runner
```

**Test Files**:
- `tests/test_demo_flow.py`: Demo sandbox functionality
- `tests/test_rag.py`: RAG pipeline and document processing
- `tests/test_purge.py`: Data cleanup and session management
- `tests/test_multi_tenancy.py`: Legacy multi-tenant validation
- `tests/conftest.py`: Shared test fixtures and configuration

## Background Job System

### Job Processing Architecture
- **Redis-based Queue**: Non-blocking job processing with `zpopmin`
- **Async Workers**: Background job workers run alongside FastAPI server
- **Document Processing**: Large file uploads processed asynchronously
- **Startup Safety**: Workers start after app initialization to prevent blocking

### Job Management
```python
# Enqueue background job
from app.services.background_jobs import enqueue_document_processing

job_id = await enqueue_document_processing(
    filename="document.pdf",
    content=file_content,
    content_type="application/pdf",
    org_id=organization_id,
    user_id=user_id
)
```

## Database Schema & Migrations

### Current Schema (Single-Client + Demo)

**Core Tables** (from `backend/database_schema.sql`):
- `users`: User accounts (Supabase Auth integration)
- `documents`: Uploaded documents with processing status and metadata
- `chat_conversations`: Conversation threads for context continuity
- `chat_messages`: Individual messages within conversations
- `chat_logs`: Analytics and logging (with `conversation_id` support)
- `system_settings`: Application configuration storage
- `analytics_daily`: Daily usage statistics aggregation

**Vector Storage** (pgvector extension):
- Vector embeddings stored directly in document processing pipeline
- HNSW indexing for optimized similarity search performance
- 384-dimensional vectors (dangvantuan/sentence-camembert-base)

**Demo Extensions**:
- Session-based temporary data for demo prospects
- 24-hour auto-cleanup for demo sessions
- Demo organization (`demo-org-12345`) for all prospects

### Vector Search Optimization
```sql
-- HNSW index for 5-10x performance improvement
CREATE INDEX idx_document_vectors_embedding_hnsw 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

### Organization-Scoped Functions
- `search_similar_documents_org()`: Vector search within organization
- `get_organization_counts()`: Member and document counts
- `delete_document_vectors()`: Cleanup on document deletion

## Deployment & Scaling

### Client Deployment Model
- **Single-client infrastructure**: Complete isolation per client
- **Consulting engagement**: €15,000 per deployment
- **Custom branding**: Client logo, colors, and domain
- **Document limits**: Configurable per client (default 1,000 documents)
- **Performance optimization**: Fast mode enabled by default

### Demo Sandbox
- **Shared demo organization**: `demo-org-12345`
- **Session-based**: 24-hour temporary sessions
- **Document limit**: 100 documents for demo
- **Auto-cleanup**: Automatic purge of expired demo data

### Production Features
- **Docker orchestration**: Production-ready with docker-compose.prod.yml
- **Health monitoring**: Comprehensive health checks for all services
- **Background processing**: Redis-based job queue for document processing
- **Error tracking**: Sentry integration for monitoring and alerts
- **Performance**: HNSW vector indexing, Redis caching, optimized RAG pipeline

## Development Workflow & Tools

### Makefile Commands (Recommended)

The project includes a comprehensive Makefile for development efficiency:

```bash
# Development environment
make dev          # Start all services and show access URLs
make restart      # Restart all services
make stop         # Stop all services
make logs         # View live service logs

# Installation
make install      # Install all dependencies
make install-dev  # Install with development dependencies

# Testing
make test            # Run all tests
make test-coverage   # Generate HTML coverage report
make test-integration # Run integration tests only
make test-demo       # Test demo functionality
make check           # Quick quality check (lint + type + test)

# Code quality
make format       # Format Python code with Black
make lint         # Run flake8 linting
make type-check   # Run mypy type checking

# Database operations
make db-setup     # Initialize database with extensions
make db-reset     # Reset database (⚠️ destructive)
make backup       # Create database backup
make restore FILE=backup.sql # Restore from backup

# Demo management  
make load-demo    # Load demo corpus documents
make purge-demo   # Clean demo data
make demo-stats   # Show demo statistics

# Monitoring
make health-check # Check all service health
make clean        # Clean temporary files
make security     # Run security scans
```

### Architecture Patterns

**RAG Pipeline Architecture**:
1. **Document Ingestion**: Multi-format support (PDF, DOCX, CSV, TXT)
2. **Chunking Strategy**: Adaptive chunking with semantic awareness
3. **Embeddings**: French-optimized sentence-camembert-base (384D)
4. **Storage**: PostgreSQL with pgvector HNSW indexing
5. **Retrieval**: Hybrid search (dense vector 70% + BM25 sparse 30%)
6. **Generation**: Groq API with deepseek-r1-distill-llama-70b
7. **Streaming**: Server-sent events for real-time responses

**Performance Optimizations**:
- **Fast Mode**: Reduced reranking and query enhancement for speed
- **Context Limiting**: Maximum 5 documents per query
- **HNSW Indexing**: 5-10x faster vector search
- **Redis Caching**: Query and embedding caching
- **Background Jobs**: Async document processing with Redis queues

### Common Development Scenarios

**Adding a New Document Type**:
1. Update `app/rag/loader.py` with new file handler
2. Add MIME type support in `app/api/upload.py`
3. Test with `tests/test_rag.py`

**Modifying RAG Behavior**:
1. Adjust prompts in `app/rag/prompts.py`
2. Configure retrieval in `app/core/config.py`
3. Test changes with demo interface

**Client Customization**:
1. Update environment variables in `.env`
2. Replace branding assets in `frontend/public/`
3. Modify landing page in `frontend/src/app/page.tsx`

**Deployment to Client**:
1. Use `scripts/setup_client.sh` for infrastructure setup
2. Configure environment with client-specific values
3. Deploy with `docker-compose -f docker-compose.prod.yml up -d`
4. Load client documents and train staff

### Troubleshooting

**Common Issues**:

1. **Import errors in Python**: Ensure virtual environment is activated and dependencies are installed
```bash
cd backend && source venv/bin/activate && pip install -r requirements.txt
```

2. **Vector search performance**: Check HNSW index exists
```sql
-- In Supabase SQL editor
SELECT indexname FROM pg_indexes WHERE tablename = 'document_vectors';
```

3. **Demo session conflicts**: Run demo cleanup
```bash
make purge-demo
```

4. **Redis connection issues**: Check Redis service health
```bash
docker-compose logs redis
make health-check
```

5. **Groq API errors**: Verify API key and model availability
- Check `GROQ_API_KEY` in environment
- Monitor rate limits and quotas

**Debug Mode**:
```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=DEBUG

# Run with verbose logging
uvicorn app.main:app --reload --log-level debug
```

### Project History & Context

**Architectural Evolution**:
- **Phase 1** (2024): Multi-tenant SaaS platform with complex organization management
- **Phase 2** (Jan 2025): Transformation to single-client consulting model
- **Current**: Streamlined deployment focused on premium consulting engagements

**Key Design Decisions**:
- **Single-client model**: Higher margins, complete data sovereignty
- **Demo sandbox**: 24h temporary sessions for prospect evaluation  
- **French-first**: Optimized for French SMEs with local embedding models
- **Performance-first**: Fast mode enabled by default for better UX
- **Docker-native**: Production-ready containerization from day one

**Archived Components** (available in `/archive/` for reference):
- Multi-tenant organization management
- Advanced analytics dashboards  
- Audit logging and compliance features
- Rate limiting middleware
- Complex permission systems

This architecture supports the current business model of premium consulting deployments while maintaining the technical foundation for future scaling or feature additions.