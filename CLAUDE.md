# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Raggy is a multi-tenant SaaS RAG (Retrieval-Augmented Generation) platform for French companies, particularly SMEs. It enables organizations to upload their internal documents and use an AI assistant powered by their own data in a secure, isolated environment.

## Tech Stack

### Backend (FastAPI + Python)
- **Framework**: FastAPI with async/await patterns
- **AI/ML**: LangChain, Groq API (deepseek-r1-distill-llama-70b), Sentence Transformers
- **Database**: Supabase (PostgreSQL + pgvector) with Row Level Security (RLS)
- **Auth**: Supabase Auth with JWT
- **Caching**: Redis (optional)
- **Monitoring**: Sentry

### Frontend (Next.js 14 + TypeScript)
- **Framework**: Next.js 14 with App Router
- **UI**: shadcn/ui components + Tailwind CSS
- **Auth**: Supabase Auth integration
- **State**: React hooks + SWR for data fetching

## Key Commands

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest tests/ -v --cov=app

# Run specific test suite
python run_tests.py  # Runs multi-tenancy tests

# Linting and formatting
black .
flake8 .
```

### Frontend Development
```bash
cd frontend
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Type checking and linting
npm run type-check
npm run lint
```

### Docker Commands
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

## Architecture & Code Organization

### Multi-Tenant Architecture
Every request and data operation is scoped by `organization_id`. Key principles:
- Organizations are completely isolated from each other
- Users belong to exactly one organization (MVP constraint)
- All database tables include `organization_id` with RLS policies
- API endpoints automatically filter by authenticated user's organization

### Backend Structure
- `app/api/`: API routers (chat, upload, analytics, organizations)
- `app/core/`: Configuration, middleware, dependencies
- `app/rag/`: RAG pipeline components (loader, splitter, embedder, retriever)
- `app/db/`: Database client and queries
- `app/services/`: Background jobs, audit logging, monitoring

### Frontend Structure
- `src/app/`: Next.js App Router pages
- `src/components/`: Reusable React components
- `src/contexts/`: React contexts (AuthContext)
- `src/utils/`: API clients and utilities
- `src/types/`: TypeScript type definitions

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
- `/api/v1/chat/stream`: Streaming chat responses
- `/api/v1/upload`: Document upload and processing
- `/api/v1/analytics`: Usage statistics
- `/api/v1/organizations`: Organization management
- `/health`: Health check with dependencies status

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
Apply migrations in order:
```bash
cd backend
# Review migrations/001_add_organizations.sql
# Apply via Supabase dashboard or CLI
```

### Environment Variables
Critical variables that must be set:
- `GROQ_API_KEY`: For LLM inference
- `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: Database connection
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Frontend auth
- `REDIS_URL`: Redis connection for caching and job queue (optional, defaults to localhost)
- `DATABASE_URL`: Direct PostgreSQL connection for migrations (optional)

### RAG Configuration (Optional)
- `EMBEDDING_MODEL`: Default `intfloat/multilingual-e5-large-instruct` (384 dimensions)
- `USE_HYBRID_SEARCH`: Enable hybrid dense+sparse retrieval (default true)
- `USE_RERANKING`: Enable cross-encoder reranking (default true)
- `USE_QUERY_ENHANCEMENT`: Enable multiple query variations (default true)

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

### Testing Multi-Tenancy
Run the comprehensive test suite:
```bash
cd backend
python run_tests.py
```

This validates organization isolation, user permissions, and data access controls.

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

### Core Tables
- `organizations`: Multi-tenant organization management with plan limits
- `organization_members`: User-org relationships with roles (admin/member)
- `documents`: Uploaded documents (org-scoped with RLS)
- `document_vectors`: pgvector embeddings (384 dimensions, HNSW indexed)
- `chat_logs`: Conversation history (org-scoped)
- `audit_logs`: Organization activity tracking (admin-only access)

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

## Plan Limits & Scaling
- **Free Plan**: 100 documents per organization
- **Pro Plan**: 1,000 documents per organization  
- **Enterprise Plan**: 10,000+ documents per organization
- **Rate Limiting**: Per-organization API rate limits
- **Async Processing**: Background jobs prevent UI blocking during uploads