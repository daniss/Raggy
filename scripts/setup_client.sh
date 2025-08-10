#!/bin/bash

# Raggy Client Setup Script
# Configure and deploy Raggy for a new client
# Usage: ./setup_client.sh <client_name> <deployment_type>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 <client_name> <deployment_type>${NC}"
    echo "deployment_type: docker | kubernetes | standalone"
    exit 1
fi

CLIENT_NAME=$1
DEPLOYMENT_TYPE=$2
CLIENT_SLUG=$(echo $CLIENT_NAME | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}=== Raggy Client Setup ===${NC}"
echo "Client: $CLIENT_NAME"
echo "Deployment: $DEPLOYMENT_TYPE"
echo "Slug: $CLIENT_SLUG"
echo ""

# Create client directory
CLIENT_DIR="./clients/$CLIENT_SLUG"
echo -e "${YELLOW}Creating client directory...${NC}"
mkdir -p $CLIENT_DIR/{config,data,backups,logs}

# Copy base configuration
echo -e "${YELLOW}Copying configuration templates...${NC}"
cp -r ./clients/template/* $CLIENT_DIR/ 2>/dev/null || true

# Generate environment file
echo -e "${YELLOW}Generating environment configuration...${NC}"
cat > $CLIENT_DIR/config/.env << EOF
# Raggy Configuration for $CLIENT_NAME
# Generated: $(date)

# Client Information
CLIENT_NAME="$CLIENT_NAME"
CLIENT_SLUG="$CLIENT_SLUG"
DEPLOYMENT_TYPE="$DEPLOYMENT_TYPE"

# API Configuration
API_TITLE="Assistant IA - $CLIENT_NAME"
API_DESCRIPTION="Solution RAG privée pour $CLIENT_NAME"
API_VERSION="1.0.0"
ENVIRONMENT="production"
DEBUG=false

# Database Configuration
SUPABASE_URL=https://${CLIENT_SLUG}.supabase.co
SUPABASE_SERVICE_KEY=<TO_BE_CONFIGURED>
DATABASE_URL=postgresql://postgres:password@localhost:5432/${CLIENT_SLUG}_db

# LLM Configuration
GROQ_API_KEY=<TO_BE_CONFIGURED>
GROQ_MODEL=deepseek-r1-distill-llama-70b
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=2000

# Embedding Configuration
EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct
EMBEDDING_DIMENSION=384
USE_HYBRID_SEARCH=true
USE_RERANKING=true
USE_QUERY_ENHANCEMENT=true

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Security
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=["http://localhost:3000","https://${CLIENT_SLUG}.raggy.fr"]

# Limits
MAX_DOCUMENTS=1000
MAX_UPLOAD_SIZE_MB=50
MAX_QUERIES_PER_DAY=10000
RATE_LIMIT_PER_MINUTE=60

# Features
ENABLE_UPLOAD=true
ENABLE_EXPORT=true
ENABLE_ANALYTICS=true
ENABLE_DEMO_MODE=false

# Branding
PRIMARY_COLOR="#1e40af"
SECONDARY_COLOR="#3b82f6"
LOGO_URL="/logo-${CLIENT_SLUG}.png"
EOF

# Create docker-compose for client
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo -e "${YELLOW}Generating Docker Compose configuration...${NC}"
    cat > $CLIENT_DIR/docker-compose.yml << 'EOF'
version: '3.8'

services:
  frontend:
    image: raggy-frontend:latest
    container_name: ${CLIENT_SLUG}-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:8000
    env_file:
      - ./config/.env
    depends_on:
      - backend
    networks:
      - raggy-network

  backend:
    image: raggy-backend:latest
    container_name: ${CLIENT_SLUG}-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - ./config/.env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    networks:
      - raggy-network

  postgres:
    image: ankane/pgvector:latest
    container_name: ${CLIENT_SLUG}-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${CLIENT_SLUG}_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    networks:
      - raggy-network

  redis:
    image: redis:7-alpine
    container_name: ${CLIENT_SLUG}-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - raggy-network

volumes:
  postgres_data:
  redis_data:

networks:
  raggy-network:
    driver: bridge
EOF
fi

# Create deployment script
echo -e "${YELLOW}Creating deployment script...${NC}"
cat > $CLIENT_DIR/deploy.sh << 'EOF'
#!/bin/bash

# Load environment
source ./config/.env

echo "Deploying Raggy for $CLIENT_NAME..."

# Check deployment type
case $DEPLOYMENT_TYPE in
  docker)
    echo "Starting Docker containers..."
    docker-compose up -d
    echo "Waiting for services to be ready..."
    sleep 10
    echo "Running database migrations..."
    docker exec ${CLIENT_SLUG}-backend python -m app.migrations.run
    echo "Deployment complete!"
    echo "Frontend: http://localhost:3000"
    echo "Backend API: http://localhost:8000"
    ;;
  kubernetes)
    echo "Applying Kubernetes manifests..."
    kubectl apply -f ./k8s/
    echo "Deployment complete!"
    kubectl get pods
    ;;
  standalone)
    echo "Starting standalone services..."
    cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    cd frontend && npm start &
    echo "Services started!"
    ;;
  *)
    echo "Unknown deployment type: $DEPLOYMENT_TYPE"
    exit 1
    ;;
esac
EOF

chmod +x $CLIENT_DIR/deploy.sh

# Create backup script
echo -e "${YELLOW}Creating backup script...${NC}"
cat > $CLIENT_DIR/backup.sh << 'EOF'
#!/bin/bash

# Load environment
source ./config/.env

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "Creating backup for $CLIENT_NAME..."

# Backup database
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    docker exec ${CLIENT_SLUG}-postgres pg_dump -U postgres ${CLIENT_SLUG}_db > $BACKUP_DIR/database.sql
fi

# Backup documents
cp -r ./data/documents $BACKUP_DIR/documents 2>/dev/null || true

# Backup configuration
cp -r ./config $BACKUP_DIR/config

# Create archive
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup created: $BACKUP_DIR.tar.gz"
EOF

chmod +x $CLIENT_DIR/backup.sh

# Create monitoring script
echo -e "${YELLOW}Creating monitoring script...${NC}"
cat > $CLIENT_DIR/monitor.sh << 'EOF'
#!/bin/bash

# Load environment
source ./config/.env

echo "=== Raggy System Status ==="
echo "Client: $CLIENT_NAME"
echo "Time: $(date)"
echo ""

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo "Container Status:"
    docker ps --filter "name=${CLIENT_SLUG}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
fi

# Check API health
echo ""
echo "API Health Check:"
curl -s http://localhost:8000/health | jq '.' 2>/dev/null || echo "API not responding"

echo ""
echo "Database Stats:"
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    docker exec ${CLIENT_SLUG}-postgres psql -U postgres -d ${CLIENT_SLUG}_db -c "SELECT COUNT(*) as documents FROM documents;" 2>/dev/null
    docker exec ${CLIENT_SLUG}-postgres psql -U postgres -d ${CLIENT_SLUG}_db -c "SELECT COUNT(*) as vectors FROM document_vectors;" 2>/dev/null
fi
EOF

chmod +x $CLIENT_DIR/monitor.sh

# Summary
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo "Client directory: $CLIENT_DIR"
echo ""
echo "Next steps:"
echo "1. Configure API keys in $CLIENT_DIR/config/.env"
echo "2. Place client logo in $CLIENT_DIR/assets/logo-${CLIENT_SLUG}.png"
echo "3. Run deployment: cd $CLIENT_DIR && ./deploy.sh"
echo "4. Load initial documents: ./load_documents.sh"
echo "5. Monitor system: ./monitor.sh"
echo ""
echo -e "${YELLOW}Important files:${NC}"
echo "- Configuration: $CLIENT_DIR/config/.env"
echo "- Deployment: $CLIENT_DIR/deploy.sh"
echo "- Backup: $CLIENT_DIR/backup.sh"
echo "- Monitoring: $CLIENT_DIR/monitor.sh"