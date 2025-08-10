# Raggy - Solution RAG sur-mesure pour entreprises

> Assistant IA privé alimenté par vos documents internes

Raggy est une solution RAG (Retrieval-Augmented Generation) clé en main pour les entreprises françaises. Transformez vos documents internes en assistant intelligent avec réponses instantanées et sources citées.

## 🚀 Déploiement rapide

```bash
# 1. Configurer un nouveau client
./scripts/setup_client.sh "Mon Entreprise" docker

# 2. Modifier la configuration
cd clients/mon-entreprise
nano config/.env

# 3. Déployer
./deploy.sh

# 4. Charger les documents de démonstration  
../scripts/load_demo_data.sh
```

**Opérationnel en moins de 10 minutes !**

## 🎯 Fonctionnalités

### ✅ Core Features
- **Assistant IA intelligent** : Réponses en français avec sources citées
- **Upload multi-formats** : PDF, Word, Excel, CSV, TXT
- **Recherche hybride** : Vectorielle + BM25 pour une précision maximale
- **Interface moderne** : Design responsive, optimisé mobile
- **Demo sandbox** : Test gratuit avec données pré-chargées

### 🔒 Sécurité & Conformité
- **100% privé** : Vos données restent chez vous
- **RGPD compliant** : Isolation complète des données
- **Hébergement souverain** : France ou on-premise
- **Chiffrement bout-en-bout** : Sécurité maximale

### 🛠 Technique
- **Backend** : FastAPI + Python (async/await)
- **Frontend** : Next.js 14 + TypeScript
- **Base vectorielle** : PostgreSQL + pgvector
- **IA** : Groq (deepseek-r1) + Embeddings multilingues
- **Cache** : Redis pour les performances

## 📋 Prérequis

### Développement
- Docker & Docker Compose
- Node.js 18+ (pour développement frontend)
- Python 3.9+ (pour développement backend)

### Production
- Docker & Docker Compose
- 4 GB RAM minimum
- 20 GB espace disque
- Clés API Groq

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI       │    │  PostgreSQL     │
│   Frontend      │───▶│   Backend       │───▶│  + pgvector     │
│   (Port 3000)   │    │   (Port 8000)   │    │  (Port 5432)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache)       │
                       │  (Port 6379)    │
                       └─────────────────┘
```

## ⚡ Démarrage rapide

### Démonstration locale

```bash
# Cloner le repository
git clone https://github.com/votre-org/raggy.git
cd raggy

# Lancer avec Docker
docker-compose -f docker-compose.prod.yml up -d

# Charger les données de démo
./scripts/load_demo_data.sh

# Accéder à l'application
open http://localhost:3000
```

### Configuration pour client

```bash
# Créer un nouveau client
./scripts/setup_client.sh "Cabinet Dupont" docker

# Éditer la configuration
cd clients/cabinet-dupont
nano config/.env

# Variables essentielles à configurer :
GROQ_API_KEY=votre_clé_groq
SUPABASE_URL=votre_url_supabase  
SUPABASE_SERVICE_KEY=votre_clé_supabase
CLIENT_NAME="Cabinet Dupont"
```

## 📁 Structure du projet

```
raggy/
├── frontend/                 # Application Next.js
│   ├── src/app/
│   │   ├── page.tsx         # Landing marketing
│   │   ├── demo/            # Sandbox démo
│   │   └── assistant/       # Interface RAG
│   └── components/          # Composants réutilisables
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── api/            # Endpoints REST
│   │   ├── rag/            # Pipeline RAG
│   │   └── core/           # Configuration
│   └── database_schema_simple.sql
├── scripts/                 # Scripts de déploiement
│   ├── setup_client.sh     # Configuration client
│   ├── load_demo_data.sh   # Données de démo
│   └── purge_demo.sh       # Nettoyage
├── clients/                # Déploiements clients
├── archive/                # Fonctionnalités archivées
└── docs/                   # Documentation
```

## 🔧 Configuration

### Variables d'environnement essentielles

```bash
# Client
CLIENT_NAME="Votre Entreprise"
CLIENT_SLUG="votre-entreprise"

# API IA
GROQ_API_KEY="gsk_..."
GROQ_MODEL="deepseek-r1-distill-llama-70b"

# Base de données
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."
DATABASE_URL="postgresql://..."

# Limites
MAX_DOCUMENTS=1000
MAX_UPLOAD_SIZE_MB=50
MAX_QUERIES_PER_DAY=10000
```

### Personnalisation

```bash
# Branding
PRIMARY_COLOR="#1e40af"
LOGO_URL="/logo-client.png"

# Fonctionnalités
ENABLE_UPLOAD=true
ENABLE_EXPORT=true
ENABLE_ANALYTICS=true
ENABLE_DEMO_MODE=false
```

## 🚀 Déploiement

### Option 1 : Docker Compose (Recommandé)

```bash
# Production complète
docker-compose -f docker-compose.prod.yml up -d

# Vérification
docker-compose ps
curl http://localhost/health
```

### Option 2 : Kubernetes

```bash
# Appliquer les manifests
kubectl apply -f k8s/

# Vérifier le déploiement
kubectl get pods
kubectl get services
```

### Option 3 : Standalone

```bash
# Backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend  
npm run build && npm start
```

## 📊 Monitoring

### Scripts de surveillance

```bash
# Statut du système
./monitor.sh

# Nettoyage des données de démo
./purge_demo.sh

# Sauvegarde
./backup.sh
```

### Métriques importantes

- **Documents** : Nombre de docs indexés
- **Vecteurs** : Nombre de chunks vectorisés  
- **Requêtes** : Volume quotidien/mensuel
- **Temps de réponse** : Performance moyenne
- **Taux de satisfaction** : Feedback utilisateur

## 🧪 Tests

```bash
# Tests backend
cd backend
pytest tests/ -v

# Tests frontend
cd frontend
npm run test

# Test complet
./scripts/test_deployment.sh
```

## 📈 Performance

### Optimisations incluses

- **Index HNSW** : Recherche vectorielle 5-10x plus rapide
- **Recherche hybride** : Dense (70%) + Sparse (30%)
- **Reranking** : Cross-encoder pour meilleure pertinence  
- **Cache Redis** : Réponses mises en cache
- **Chunks adaptatifs** : Taille optimale selon le type

### Métriques de référence

- **Temps de réponse** : < 2 secondes moyenne
- **Indexation** : 100 pages/minute  
- **Concurrence** : 50 utilisateurs simultanés
- **Précision** : 85-95% de pertinence selon le domaine

## 💰 Tarification

### Déploiement initial : **15 000€ HT**

**Inclus :**
- ✅ Installation et configuration complète
- ✅ Import de vos documents existants (jusqu'à 1000 docs)
- ✅ Personnalisation interface et workflows
- ✅ Formation de vos équipes (2 jours)
- ✅ Support technique 6 mois inclus
- ✅ Hébergement la première année

**Options :**
- Hébergement géré : 500€/mois
- Maintenance évolutive : 2000€/mois
- Connecteurs API sur-mesure : 3000€
- Formation avancée : 1500€/jour

**ROI moyen constaté : 3-6 mois**

## 🆘 Support

### Auto-diagnostic

```bash
# Vérifier l'état du système
curl http://localhost/health

# Logs en temps réel
docker-compose logs -f

# Espace disque
df -h
```

### Contact

- **Email** : support@raggy.fr
- **Téléphone** : +33 1 XX XX XX XX  
- **Documentation** : https://docs.raggy.fr
- **GitHub Issues** : Pour les bugs et améliorations

### SLA Production

- **Disponibilité** : 99.9%
- **Temps de réponse** : < 4h en jour ouvré
- **Maintenance** : Dimanche 2h-6h (si nécessaire)

## 📜 Licence

**Licence Commerciale**
- Usage en production nécessite une licence commerciale
- Contact : commercial@raggy.fr
- Version de démonstration libre pour évaluation

## 🗺 Roadmap

### Q1 2025
- [ ] Connecteur Microsoft 365
- [ ] Support audio (transcription + RAG)
- [ ] Analytics avancées

### Q2 2025  
- [ ] Multi-langues (anglais, espagnol)
- [ ] API GraphQL
- [ ] Mode collaboratif temps réel

### Q3 2025
- [ ] IA générative avancée
- [ ] Connecteurs métiers (CRM, ERP)
- [ ] Version mobile native

---

## 🇫🇷 Made in France

**Solution conçue et développée en France pour les entreprises françaises.**

*Vos données restent vos données. Conformité RGPD garantie.*

---

**Besoin d'aide ?** 📧 contact@raggy.fr | 📞 +33 1 XX XX XX XX