# Acceptance Criteria - Raggy Client Deployment

**Version**: 2.0  
**Target**: Single-client consulting deployments  
**Validation**: Pre-delivery checklist for €15,000 engagements

---

## 🎯 Executive Summary

This document defines the comprehensive acceptance criteria for successful Raggy deployments. Each criterion must be validated and signed off before client delivery. These criteria ensure consistent quality and client satisfaction across all consulting engagements.

---

## 📋 Pre-Deployment Checklist

### ✅ Infrastructure Requirements

#### Hardware/Cloud Infrastructure
- [ ] **Minimum RAM**: 8GB allocated across all services
- [ ] **Storage**: 50GB available (20GB for system, 30GB for data)
- [ ] **CPU**: 4 cores minimum (8 cores recommended)
- [ ] **Network**: Stable internet for initial setup (if using Groq API)
- [ ] **Operating System**: Ubuntu 20.04+ or equivalent Docker-compatible OS

#### GPU Requirements (Local LLM Option)
- [ ] **GPU Memory**: 16GB+ VRAM (RTX 4090, A100, H100)
- [ ] **NVIDIA Drivers**: Latest stable drivers installed
- [ ] **CUDA Runtime**: Version 12.0+ installed
- [ ] **Docker GPU Support**: nvidia-container-toolkit configured

#### Network and Security
- [ ] **Firewall**: Ports 80, 443, 3000, 8000 accessible (internal network)
- [ ] **SSL Certificate**: Valid certificate for production domain
- [ ] **Backup Strategy**: Automated backup system configured
- [ ] **Monitoring**: System monitoring tools installed (optional)

---

## 🏗️ Technical Deployment Validation

### ✅ Core Services Health

#### Container Orchestration
```bash
# All services must be healthy
docker-compose -f docker-compose.prod.yml ps
```

**Expected Output**:
- [ ] **frontend**: Up X hours (healthy)
- [ ] **backend**: Up X hours (healthy)  
- [ ] **database**: Up X hours (healthy)
- [ ] **redis**: Up X hours (healthy)
- [ ] **nginx**: Up X hours (healthy)

#### Health Check Endpoints
```bash
# Backend health
curl -s http://localhost:8000/health | jq '.status'
# Expected: "healthy"

# Frontend health
curl -s http://localhost:3000/health | jq '.status'  
# Expected: "healthy"

# Demo health
curl -s http://localhost:3000/demo/health | jq '.status'
# Expected: "healthy"
```

**Health Check Validation**:
- [ ] **Backend**: Status "healthy", all dependencies connected
- [ ] **Frontend**: Status "healthy", environment variables loaded
- [ ] **Demo**: Status "healthy", corpus accessible
- [ ] **Database**: PostgreSQL 16 + pgvector extension active
- [ ] **Redis**: Connected with >95% uptime

#### Database Validation
```sql
-- PostgreSQL extensions
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');
-- Expected: Both extensions installed

-- Demo organization exists
SELECT id, name FROM organizations WHERE id = 'demo-org-12345';
-- Expected: 1 row returned

-- Vector index performance
EXPLAIN ANALYZE SELECT * FROM document_vectors 
WHERE embedding <-> '[0.1,0.2,...]' < 0.8 
LIMIT 10;
-- Expected: Uses HNSW index, <50ms execution
```

**Database Checklist**:
- [ ] **PostgreSQL 16**: Version verified
- [ ] **pgvector extension**: Installed and functional
- [ ] **pg_trgm extension**: Installed for text search
- [ ] **HNSW index**: Created and optimized
- [ ] **Demo organization**: Exists with sample data
- [ ] **Backup system**: Configured and tested

---

## 📚 Content and Data Validation

### ✅ Demo Corpus Integration

#### Corpus Loading Verification
```bash
# Load demo corpus with verification
python scripts/load_demo_corpus.py --verbose --stats

# Expected output validation
# ✅ Documents loaded: 10
# ✅ Chunks created: 1200+
# ✅ Vectors generated: 1200+
# ✅ No duplicates detected
# ✅ Index optimized
```

**Corpus Validation Checklist**:
- [ ] **Document Count**: 10 documents loaded successfully
- [ ] **Categories**: 5 categories (juridique, rh, fiscal, technique, commercial)
- [ ] **Chunk Generation**: 1200+ chunks created
- [ ] **Vector Embeddings**: All chunks have 384-dim embeddings
- [ ] **No Duplicates**: SHA256 hash verification passed
- [ ] **Index Performance**: <100ms average search time

#### Search Quality Validation
Test each category with standard questions:

**Juridique (RGPD)**:
```bash
Question: "Quelles sont les obligations du responsable de traitement selon le RGPD ?"
```
- [ ] **Response Time**: <5 seconds
- [ ] **Sources Cited**: ≥2 relevant sources
- [ ] **Content Accuracy**: Mentions specific RGPD articles
- [ ] **Source Links**: Clickable references working

**RH (Ressources Humaines)**:
```bash
Question: "Quelle est la procédure complète de recrutement ?"
```
- [ ] **Response Quality**: Step-by-step procedure provided
- [ ] **Source Attribution**: Manual RH 2024 cited
- [ ] **Formatting**: Well-structured response
- [ ] **Completeness**: All major steps included

**Fiscal (CIR)**:
```bash
Question: "Comment optimiser le crédit d'impôt recherche ?"
```
- [ ] **Technical Accuracy**: Correct rates and procedures
- [ ] **Current Information**: 2024 data referenced
- [ ] **Actionable Advice**: Specific optimization steps
- [ ] **Legal Compliance**: Accurate fiscal information

**Technique (API/Installation)**:
```bash
Question: "Comment installer Raggy en production ?"
```
- [ ] **Technical Detail**: Complete installation steps
- [ ] **Code Examples**: Working command examples
- [ ] **Prerequisites**: System requirements listed
- [ ] **Troubleshooting**: Common issues addressed

**Commercial (Tarification)**:
```bash
Question: "Quelle est notre grille tarifaire pour les PME ?"
```
- [ ] **Data Accuracy**: Correct pricing information
- [ ] **Segmentation**: Proper client categorization
- [ ] **Completeness**: All relevant pricing tiers
- [ ] **Currency/Dates**: Accurate and current

---

## 🎨 Client Customization Validation

### ✅ Branding and Interface

#### Visual Customization
- [ ] **Client Logo**: Uploaded and displayed correctly
- [ ] **Primary Color**: Applied consistently across interface
- [ ] **Company Name**: Appears in page titles and headers
- [ ] **Favicon**: Custom favicon loaded
- [ ] **Footer**: Client-specific footer with DPA link

#### Environment Configuration
```bash
# Verify client-specific configuration
grep -E "(CLIENT_NAME|PRIMARY_COLOR|LOGO_URL)" .env
```

**Configuration Checklist**:
- [ ] **CLIENT_NAME**: Set to client company name
- [ ] **PRIMARY_COLOR**: Hex color code applied
- [ ] **LOGO_URL**: Path to client logo file
- [ ] **NEXT_PUBLIC_APP_NAME**: Client-specific app name
- [ ] **DPA Integration**: Footer link to DPA document

#### Functional Limits
- [ ] **MAX_DOCUMENTS**: Set according to client plan (1000 default)
- [ ] **MAX_UPLOAD_SIZE_MB**: Configured appropriately (50MB default)
- [ ] **RATE_LIMITING**: Appropriate limits for client usage
- [ ] **ANALYTICS**: Enabled if requested by client
- [ ] **EXPORT_FEATURES**: Configured per client requirements

---

## 🔒 Security and Compliance Validation

### ✅ Data Protection and Privacy

#### GDPR Compliance
- [ ] **DPA Document**: Created and accessible at `/docs/DPA_short_fr_EN.md`
- [ ] **Footer Link**: DPA accessible from all pages
- [ ] **Data Minimization**: Only necessary data collected
- [ ] **Audit Logs**: All data access logged
- [ ] **Deletion Capabilities**: Purge functionality tested

#### Security Measures
```bash
# SSL/TLS verification
curl -I https://client-domain.com | grep "HTTP/2 200"
openssl s_client -connect client-domain.com:443 -servername client-domain.com

# Security headers
curl -I https://client-domain.com | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options)"
```

**Security Checklist**:
- [ ] **HTTPS Enabled**: Valid SSL certificate
- [ ] **Security Headers**: HSTS, X-Frame-Options, etc.
- [ ] **Database Encryption**: Data encrypted at rest
- [ ] **API Security**: Rate limiting and input validation
- [ ] **Authentication**: Secure access controls
- [ ] **Backup Encryption**: Backups encrypted and tested

#### Purge Functionality
```bash
# Test data purge with proof generation
./scripts/purge_demo.sh

# Verify proof JSON structure
cat /tmp/purge_proof_*.json | jq '.success'
# Expected: true

# Verify zero documents remain
python scripts/load_demo_corpus.py --stats
# Expected: 0 documents, 0 vectors
```

**Purge Validation**:
- [ ] **Purge Execution**: Complete data removal
- [ ] **Proof Generation**: Valid JSON proof created
- [ ] **Hash Verification**: Cryptographic proof valid
- [ ] **Zero State**: No data remains after purge
- [ ] **Restoration**: Fresh corpus can be reloaded

---

## 🧪 Testing and Quality Assurance

### ✅ Automated Test Suite

#### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing

# Required test results:
# test_demo_flow.py: All tests passing
# test_purge.py: All tests passing  
# test_main.py: All tests passing
# Overall coverage: >70%
```

**Backend Test Validation**:
- [ ] **Demo Flow Tests**: Complete RAG pipeline validated
- [ ] **Purge Tests**: Data deletion with proof generation
- [ ] **API Tests**: All endpoints responding correctly
- [ ] **Integration Tests**: Database and cache connectivity
- [ ] **Coverage**: Minimum 70% code coverage achieved

#### Frontend Tests
```bash
cd frontend
npm run test
npm run build
npm run type-check

# All commands must complete successfully
```

**Frontend Test Validation**:
- [ ] **Component Tests**: React components render correctly
- [ ] **Build Success**: Production build completes without errors
- [ ] **Type Checking**: No TypeScript errors
- [ ] **Linting**: Code style consistent
- [ ] **Performance**: Lighthouse scores >90

#### Manual Smoke Tests
- [ ] **Landing Page**: Loads correctly with client branding
- [ ] **Demo Registration**: Email capture works (if enabled)
- [ ] **Document Upload**: File upload completes successfully
- [ ] **Chat Interface**: Questions receive streaming responses
- [ ] **Source Citations**: Sources are clickable and accurate
- [ ] **Export Function**: Conversation export works (if enabled)

---

## 📊 Performance and Monitoring

### ✅ Performance Benchmarks

#### Response Time Validation
```bash
# RAG query performance test
time curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Test question", "organization_id": "demo-org-12345"}'

# Expected: <5 seconds total response time
```

**Performance Checklist**:
- [ ] **Initial Response**: <1 second to first token
- [ ] **Complete Response**: <5 seconds for full answer
- [ ] **Vector Search**: <100ms for similarity search
- [ ] **Cache Hit Rate**: >80% for repeated queries
- [ ] **Memory Usage**: <4GB total system usage
- [ ] **CPU Utilization**: <70% during normal operation

#### Load Testing (Optional)
```bash
# Concurrent user simulation (if required)
ab -n 100 -c 10 http://localhost:3000/
wrk -t12 -c400 -d30s http://localhost:8000/health

# Expected: System remains stable under load
```

**Load Test Validation** (if performed):
- [ ] **Concurrent Users**: 10+ simultaneous users supported
- [ ] **Memory Stability**: No memory leaks during testing
- [ ] **Response Degradation**: <20% performance loss under load
- [ ] **Error Rate**: <1% error rate during load testing

---

## 📚 Documentation and Training

### ✅ Client Documentation

#### User Documentation
- [ ] **Quick Start Guide**: Step-by-step usage instructions
- [ ] **Feature Documentation**: All features explained
- [ ] **FAQ**: Common questions and answers
- [ ] **Troubleshooting**: Common issues and solutions
- [ ] **API Documentation**: If API access provided

#### Administrative Documentation
- [ ] **System Administration**: Maintenance procedures
- [ ] **Backup/Restore**: Data protection procedures
- [ ] **Monitoring**: Health check and monitoring guide
- [ ] **Security**: Security best practices
- [ ] **Compliance**: GDPR and legal compliance guide

#### Technical Documentation
- [ ] **Architecture Overview**: System design documentation
- [ ] **Configuration Guide**: Environment variable reference
- [ ] **Deployment Guide**: Installation and setup procedures
- [ ] **Integration Guide**: API and webhook documentation
- [ ] **Troubleshooting**: Technical issue resolution

### ✅ Client Training

#### End User Training (Day 1)
- [ ] **System Overview**: 30-minute presentation
- [ ] **Hands-on Demo**: 60-minute guided tour
- [ ] **Document Upload**: Upload and management training
- [ ] **Query Techniques**: Effective question formulation
- [ ] **Results Interpretation**: Understanding AI responses
- [ ] **Q&A Session**: 30-minute question period

#### Administrative Training (Day 2)
- [ ] **System Administration**: User management, settings
- [ ] **Content Management**: Document organization, categories
- [ ] **Analytics Review**: Usage reports and insights
- [ ] **Maintenance Tasks**: Routine system maintenance
- [ ] **Security Procedures**: Data protection best practices
- [ ] **Support Contacts**: Escalation procedures

#### Training Validation
- [ ] **User Competency**: Users can perform basic tasks independently
- [ ] **Admin Competency**: Administrators can manage system
- [ ] **Documentation**: All training materials provided
- [ ] **Follow-up**: 30-day follow-up call scheduled
- [ ] **Satisfaction**: Training satisfaction >4/5 rating

---

## 🚀 Go-Live and Handover

### ✅ Production Readiness

#### Final System Validation
- [ ] **End-to-End Test**: Complete user journey validated
- [ ] **Performance Under Load**: System stable under expected usage
- [ ] **Backup Verification**: Backup and restore tested
- [ ] **Monitoring Active**: All monitoring systems operational
- [ ] **Support Contacts**: Emergency contacts established

#### Client Acceptance
- [ ] **Functionality Review**: All required features working
- [ ] **Performance Acceptance**: Response times meet expectations
- [ ] **Training Completion**: All users trained and competent
- [ ] **Documentation Review**: All documentation provided and reviewed
- [ ] **Client Sign-off**: Formal acceptance documented

#### Support Transition
- [ ] **Support Contacts**: 24/7 emergency contact provided
- [ ] **Knowledge Transfer**: Technical handover completed
- [ ] **Monitoring Setup**: Client has access to system metrics
- [ ] **SLA Agreement**: Service level agreement signed
- [ ] **6-Month Support**: Support period activated

---

## 📝 Delivery Checklist Summary

### 🎯 Critical Success Factors

**Technical Validation**:
- [ ] All services healthy and stable
- [ ] Demo corpus loaded and searchable
- [ ] Response times <5 seconds
- [ ] Test suites passing >95%
- [ ] Security measures implemented
- [ ] GDPR compliance verified

**Client Customization**:
- [ ] Branding applied consistently
- [ ] Functional limits configured
- [ ] DPA document accessible
- [ ] Client-specific features enabled

**Training and Documentation**:
- [ ] 2-day training completed
- [ ] All documentation provided
- [ ] Client competency validated
- [ ] Follow-up support scheduled

**Go-Live Readiness**:
- [ ] Production environment stable
- [ ] Monitoring systems active
- [ ] Backup systems tested
- [ ] Support channels established
- [ ] Client formal acceptance

---

## 📋 Sign-off Sheet

**Project**: Raggy AI Assistant Deployment  
**Client**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
**Deployment Date**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
**Project Manager**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### Validation Sign-offs

| Component | Validator | Date | Signature |
|-----------|-----------|------|-----------|
| **Infrastructure** | Technical Lead | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |
| **Application** | QA Engineer | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |
| **Security** | Security Officer | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |
| **Training** | Training Lead | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |
| **Client Acceptance** | Client Representative | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |
| **Final Delivery** | Project Manager | \_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_ |

### Client Satisfaction Survey

**Overall Satisfaction**: ⭐⭐⭐⭐⭐ (Rate 1-5)

**Comments**:
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Areas for Improvement**:
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Future Needs**:
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**Document Version**: 2.0  
**Last Updated**: January 15, 2025  
**Next Review**: Each client deployment

**For questions or clarifications**: support@raggy.fr | +33 1 XX XX XX XX