# 🏢 Raggy - Plateforme SaaS RAG pour Entreprises Françaises

[![CI/CD](https://github.com/username/raggy/actions/workflows/ci.yml/badge.svg)](https://github.com/username/raggy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

**Un assistant IA privé pour chaque entreprise, capable de comprendre ses documents internes et d'y répondre intelligemment via un chat sécurisé. Multi-utilisateurs. Multi-entreprises.**

## 🎯 Vision & Objectif

Raggy est une plateforme SaaS clé-en-main pour les entreprises françaises (TPE/PME principalement) leur permettant de :

- **📄 Ingérer leurs documents internes** (PDF, CSV, docs métiers...)
- **🤖 Poser des questions à un assistant IA privé** alimenté par leurs propres données
- **👥 Collaborer entre collègues** dans un espace sécurisé et isolé
- **🔐 Garantir la sécurité des données** avec une séparation stricte par organisation

## ✨ Fonctionnalités Clés

### 🏢 Multi-tenant dès le MVP
- **Une organisation = une entreprise cliente** avec données isolées
- **Un utilisateur appartient à une seule organisation** (contrainte MVP)
- **Chaque organisation dispose de** :
  - Son propre espace de documents vectorisés
  - Ses membres avec gestion des rôles
  - Son historique de chat privé
- **Séparation stricte des données** via `org_id` dans toutes les tables + RLS PostgreSQL

### 🔐 Authentification & Gestion d'Équipe
- **Supabase Auth** avec email/password sécurisé
- **Gestion de session persistante** avec JWT
- **Rôles MVP** :
  - **Admin** : créateur de l'organisation + invitation de membres par email
  - **Membre** : accès aux documents et à l'IA de l'organisation

### 📤 Upload & Ingestion de Documents
- **Types supportés** : PDF (par lot ou seul), CSV, TXT, Markdown, DOC/DOCX
- **Pipeline ingestion automatisé** :
  - Upload ➝ Split en chunks ➝ Embeddings ➝ Stockage vectoriel (pgvector)
  - Chaque chunk lié à `document_id`, `org_id`, `user_id`
- **Interface glisser-déposer** avec aperçu des documents ingérés

### 💬 Chat IA (RAG) Privé
- **Interface type ChatGPT** avec streaming en temps réel
- **Contexte limité aux documents de l'organisation uniquement**
- **LLM alimenté par Groq API** (deepseek-r1-distill-llama-70b)
- **Réponses avec sources** pour traçabilité et transparence

### 🎨 Interface Utilisateur
- **Next.js 14 + shadcn/ui** pour une expérience moderne
- **Pages principales** :
  - Dashboard d'organisation
  - Upload de documents par équipe
  - Interface chat collaborative
  - Paramètres de l'organisation
- **Responsive design** optimisé mobile et desktop

## 🚀 Démarrage Rapide

### Prérequis

- **Docker & Docker Compose** (recommandé)
- **Python 3.11+** & **Node.js 18+** (pour le développement local)
- **Comptes requis** :
  - [Groq API](https://console.groq.com/) pour l'IA
  - [Supabase](https://supabase.com/) pour l'auth et la DB

### Installation avec Docker (Recommandé)

1. **Cloner le repository**
```bash
git clone https://github.com/username/raggy.git
cd raggy
```

2. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos clés API Groq et Supabase
```

3. **Lancer les services**
```bash
docker-compose up -d
```

4. **Accéder à l'application**
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8000
- **Docs API** : http://localhost:8000/docs
- **Admin Dashboard** : http://localhost:3000/admin

### Installation Locale (Développement)

<details>
<summary>Cliquer pour voir les instructions détaillées</summary>

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
# Configurer les variables dans .env
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configurer les variables dans .env.local
npm run dev
```
</details>

## 🏗️ Architecture Technique

```
raggy/
├── backend/              # FastAPI + RAG Pipeline Multi-tenant
│   ├── app/
│   │   ├── api/         # Routers (chat, upload, analytics, organizations)
│   │   ├── core/        # Configuration, dependencies, auth
│   │   ├── models/      # Pydantic schemas + Organization models
│   │   ├── rag/         # RAG components (Supabase pgvector)
│   │   └── db/          # Database clients + Multi-tenant queries
│   └── requirements.txt
├── frontend/            # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/         # App Router pages (org-focused)
│   │   ├── components/  # React components (team collaboration)
│   │   └── utils/       # API clients, auth utilities
│   └── package.json
├── docker-compose.yml   # Services orchestration
└── .github/workflows/   # CI/CD pipeline
```

### Stack Technique Multi-tenant

**Backend**
- **FastAPI** : API REST haute performance avec organisation scoping
- **LangChain** : Framework RAG avec isolation des données par organisation
- **Supabase pgvector** : Base de données vectorielle avec RLS intégré
- **Groq API** : Modèles IA ultra-rapides (deepseek-r1-distill-llama-70b)
- **PostgreSQL + RLS** : Isolation des données par organisation automatique

**Frontend**
- **Next.js 14** : Framework React avec App Router et Server Components
- **TypeScript** : Typage statique pour la fiabilité entreprise
- **Tailwind CSS + shadcn/ui** : Design system cohérent et professionnel
- **Supabase Auth** : Authentification sécurisée avec gestion d'équipe

**DevOps & Production**
- **Docker** : Containerisation pour déploiement simplifié
- **GitHub Actions** : CI/CD automatisé avec tests multi-tenant
- **Redis** : Cache et sessions pour performance
- **Monitoring** : Logs et métriques par organisation

## 📋 Variables d'Environnement

### Backend (.env)
```env
# API Core
GROQ_API_KEY=your_groq_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://user:pass@localhost:5432/raggy

# SaaS Configuration
DEFAULT_ORG_PLAN=free
MAX_ORGS_PER_USER=1
MAX_USERS_PER_ORG_FREE=10
MAX_DOCUMENTS_PER_ORG_FREE=100
MAX_STORAGE_MB_PER_ORG_FREE=500

# RAG Configuration
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
RETRIEVAL_K=3
LLM_TEMPERATURE=0.0
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_NAME="Raggy - Assistant IA Privé"
NEXT_PUBLIC_APP_DESCRIPTION="Plateforme SaaS RAG - Un assistant IA privé pour chaque entreprise"
```

## 🔧 Configuration Multi-tenant

### Base de Données
```sql
-- Exemple de structure multi-tenant avec RLS
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    filename VARCHAR NOT NULL,
    content_type VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS automatique par organisation
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_isolation ON documents 
    USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### Limites par Plan
```python
# Configuration SaaS dans settings
PLAN_LIMITS = {
    'free': {
        'max_users': 10,
        'max_documents': 100,
        'max_storage_mb': 500,
        'api_calls_per_month': 1000
    },
    'pro': {
        'max_users': 50,
        'max_documents': 1000,
        'max_storage_mb': 5000,
        'api_calls_per_month': 10000
    }
}
```

## 📖 Documentation

- **[Guide d'Architecture Multi-tenant](docs/architecture.md)** : Design et séparation des données
- **[Guide de Déploiement SaaS](docs/deployment.md)** : Production setup avec monitoring
- **[Guide Admin Organisation](docs/admin_guide.md)** : Gestion d'équipe et paramètres
- **[API Reference](http://localhost:8000/docs)** : Documentation interactive des endpoints

## 🧪 Tests

```bash
# Backend - Tests multi-tenant
cd backend
pytest tests/ -v --cov=app

# Frontend - Tests composants
cd frontend
npm test
npm run type-check
```

## 🚢 Déploiement Production

### Docker Production
```bash
# Configuration production
cp .env.example .env.production
# Configurer les variables pour la production avec domaines réels

# Lancer en mode production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Déploiement Cloud SaaS

<details>
<summary>Options de déploiement scalable</summary>

Le projet inclut des configurations pour :
- **AWS ECS/Fargate** avec RDS PostgreSQL et load balancer
- **Google Cloud Run** avec Cloud SQL et IAM
- **Azure Container Instances** avec Azure Database for PostgreSQL

Chaque configuration inclut :
- Auto-scaling basé sur le nombre d'organisations
- Isolation réseau par tenant si nécessaire
- Monitoring et alerting par organisation
- Backup automatisé des données par tenant

</details>

## 📊 Modèle SaaS & Roadmap

### MVP (Q1 2025) ✅
- [x] Architecture multi-tenant complète
- [x] Auth Supabase avec organisations
- [x] RAG pipeline isolé par organisation
- [x] Interface admin & membre
- [x] Upload documents par équipe
- [x] Chat IA collaboratif

### Version 1.1 (Q2 2025)
- [ ] **Facturation intégrée** (Stripe + gestion d'abonnements)
- [ ] **Plans Pro/Enterprise** avec limites étendues
- [ ] **Invitations d'équipe** par email avec onboarding
- [ ] **Analytics d'utilisation** par organisation
- [ ] **API publique** pour intégrations tierces

### Version 1.2 (Q3 2025)
- [ ] **Support multimodal** (images, audio dans documents)
- [ ] **Intégrations** (Slack, Teams, email)
- [ ] **Templates de réponses** personnalisables par organisation
- [ ] **White-label** pour revendeurs/partenaires

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/OrganizationFeature`)
3. Commit vos changements (`git commit -m 'Add organization management'`)
4. Push vers la branche (`git push origin feature/OrganizationFeature`)
5. Ouvrir une Pull Request

## 🐛 Troubleshooting

### Problèmes Multi-tenant Courants

**Données mélangées entre organisations**
```bash
# Vérifier les politiques RLS
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';
```

**Performance avec beaucoup d'organisations**
```bash
# Optimiser les indexes par org_id
CREATE INDEX CONCURRENTLY idx_documents_org_id ON documents(organization_id);
CREATE INDEX CONCURRENTLY idx_vectors_org_id ON document_vectors(organization_id);
```

**Sessions utilisateur non isolées**
```bash
# Vérifier l'isolation des sessions Supabase
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:8000/api/v1/organizations/current
```

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour tous les détails.

## 🙏 Remerciements

- [Groq](https://groq.com/) pour l'API IA ultra-rapide adaptée au SaaS
- [Supabase](https://supabase.com/) pour l'infrastructure auth et DB multi-tenant
- [Next.js](https://nextjs.org/) pour le framework full-stack moderne
- [shadcn/ui](https://ui.shadcn.com/) pour les composants UI professionnels

---

<div align="center">

**[🌟 Star ce repo](https://github.com/username/raggy/stargazers)** • **[🐛 Reporter un bug](https://github.com/username/raggy/issues)** • **[💡 Demander une fonctionnalité](https://github.com/username/raggy/issues)**

**Raggy** - Made with ❤️ for French SMEs
*Chaque entreprise mérite son assistant IA privé*

</div>