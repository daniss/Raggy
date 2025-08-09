# Raggy – Proposition Commerciale (FR)

## 1) Résumé exécutif
Raggy est une plateforme RAG (Retrieval-Augmented Generation) prête pour l’entreprise, optimisée pour le français, qui permet d’interroger des documents internes en langage naturel, avec citations sourcées et isolation stricte par organisation. Déploiement rapide (≈4h), architecture modulaire, hébergement UE, et support multi-fournisseurs LLM.

## 2) Problèmes adressés
- Perte de temps pour retrouver la bonne information dans des corpus volumineux (contrats, procédures, FAQ, appels d’offres).
- Risque d’erreur ou de non-conformité faute de source vérifiable.
- Outils IA génériques non adaptés au français, à la confidentialité ou à l’isolement des données par client/organisation.

## 3) Solution Raggy
- Chat IA sur documents internes avec citations et liens vers les sources.
- Optimisation français: embeddings multilingues (E5), tokenisation FR, synonymes.
- Récupération hybride (dense + BM25) et reranking pour une meilleure pertinence.
- Découpage de documents adaptatif par type (juridique, FAQ, technique…), overlap intelligent.
- Multi-tenant sécurisé (RLS), audit, et configuration par client via YAML.
- Abstraction LLM (Groq, OpenAI, Anthropic, Azure) avec bascule automatique.

## 4) Différenciation
- Focalisé FR/UE (RGPD, hébergement UE possible, optimisation linguistique FR).
- Architecture consulting-friendly: couche cœur générique + configuration client + personnalisations ciblées.
- Déploiement express (docker), coûts maîtrisés, et performance validée (HNSW, cache, backoff).

## 5) Cas d’usage prioritaires (ICP)
- Cabinets juridiques et directions juridiques: recherche de clauses, synthèses, veille, conformité.
- ESN/éditeurs: support interne, onboarding, bases de connaissances projets.
- PME/ETI industrielles: procédures qualité, maintenance, sécurité.
- Secteur public & collectivités: accès rapide à la documentation et aux notes internes.

## 6) Offres commerciales
- Pack Découverte (4 semaines, 12–18 k€)
  - Déploiement isolé, ingestion initiale (≤ 2 Go), 1 espace organisation, 10 utilisateurs.
  - Branding léger, prompts FR, FAQ type, atelier d’onboarding (2h), support email.
- Pack Pilote Métier (8–10 semaines, 35–60 k€)
  - Tous les éléments Découverte + intégrations légères (S3/SharePoint), workflows prompts, tuning chunking par type.
  - SSO (si disponible), formation avancée, KPI d’adoption, runbooks.
- SaaS Managé UE (abonnement 2–5 k€/mois)
  - Hébergé UE, multi-orgs, monitoring, mises à jour, SLA business-hours, quotas variables.
- Licence On-Prem/Privé (à partir de 25 k€/an + intégration)
  - Déploiement sur VPC/On-Prem, conformité renforcée, support prioritaire et mises à jour.

Notes: prix indicatifs HT, ajustables selon volumétrie, intégrations et exigences compliance.

## 7) Livrables
- Environnement isolé opérationnel (Docker/K8s), accès admin.
- Espace d’upload et pipeline d’ingestion configuré.
- Interface chat avec citations, recherches, filtres par document.
- Jeu d’exemples/questions tests FR par métier.
- Documentation d’exploitation et guide utilisateur FR.

## 8) Sécurité & conformité
- Isolation par organisation (RLS), audit minimal, chiffrement en transit.
- Hébergement UE, RGPD, politique de purge, sauvegardes.
- Journalisation d’accès et rotation de clés LLM.

## 9) Pré-requis client
- Accès aux documents (formats courants), propriétaire des données.
- Décision d’hébergement (SaaS UE vs privé/On-Prem) et choix LLM.
- Point de contact IT/sécurité, domaine et certificats si besoin.

## 10) Planning type
- Semaine 1: cadrage, accès données, setup et branding.
- Semaine 2: ingestion pilote, tuning FR, scripts de tests.
- Semaine 3: formation, itérations, mesure pertinence.
- Semaine 4: go-live pilote, support, feuille de route.

## 11) KPI & ROI
- Pertinence top-k, taux de réponses avec sources, temps de recherche gagné.
- Adoption (sessions/utilisateurs actifs), satisfaction.
- Réduction tickets internes et temps d’onboarding.

## 12) Prochaines étapes
- Démo guidée (30 min) avec corpus d’exemple FR.
- Atelier cadrage (1h) et estimation.
- Lancement Pack Découverte avec jalons hebdomadaires.

---

Contact: ventes@votre-domaine.fr – Hébergement UE, support FR, essai pilote disponible.
