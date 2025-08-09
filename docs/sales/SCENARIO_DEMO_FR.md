# Scénario de Démo (30 min)

Objectif: démontrer pertinence, vitesse et sécurité sur un corpus FR.

## Préparation (avant démo)
- Déployer l’environnement démo (docker compose minimal).
- Charger un corpus FR (ex: procédures internes, FAQ, contrats exemple).
- Vérifier variables .env (provider LLM, clés), thème et logo.
- Ouvrir frontend assistant (/assistant) et docs d’administration.

## Script
1) Contexte (2 min)
   - "Raggy apporte un assistant IA fiable, sourcé, et isolé par organisation."
   - Montrer la structure multi-tenant et client YAML.
2) Upload & ingestion (5 min)
   - Charger un PDF/Docx; montrer progression et métadonnées.
   - Expliquer chunking adaptatif et index hybride.
3) Chat FR + citations (8 min)
   - Poser 3–4 questions réalistes métier (juridique/qualité/support).
   - Mettre en avant: streaming, citations, filtre par document, reformulation FR.
4) Pertinence & contrôle (5 min)
   - Ajuster top-k ou activer/désactiver reranking.
   - Montrer sources, ouvrir l’extrait exact du document.
5) Sécurité & isolation (5 min)
   - Expliquer RLS, audit, hébergement UE.
   - Montrer configuration par organisation, rotation de clés.
6) Next steps (3 min)
   - Proposer Pack Découverte, planning, livrables.

## Questions fréquentes
- Données: restent isolées par organisation, export/purge possible.
- Modèles: Groq/OpenAI/Anthropic/Azure; on s’adapte aux politiques IT.
- Coûts: abonnement SaaS managé ou licence On-Prem + intégration.
- Mesure qualité: scripts de benchmark de pertinence, panel de test FR.
