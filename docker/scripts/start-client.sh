#!/bin/bash
set -e

# Client-Specific Startup Script
# This script starts both frontend and backend services for a specific client

echo "Starting RAG Platform for client: $CLIENT_ID"

# Validate client configuration
if [ ! -d "/app/clients/$CLIENT_ID" ]; then
    echo "ERROR: Client configuration not found for $CLIENT_ID"
    exit 1
fi

echo "✓ Client configuration found"

# Load client-specific environment variables
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

# Database migration check
echo "Checking database connection..."
cd /app/backend

python3 -c "
import os
from app.db.supabase_client import supabase_client
try:
    result = supabase_client.table('organizations').select('*').limit(1).execute()
    print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    exit(1)
"

# Start services based on deployment mode
if [ "$DEPLOYMENT_MODE" = "combined" ]; then
    echo "Starting combined frontend and backend service..."
    
    # Start backend in background
    cd /app/backend
    echo "Starting backend on port 8000..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✓ Backend started successfully"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "✗ Backend failed to start"
            kill $BACKEND_PID 2>/dev/null || true
            exit 1
        fi
        sleep 2
    done
    
    # Start frontend
    cd /app/frontend
    echo "Starting frontend on port 3000..."
    npm start
    
else
    # Default: Backend only mode
    echo "Starting backend service only..."
    cd /app/backend
    
    # Create startup delay to allow dependencies to initialize
    sleep 5
    
    # Start backend with multiple workers
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers ${WORKERS:-2} \
        --worker-class uvicorn.workers.UvicornWorker \
        --log-level info \
        --access-log \
        --loop uvloop \
        --http httptools
fi