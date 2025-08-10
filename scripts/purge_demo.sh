#!/bin/bash

# Purge Demo Data Script
# Clean expired demo sessions and data

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_URL=${API_URL:-http://localhost:8000}
DB_CONNECTION=${DATABASE_URL:-postgresql://postgres:password@localhost:5432/raggy_db}

echo -e "${GREEN}=== Purging Demo Data ===${NC}"
echo "API URL: $API_URL"
echo "Time: $(date)"
echo ""

# Function to execute SQL
execute_sql() {
    local query=$1
    if command -v psql >/dev/null 2>&1; then
        echo "$query" | psql "$DB_CONNECTION" -t -A
    else
        echo -e "${YELLOW}psql not available, using Docker...${NC}"
        echo "$query" | docker exec -i raggy-postgres psql -U postgres -d raggy_db -t -A 2>/dev/null
    fi
}

# Check expired demo sessions
echo -e "${YELLOW}Checking expired demo sessions...${NC}"
expired_count=$(execute_sql "SELECT COUNT(*) FROM demo_sessions WHERE expires_at < NOW();" 2>/dev/null || echo "0")
echo "Found $expired_count expired demo sessions"

if [ "$expired_count" -gt 0 ]; then
    echo -e "${YELLOW}Cleaning up expired demo data...${NC}"
    
    # Get expired session tokens
    expired_tokens=$(execute_sql "SELECT session_token FROM demo_sessions WHERE expires_at < NOW();" 2>/dev/null || echo "")
    
    if [ ! -z "$expired_tokens" ]; then
        # Clean chat logs for expired sessions
        chat_logs_deleted=$(execute_sql "DELETE FROM chat_logs WHERE session_id IN (SELECT session_token FROM demo_sessions WHERE expires_at < NOW()); SELECT ROW_COUNT();" 2>/dev/null || echo "0")
        echo "Deleted $chat_logs_deleted chat logs"
        
        # Clean document vectors for demo documents
        vectors_deleted=$(execute_sql "DELETE FROM document_vectors WHERE document_id IN (SELECT id FROM documents WHERE metadata->>'demo_session' IN (SELECT session_token FROM demo_sessions WHERE expires_at < NOW())); SELECT ROW_COUNT();" 2>/dev/null || echo "0")
        echo "Deleted $vectors_deleted document vectors"
        
        # Clean demo documents
        docs_deleted=$(execute_sql "DELETE FROM documents WHERE metadata->>'demo_session' IN (SELECT session_token FROM demo_sessions WHERE expires_at < NOW()); SELECT ROW_COUNT();" 2>/dev/null || echo "0")
        echo "Deleted $docs_deleted demo documents"
        
        # Clean expired sessions
        sessions_deleted=$(execute_sql "DELETE FROM demo_sessions WHERE expires_at < NOW(); SELECT ROW_COUNT();" 2>/dev/null || echo "0")
        echo "Deleted $sessions_deleted expired sessions"
    fi
else
    echo "No expired sessions to clean"
fi

# Clean old chat logs (older than 30 days) if not demo mode
if [ "${ENABLE_DEMO_MODE:-false}" != "true" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning old chat logs (>30 days)...${NC}"
    old_logs_count=$(execute_sql "SELECT COUNT(*) FROM chat_logs WHERE created_at < NOW() - INTERVAL '30 days';" 2>/dev/null || echo "0")
    
    if [ "$old_logs_count" -gt 0 ]; then
        old_logs_deleted=$(execute_sql "DELETE FROM chat_logs WHERE created_at < NOW() - INTERVAL '30 days'; SELECT ROW_COUNT();" 2>/dev/null || echo "0")
        echo "Deleted $old_logs_deleted old chat logs"
    else
        echo "No old chat logs to clean"
    fi
fi

# Vacuum database for better performance
echo ""
echo -e "${YELLOW}Optimizing database...${NC}"
execute_sql "VACUUM ANALYZE;" >/dev/null 2>&1 || echo "Vacuum skipped"

# Show current stats
echo ""
echo -e "${GREEN}Current Database Stats:${NC}"
docs_count=$(execute_sql "SELECT COUNT(*) FROM documents;" 2>/dev/null || echo "N/A")
vectors_count=$(execute_sql "SELECT COUNT(*) FROM document_vectors;" 2>/dev/null || echo "N/A") 
sessions_count=$(execute_sql "SELECT COUNT(*) FROM demo_sessions;" 2>/dev/null || echo "N/A")
logs_count=$(execute_sql "SELECT COUNT(*) FROM chat_logs;" 2>/dev/null || echo "N/A")

echo "Documents: $docs_count"
echo "Vectors: $vectors_count"
echo "Active demo sessions: $sessions_count"
echo "Chat logs: $logs_count"

# Check demo sessions expiring soon
echo ""
expiring_soon=$(execute_sql "SELECT COUNT(*) FROM demo_sessions WHERE expires_at < NOW() + INTERVAL '1 hour' AND expires_at > NOW();" 2>/dev/null || echo "0")
if [ "$expiring_soon" -gt 0 ]; then
    echo -e "${YELLOW}$expiring_soon demo sessions expire within 1 hour${NC}"
fi

# File system cleanup (demo uploads)
if [ -d "./data/demo" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning demo file uploads...${NC}"
    find ./data/demo -type f -mtime +1 -delete 2>/dev/null || true
    find ./data/demo -type d -empty -delete 2>/dev/null || true
fi

# Log cleanup
if [ -d "./logs" ]; then
    echo -e "${YELLOW}Rotating logs...${NC}"
    find ./logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}=== Cleanup Complete ===${NC}"

# Optional: Send notification if many sessions were cleaned
if [ "$expired_count" -gt 50 ]; then
    echo -e "${RED}Warning: Cleaned $expired_count expired sessions${NC}"
    echo "Consider monitoring demo usage patterns"
fi