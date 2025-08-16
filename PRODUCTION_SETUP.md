# Raggy - Production Environment Setup

## Overview
Raggy is a production-ready RAG (Retrieval-Augmented Generation) system built with Next.js 15, FastAPI, and Supabase. This guide covers environment configuration for production deployment.

## Architecture
- **Frontend/API**: Next.js 15 with App Router (`rag-saas-ui/`)
- **RAG Service**: FastAPI for document processing and Q&A (`rag-service/`)
- **Database**: Supabase (PostgreSQL with pgvector)
- **Storage**: Supabase Storage for documents
- **Encryption**: AES-256-GCM with envelope encryption (KEK/DEK)

## Environment Variables

### Next.js Application (rag-saas-ui/)

#### Required for Production
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# RAG Service Connection  
RAG_BASE_URL=http://localhost:8001  # or your FastAPI service URL
```

#### Optional
```bash
# Environment Mode
NODE_ENV=production
MOCK_MODE=false  # Set to true for testing without real services
```

### FastAPI RAG Service (rag-service/)

#### Required for Production
```bash
# Master Encryption Key (32-byte base64 encoded)
RAG_MASTER_KEY=your-base64-32byte-key

# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Embedding Provider (Nomic AI recommended)
EMBEDDING_PROVIDER=nomic
EMBEDDING_MODEL=nomic-embed-text-v1.5
EMBEDDING_DIM=768
EMBEDDING_API_KEY=your-nomic-api-key

# Generation Provider (Groq recommended)  
GENERATION_PROVIDER=groq
GENERATION_MODEL_FAST=llama-3.1-8b-instant
GENERATION_MODEL_QUALITY=llama-3.1-70b-versatile
GROQ_API_KEY=your-groq-api-key
```

#### Optional Configuration
```bash
# Service Configuration
RAG_SERVICE_PORT=8001
DEBUG=false

# Document Processing
CHUNK_SIZE=800
CHUNK_OVERLAP=150

# CORS (for development)
ENABLE_CORS=false
NEXT_APP_URL=http://localhost:3000
```

## Database Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and keys

### 2. Apply Database Schema
Execute the SQL in `database-schema.sql` in your Supabase SQL editor:

```bash
# This will create:
# - org_keys table (encrypted DEKs)
# - rag_chunks table with vector(768) column
# - Vector similarity search function
# - RLS policies
# - Performance indexes
```

### 3. Enable Extensions
Ensure these extensions are enabled:
- `vector` (for pgvector)
- `uuid-ossp` (for UUID generation)

### 4. Verify Indexes
The schema creates these performance indexes:
```sql
-- Vector search index
CREATE INDEX idx_rag_chunks_org_embedding 
  ON rag_chunks USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100) 
  WHERE org_id IS NOT NULL;

-- Query performance indexes  
CREATE INDEX idx_rag_chunks_orgid ON rag_chunks(org_id);
CREATE INDEX idx_rag_chunks_doc ON rag_chunks(document_id);
CREATE INDEX idx_documents_rag_status ON documents(rag_status);
```

## Security Configuration

### 1. Generate Master Encryption Key
```bash
# Generate a 32-byte key and encode it in base64
openssl rand -base64 32
```
Set this as `RAG_MASTER_KEY` in your FastAPI environment.

### 2. Row Level Security (RLS)
The database schema automatically enables RLS policies to ensure:
- Users can only access their organization's data
- Cross-tenant data isolation is enforced
- Audit logs are properly scoped

### 3. API Keys Security
- Store all API keys in environment variables
- Never commit keys to version control
- Use different keys for development/production
- Rotate keys regularly

## Deployment Options

### Option 1: Docker Compose (Recommended)
```yaml
# docker-compose.yml
version: '3.8'
services:
  nextjs:
    build: ./rag-saas-ui
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}
      - RAG_BASE_URL=http://rag-service:8001
    ports:
      - "3000:3000"
    depends_on:
      - rag-service
      
  rag-service:
    build: ./rag-service
    environment:
      - RAG_MASTER_KEY=${RAG_MASTER_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - EMBEDDING_PROVIDER=nomic
      - EMBEDDING_API_KEY=${EMBEDDING_API_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
    ports:
      - "8001:8001"
```

### Option 2: Separate Services
Deploy Next.js and FastAPI independently, ensuring:
- FastAPI is accessible from Next.js via `RAG_BASE_URL`
- Both services can connect to Supabase
- Proper network security between services

## Health Checks

### Next.js Health Check
```bash
curl http://localhost:3000/api/rag/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "Service RAG FastAPI opérationnel",
  "config": {
    "rag_base_url": "http://localhost:8001",
    "last_check": "2024-01-01T12:00:00.000Z"
  },
  "fastapi_health": {
    "status": "healthy",
    "providers": {
      "embedding": "nomic-nomic-embed-text-v1.5 (768d)",
      "llm": "groq-llama-3.1-70b-versatile",
      "database": "supabase-connected"
    }
  }
}
```

### FastAPI Health Check  
```bash
curl http://localhost:8001/rag/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "providers": {
    "embedding": "nomic-nomic-embed-text-v1.5 (768d)",
    "llm": "groq-llama-3.1-70b-versatile",
    "database": "supabase-connected"
  }
}
```

## Feature Configuration

### Tier Limits (lib/limits.ts)
The system enforces per-tier limits:

**Starter**: 3 seats, 10 documents, 100MB storage, 50K tokens/month
**Pro**: 10 seats, 100 documents, 1GB storage, 500K tokens/month  
**Enterprise**: 100 seats, 1K documents, 10GB storage, 5M tokens/month

### Supported File Types
- PDF (`.pdf`)
- DOCX (`.docx`)
- Text files (`.txt`, `.md`)
- HTML (`.html`, `.htm`)
- CSV (`.csv`)
- Code files (`.json`, `.js`, `.py`)

### Multi-tenant Security
- Per-organization data encryption using envelope encryption (KEK/DEK)
- Row Level Security (RLS) policies in database
- Server-side permission checks on all routes
- Correlation ID tracking for audit trails

## Troubleshooting

### Common Issues

**Build fails with Supabase errors**: Set mock environment variables for build:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-key pnpm build
```

**RAG service unavailable**: Check that `RAG_BASE_URL` points to your FastAPI service and it's running.

**Vector search fails**: Ensure pgvector extension is enabled and indexes are created.

**Document indexing fails**: Verify file types are supported and storage permissions are correct.

### Logs and Monitoring
- Next.js logs API requests with correlation IDs
- FastAPI logs document processing steps
- Supabase provides database query logs
- All errors include correlation IDs for tracing

## Production Checklist

- [ ] Environment variables configured
- [ ] Database schema applied with all indexes
- [ ] Master encryption key generated and stored securely  
- [ ] API keys for embedding and LLM providers configured
- [ ] Health checks pass for both services
- [ ] RLS policies verified in database
- [ ] Storage bucket configured with proper permissions
- [ ] SSL/TLS configured for production domains
- [ ] Monitoring and logging configured
- [ ] Backup strategy for database implemented

## Support

For issues or questions:
1. Check health endpoints first
2. Review correlation IDs in logs
3. Verify environment configuration
4. Test with mock mode to isolate issues