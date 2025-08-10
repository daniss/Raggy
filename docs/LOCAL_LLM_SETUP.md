# Local LLM Setup Guide

This guide explains how to enable and configure local LLM inference using vLLM or Text Generation Inference (TGI) instead of external APIs like Groq.

## Overview

The local LLM service allows you to:
- Run inference completely on-premises
- Reduce dependency on external APIs
- Improve privacy and data sovereignty
- Control costs for high-volume usage

## Prerequisites

### Hardware Requirements

**Minimum Requirements:**
- NVIDIA GPU with 8GB+ VRAM
- 16GB+ system RAM
- 50GB+ available disk space

**Recommended:**
- NVIDIA RTX 4090 or A100 (24GB+ VRAM)
- 32GB+ system RAM
- SSD storage for model files

### Software Requirements

- Docker with NVIDIA Container Runtime
- NVIDIA drivers (525.60.13+)
- Docker Compose 2.0+

## Setup Instructions

### 1. Install NVIDIA Container Runtime

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
   && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
   && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configure Docker
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.0.3-base-ubuntu20.04 nvidia-smi
```

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Enable local LLM
USE_LOCAL_LLM=true
LOCAL_LLM_URL="http://local-llm:8080"

# vLLM Configuration
VLLM_MODEL_PATH="microsoft/DialoGPT-medium"  # or your preferred model
VLLM_GPU_MEMORY_UTILIZATION=0.8
VLLM_MAX_MODEL_LEN=4096
VLLM_HOST="0.0.0.0"
VLLM_PORT=8080

# GPU Settings
ENABLE_GPU=true
NVIDIA_VISIBLE_DEVICES="0"  # GPU device ID
```

### 3. Download Models

Create a models directory and download your chosen model:

```bash
# Create models directory
mkdir -p ./models

# Download a French-optimized model (recommended)
cd ./models
git clone https://huggingface.co/microsoft/DialoGPT-medium

# Or download a larger model for better performance
# git clone https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.1
```

### 4. Enable Local LLM Service

Uncomment the local-llm service in `docker-compose.prod.yml`:

```yaml
# ==============================================
# LOCAL LLM SERVICE - vLLM/TGI
# ==============================================
local-llm:
  image: vllm/vllm-openai:latest
  container_name: raggy-local-llm
  restart: unless-stopped
  ports:
    - "${VLLM_PORT:-8080}:8000"
  environment:
    - VLLM_HOST=${VLLM_HOST:-0.0.0.0}
    - VLLM_PORT=8000
    - VLLM_MODEL=${VLLM_MODEL_PATH:-microsoft/DialoGPT-medium}
    - VLLM_GPU_MEMORY_UTILIZATION=${VLLM_GPU_MEMORY_UTILIZATION:-0.8}
    - VLLM_MAX_MODEL_LEN=${VLLM_MAX_MODEL_LEN:-4096}
  volumes:
    - ./models:/models
    - ./cache:/cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  networks:
    - raggy-network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 60s
    timeout: 30s
    retries: 3
    start_period: 300s
```

### 5. Update Backend Configuration

The backend will automatically detect and use the local LLM when `USE_LOCAL_LLM=true`. The system falls back to Groq if the local LLM is unavailable.

## Recommended Models

### For French Enterprise Use

1. **Mistral-7B-Instruct** (Recommended)
   - Size: ~13GB
   - Language: French + English
   - Performance: Excellent for business queries
   ```bash
   VLLM_MODEL_PATH="mistralai/Mistral-7B-Instruct-v0.1"
   ```

2. **Vigogne-7B-Instruct**
   - Size: ~13GB  
   - Language: Optimized for French
   - Performance: Good for French-specific tasks
   ```bash
   VLLM_MODEL_PATH="bofenghuang/vigogne-7b-instruct"
   ```

3. **DialoGPT-medium** (Lightweight)
   - Size: ~1.2GB
   - Language: Multi-language
   - Performance: Good for testing/development
   ```bash
   VLLM_MODEL_PATH="microsoft/DialoGPT-medium"
   ```

## Performance Optimization

### GPU Memory Settings

```bash
# Conservative (8GB GPU)
VLLM_GPU_MEMORY_UTILIZATION=0.7
VLLM_MAX_MODEL_LEN=2048

# Balanced (16GB GPU)
VLLM_GPU_MEMORY_UTILIZATION=0.8
VLLM_MAX_MODEL_LEN=4096

# Aggressive (24GB+ GPU)
VLLM_GPU_MEMORY_UTILIZATION=0.9
VLLM_MAX_MODEL_LEN=8192
```

### Batch Processing

```bash
# For high-throughput scenarios
VLLM_MAX_PARALLEL_REQUESTS=32
VLLM_MAX_BATCH_SIZE=16
```

## Deployment

### Start with Local LLM

```bash
# Start all services including local LLM
docker-compose -f docker-compose.prod.yml up -d

# Monitor local LLM startup (can take 5-10 minutes)
docker logs -f raggy-local-llm

# Check health status
curl http://localhost:8080/health
```

### Test Local LLM

```bash
# Test direct API call
curl -X POST http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-7b-instruct",
    "prompt": "Bonjour, comment allez-vous ?",
    "max_tokens": 100
  }'

# Test through Raggy backend
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "Bonjour, pouvez-vous m\'aider ?",
    "organization_id": "demo-org-12345"
  }'
```

## Monitoring

### Health Checks

```bash
# Check all services
docker-compose ps

# Monitor GPU usage
nvidia-smi -l 1

# Check local LLM logs
docker logs raggy-local-llm --tail 100 -f
```

### Performance Metrics

Access the vLLM metrics endpoint:
```bash
curl http://localhost:8080/metrics
```

## Troubleshooting

### Common Issues

**1. GPU Not Detected**
```bash
# Verify NVIDIA runtime
docker info | grep nvidia

# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.0.3-base-ubuntu20.04 nvidia-smi
```

**2. Out of Memory**
```bash
# Reduce memory utilization
VLLM_GPU_MEMORY_UTILIZATION=0.6
VLLM_MAX_MODEL_LEN=2048
```

**3. Model Loading Fails**
```bash
# Check model path
ls -la ./models/

# Verify model format
docker exec raggy-local-llm ls -la /models/
```

**4. Slow Performance**
```bash
# Check GPU utilization
nvidia-smi

# Optimize batch size
VLLM_MAX_BATCH_SIZE=8
```

### Fallback Configuration

The system automatically falls back to Groq API if local LLM fails:

```bash
# Disable local LLM temporarily
USE_LOCAL_LLM=false

# Or configure hybrid mode (local LLM + Groq backup)
USE_LOCAL_LLM=true
GROQ_API_KEY="your-groq-key"  # Keeps fallback available
```

## Cost Analysis

### Local vs External API

**Local LLM Costs:**
- Hardware: €2,000-€8,000 (one-time)
- Electricity: ~€50-200/month
- Maintenance: €100/month

**Groq API Costs:**
- Pay-per-use: €0.10-€0.50 per 1K tokens
- Monthly costs: €200-€2,000+ (depending on usage)

**Break-even:** 6-18 months depending on usage volume.

## Security Considerations

- All data remains on-premises
- No external API calls for inference
- Model weights stored locally
- Network isolation possible
- GDPR/compliance friendly

## Production Recommendations

1. **Use dedicated GPU servers** for stability
2. **Implement load balancing** for multiple GPU nodes
3. **Monitor resource usage** continuously
4. **Keep Groq fallback** for reliability
5. **Regular model updates** for performance improvements

## Support

For local LLM setup assistance:
- Technical documentation: https://docs.vllm.ai/
- Community support: https://github.com/vllm-project/vllm
- Professional support: contact@raggy.fr