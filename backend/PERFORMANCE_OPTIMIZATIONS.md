# RAG Performance Optimizations

## Problem: 15-second response time for RAG queries

### Root Causes Identified
1. **Query Enhancement with LLM** (3-5s): Unnecessary LLM call before retrieval
2. **Multiple Search Queries** (3-6s): Generating 3 query variations and searching separately
3. **Hybrid Search Overhead** (2-4s): Running both dense and BM25 search every time
4. **Cross-Encoder Reranking** (2-3s): Heavy model for reranking documents
5. **Final LLM Generation** (3-5s): Groq API call for answer generation

## Implemented Solutions

### 1. Fast QA Chain (`app/rag/qa_fast.py`)
- **Keyword extraction instead of LLM enhancement**: Simple stop-word removal vs LLM call
- **Single retrieval pass**: One search instead of 3 variations
- **Reduced context documents**: Max 5 docs instead of 8
- **Lightweight reranking**: Keyword overlap scoring instead of cross-encoder
- **Query caching**: Cache enhanced queries to avoid reprocessing

### 2. Fast Retriever (`app/rag/fast_retriever.py`)
- **Dense-only search in fast mode**: Skip BM25 for 50% reduction
- **Configurable via `FAST_MODE=true`**: Toggle between fast and comprehensive

### 3. Streaming Endpoint (`app/api/chat_stream.py`)
- **Server-Sent Events (SSE)**: Stream tokens as generated
- **Perceived latency reduction**: Users see response starting immediately
- **Progressive rendering**: Status updates → Documents found → Answer streaming

### 4. Configuration Optimizations
```env
# Performance settings (add to .env)
FAST_MODE=true                    # Enable fast mode
USE_RERANKING=false               # Skip heavy reranking
USE_QUERY_ENHANCEMENT=false       # Skip LLM query enhancement
MAX_CONTEXT_DOCS=5                # Limit context documents
ENABLE_LIGHTWEIGHT_RERANK=true    # Use lightweight reranking when needed
```

## Expected Performance Improvements

### Before Optimizations (15s total)
- Query enhancement: 4s
- Multiple searches: 5s
- Reranking: 3s
- LLM generation: 3s

### After Optimizations (3-5s total)
- Keyword extraction: 0.1s (-3.9s)
- Single dense search: 1s (-4s)
- Lightweight rerank: 0.5s (-2.5s)
- LLM generation: 2-3s (unchanged, but streamed)

**Total reduction: 10-12 seconds (67-80% faster)**

## Usage

### Standard Endpoint (Optimized)
```bash
POST /api/v1/chat
{
  "question": "Comment configurer les paramètres?"
}
```

### Streaming Endpoint (Real-time)
```bash
POST /api/v1/chat/stream
{
  "question": "Comment configurer les paramètres?"
}
```

Response format (SSE):
```javascript
data: {"type": "start", "conversation_id": "..."}
data: {"type": "status", "message": "Recherche de documents..."}
data: {"type": "token", "content": "Voici"}
data: {"type": "token", "content": " comment"}
data: {"type": "sources", "sources": [...]}
data: {"type": "complete", "response_time": 3.2}
```

## Frontend Integration

```javascript
// Use EventSource for streaming
const eventSource = new EventSource('/api/v1/chat/stream');
let answer = '';

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'token':
      answer += data.content;
      updateUI(answer);
      break;
    case 'sources':
      displaySources(data.sources);
      break;
    case 'complete':
      console.log(`Response time: ${data.response_time}s`);
      eventSource.close();
      break;
  }
};
```

## Monitoring Performance

Check actual response times:
```bash
# View recent chat response times
curl http://localhost:8000/api/v1/analytics/response-times

# Check circuit breaker status
curl http://localhost:8000/api/v1/monitoring/circuit-breakers
```

## Rollback if Needed

To revert to comprehensive (slower) mode:
```env
FAST_MODE=false
USE_RERANKING=true
USE_QUERY_ENHANCEMENT=true
MAX_CONTEXT_DOCS=8
```

Then restart the backend service.