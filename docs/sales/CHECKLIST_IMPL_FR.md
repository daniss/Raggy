# Checklist d’Implémentation (Client)

## Avant-projet
- [ ] Décider du mode d’hébergement (SaaS UE / VPC / On-Prem)
- [ ] Choisir le fournisseur LLM (Groq / OpenAI / Anthropic / Azure)
- [ ] Définir les rôles utilisateurs et l’orga multi-tenant
- [ ] Confirmer les types de documents et volumétrie

## Setup technique
- [ ] Renseigner .env et clés (LLM, stockage, DB)
- [ ] Déployer via docker compose ou K8s (environnements: dev, staging, prod)
- [ ] Créer l’organisation et importer configuration YAML
- [ ] Activer chunking FR et paramètres (taille, overlap, hybrid, reranking)

## Ingestion
- [ ] Définir les connecteurs (upload direct, S3, SharePoint, GDrive)
- [ ] Lancer ingestion initiale et indexation (HNSW + BM25)
- [ ] Valider qualité: top-k, taux de réponses sourcées, temps de réponse

## Sécurité & conformité
- [ ] Vérifier RLS, journalisation, sauvegardes
- [ ] Politique de rétention/purge et RGPD
- [ ] Gestion des accès (SSO si dispo), rotation de clés

## Go-live
- [ ] Formation utilisateurs (1–2h) + guides FR
- [ ] Tableaux de bord d’adoption (sessions, satisfaction)
- [ ] Support et SLA (runbook, escalade)
