# Minimal Multi-Client Docker Build
# Optimized for consulting platform with reduced dependencies

ARG CLIENT_ID=template
ARG NODE_VERSION=18
ARG PYTHON_VERSION=3.11-slim

# ================================
# Frontend Build Stage
# ================================
FROM node:${NODE_VERSION}-alpine as frontend-builder

ARG CLIENT_ID

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (significantly reduced)
RUN npm ci --only=production --no-audit

# Copy source code  
COPY frontend/ ./

# Copy client-specific assets and configuration
COPY clients/${CLIENT_ID}/ ./client-config/

# Build application with client-specific configuration
ENV NEXT_PUBLIC_CLIENT_ID=${CLIENT_ID}
RUN npm run build

# ================================
# Backend Build Stage  
# ================================
FROM python:${PYTHON_VERSION} as backend-builder

ARG CLIENT_ID

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (significantly reduced)
COPY backend/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy client-specific configuration
COPY clients/${CLIENT_ID}/ ./clients/${CLIENT_ID}/

# ================================
# Minimal Production Image
# ================================
FROM python:${PYTHON_VERSION} as production

ARG CLIENT_ID

WORKDIR /app

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy Python packages from builder
COPY --from=backend-builder /root/.local /root/.local
COPY --from=backend-builder /app ./backend

# Copy built frontend (static files only)
COPY --from=frontend-builder /app/out ./frontend/out
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static

# Copy client configuration
COPY clients/${CLIENT_ID}/ ./clients/${CLIENT_ID}/

# Set environment variables
ENV CLIENT_ID=${CLIENT_ID}
ENV PYTHONPATH=/app/backend
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R appuser:appuser /app

# Copy minimal startup script
COPY docker/scripts/start-minimal.sh ./start.sh
RUN chmod +x ./start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose only backend port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Start command
CMD ["./start.sh"]