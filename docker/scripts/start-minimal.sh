#!/bin/bash
set -e

# Minimal Client Startup Script
# Optimized for consulting platform deployment

echo "Starting RAG Consulting Platform for client: $CLIENT_ID"

# Validate client configuration
if [ ! -d "/app/clients/$CLIENT_ID" ]; then
    echo "ERROR: Client configuration not found for $CLIENT_ID"
    exit 1
fi

echo "✓ Client configuration found"

# Load client-specific environment variables if they exist
if [ -f "/app/clients/$CLIENT_ID/config/.env" ]; then
    echo "Loading client environment variables..."
    export $(cat /app/clients/$CLIENT_ID/config/.env | grep -v '^#' | xargs)
fi

# Validate required environment variables
REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "GROQ_API_KEY"
)

echo "Validating environment variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✓ Environment variables validated"

# Quick database connectivity check
echo "Checking database connection..."
cd /app/backend

python3 -c "
import os
try:
    from app.db.supabase_client import supabase_client
    result = supabase_client.table('organizations').select('*').limit(1).execute()
    print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    exit(1)
" || exit 1

# Start the minimal backend service
echo "Starting backend service..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers ${WORKERS:-1} \
    --worker-class uvicorn.workers.UvicornWorker \
    --log-level ${LOG_LEVEL:-info} \
    --no-access-log