# 🚀 Guide de Déploiement - Support Chatbot

Ce guide couvre tous les aspects du déploiement du Support Chatbot, du développement local à la production cloud.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Déploiement Local](#déploiement-local)
3. [Déploiement Docker](#déploiement-docker)
4. [Déploiement Cloud](#déploiement-cloud)
5. [Configuration Production](#configuration-production)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Prérequis

### Comptes et Services Requis

1. **[Groq API](https://console.groq.com/)**
   - Créer un compte et obtenir une clé API
   - Modèle recommandé : `deepseek-r1-distill-llama-70b`

2. **[Supabase](https://supabase.com/)**
   - Projet Supabase avec PostgreSQL
   - Configuration Auth avec JWT
   - Clés : URL du projet + Service Role Key

3. **Services Optionnels**
   - [Sentry](https://sentry.io/) pour le monitoring d'erreurs
   - [Vercel](https://vercel.com/) ou [Netlify](https://netlify.com/) pour le frontend
   - Provider cloud (AWS, GCP, Azure) pour l'hébergement

### Outils de Développement

```bash
# Vérifier les versions
docker --version          # >= 20.10
docker-compose --version  # >= 2.0
node --version            # >= 18.0
python --version          # >= 3.11
```

## Déploiement Local

### 1. Installation Rapide

```bash
# Cloner le repository
git clone https://github.com/username/support-bot.git
cd support-bot

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# Lancer avec Docker
docker-compose up -d

# Vérifier les services
curl http://localhost:8000/health
curl http://localhost:3000
```

### 2. Installation Manuelle

<details>
<summary>Backend Setup</summary>

```bash
cd backend

# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer dépendances
pip install -r requirements.txt

# Configurer environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```
</details>

<details>
<summary>Frontend Setup</summary>

```bash
cd frontend

# Installer dépendances
npm install
# ou yarn install

# Configurer environnement
cp .env.local.example .env.local
# Éditer .env.local avec vos configurations

# Lancer en mode développement
npm run dev
# ou yarn dev
```
</details>

### 3. Configuration Base de Données

```sql
-- Créer les tables dans Supabase
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources JSONB,
    response_time REAL,
    conversation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    chunks_count INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
```

## Déploiement Docker

### 1. Configuration Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
    # Supabase handles vector storage, no volumes needed
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

# No volumes needed for Supabase vector storage
```

### 2. Configuration Nginx

```nginx
# nginx/nginx.conf
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}
```

### 3. Commandes de Déploiement

```bash
# Production build et déploiement
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Monitoring des logs
docker-compose logs -f

# Mise à jour
git pull
docker-compose build
docker-compose up -d

# Backup
# Vector data is stored in Supabase, backup through Supabase backups
```

## Déploiement Cloud

### AWS Deployment

<details>
<summary>AWS ECS avec Fargate</summary>

#### 1. Infrastructure Setup

```bash
# Installer AWS CLI
pip install awscli
aws configure

# Créer ECR repositories
aws ecr create-repository --repository-name support-bot/backend
aws ecr create-repository --repository-name support-bot/frontend
```

#### 2. Build et Push Images

```bash
# Backend
$(aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com)

docker build -t support-bot/backend ./backend
docker tag support-bot/backend:latest $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/backend:latest
docker push $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/backend:latest

# Frontend
docker build -t support-bot/frontend ./frontend
docker tag support-bot/frontend:latest $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/frontend:latest
docker push $ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/frontend:latest
```

#### 3. ECS Task Definition

```json
{
  "family": "support-bot",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/backend:latest",
      "portMappings": [{"containerPort": 8000}],
      "environment": [
        {"name": "ENVIRONMENT", "value": "production"},
        {"name": "GROQ_API_KEY", "value": "your-key"},
        {"name": "SUPABASE_URL", "value": "your-url"}
      ]
    },
    {
      "name": "frontend",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/support-bot/frontend:latest",
      "portMappings": [{"containerPort": 3000}]
    }
  ]
}
```
</details>

### Google Cloud Platform

<details>
<summary>Cloud Run Deployment</summary>

```bash
# Authentification
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build et deploy backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/support-bot-backend ./backend
gcloud run deploy support-bot-backend \
  --image gcr.io/YOUR_PROJECT_ID/support-bot-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GROQ_API_KEY=your-key,SUPABASE_URL=your-url"

# Build et deploy frontend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/support-bot-frontend ./frontend
gcloud run deploy support-bot-frontend \
  --image gcr.io/YOUR_PROJECT_ID/support-bot-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
</details>

### Kubernetes Deployment

<details>
<summary>Kubernetes Manifests</summary>

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: support-bot-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: support-bot-backend
  template:
    metadata:
      labels:
        app: support-bot-backend
    spec:
      containers:
      - name: backend
        image: your-registry/support-bot-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: GROQ_API_KEY
          valueFrom:
            secretKeyRef:
              name: support-bot-secrets
              key: groq-api-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: support-bot-backend-service
spec:
  selector:
    app: support-bot-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

```bash
# Déployer sur Kubernetes
kubectl apply -f k8s/
kubectl get pods
kubectl logs -f deployment/support-bot-backend
```
</details>

## Configuration Production

### 1. Variables d'Environnement

```bash
# .env.production
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# API Configuration
GROQ_API_KEY=your_production_groq_key
GROQ_MODEL=deepseek-r1-distill-llama-70b

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:password@db:5432/support_bot

# Security
SECRET_KEY=your-super-secret-key-here
CORS_ORIGINS=["https://yourdomain.com"]

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
```

### 2. Performance Tuning

```python
# backend/app/core/config.py
class ProductionSettings(Settings):
    # Database
    db_pool_size: int = 20
    db_max_overflow: int = 30
    
    # API
    worker_count: int = 4
    max_requests: int = 1000
    timeout: int = 60
    
    # RAG
    chunk_size: int = 1500
    retrieval_k: int = 5
    embedding_batch_size: int = 32
```

### 3. Security Hardening

```yaml
# docker-compose.prod.yml - Security
services:
  backend:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    user: "1000:1000"
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 4. SSL/TLS Configuration

```bash
# Obtenir certificats Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

## Monitoring & Maintenance

### 1. Health Checks

```python
# Health check endpoint étendu
@app.get("/health")
async def detailed_health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": settings.api_version,
        "dependencies": {
            "vector_store": await check_vector_store_health(),
            "groq_api": await check_groq_health(),
            "supabase": await check_supabase_health(),
            "disk_space": get_disk_usage(),
            "memory": get_memory_usage()
        }
    }
```

### 2. Monitoring avec Grafana

```yaml
# monitoring/docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
```

### 3. Backup Strategy

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Backup vector data through Supabase
# Vectors are backed up as part of Supabase database backups

# Backup Supabase (if self-hosted)
docker exec support-bot-postgres pg_dump -U postgres support_bot > $BACKUP_DIR/postgres_$DATE.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/ s3://your-backup-bucket/support-bot/ --recursive

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
```

### 4. Log Management

```yaml
# logging/docker-compose.logging.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    
  logstash:
    image: docker.elastic.co/logstash/logstash:7.17.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    
  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    ports:
      - "5601:5601"
```

## Troubleshooting

### Problèmes Courants

#### 1. Vector Store Connection Issues
```bash
# Vérifier les permissions
# Check Supabase vector table
# Ensure pgvector extension is enabled

# Recréer la base vectorielle
docker-compose exec backend python -c "
from app.rag.retriever import retriever
retriever.reset_collection()
"
```

#### 2. Groq API Rate Limits
```python
# Implémentation retry avec backoff
import backoff

@backoff.on_exception(
    backoff.expo,
    groq.RateLimitError,
    max_tries=3,
    max_time=300
)
async def call_groq_with_retry(messages):
    return await groq_client.chat.completions.create(...)
```

#### 3. Memory Issues
```bash
# Monitorer l'utilisation mémoire
docker stats

# Augmenter les limites
docker-compose.yml:
  services:
    backend:
      deploy:
        resources:
          limits:
            memory: 4G
```

#### 4. Database Connection Pool
```python
# Configuration pool PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/db?pool_size=20&max_overflow=30"
```

### Scripts de Maintenance

```bash
# scripts/maintenance.sh
#!/bin/bash

# Nettoyage des logs
find /var/log/support-bot -name "*.log" -mtime +7 -delete

# Optimisation Supabase Vector Store
docker-compose exec backend python -c "
from app.rag.retriever import retriever
stats = retriever.get_collection_stats()
print(f'Documents: {stats[\"total_documents\"]}')
"

# Vérification santé services
curl -f http://localhost:8000/health || echo "Backend down"
curl -f http://localhost:3000 || echo "Frontend down"

# Redémarrage si nécessaire
if [ $? -ne 0 ]; then
    docker-compose restart
fi
```

### Monitoring Alerts

```yaml
# alerting/prometheus-rules.yml
groups:
- name: support-bot
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    annotations:
      summary: "High error rate detected"
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    annotations:
      summary: "High response time detected"
```

Ce guide couvre tous les aspects essentiels du déploiement. Pour des environnements spécifiques ou des besoins particuliers, n'hésitez pas à adapter les configurations selon vos contraintes.