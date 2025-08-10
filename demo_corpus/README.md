# Corpus de démonstration Raggy

Ce dossier contient des documents d'entreprise français authentiques pour démontrer les capacités du système RAG.

## Structure du corpus

```
demo_corpus/
├── juridique/          # Documents légaux et conformité
│   ├── rgpd/          # Guides RGPD et protection des données
│   ├── contentieux/   # Procédures contentieuses
│   └── contrats/      # Modèles de contrats
├── rh/                # Ressources humaines
│   ├── manuels/       # Manuels RH et procédures
│   ├── formation/     # Plans de formation
│   └── evaluation/    # Grilles d'évaluation
├── fiscal/            # Fiscalité et comptabilité
│   ├── guides/        # Guides fiscaux
│   ├── calculs/       # Simulateurs et calculateurs
│   └── declarations/  # Procédures déclaratives
├── technique/         # Documentation technique
│   ├── produits/      # Spécifications produits
│   ├── procedures/    # Procédures techniques
│   └── maintenance/   # Guides de maintenance
└── commercial/        # Documents commerciaux
    ├── analyses/      # Analyses de marché
    ├── clients/       # Données clients (anonymisées)
    └── tarification/  # Grilles tarifaires
```

## Chargement du corpus

### Chargement automatique
```bash
# Charger tous les documents
python scripts/load_demo_corpus.py

# Chargement avec options
python scripts/load_demo_corpus.py --category juridique --dry-run
python scripts/load_demo_corpus.py --force-reload --verbose
```

### Options disponibles
- `--category`: Charger une catégorie spécifique (juridique, rh, fiscal, technique, commercial)
- `--dry-run`: Simulation sans chargement réel
- `--force-reload`: Forcer le rechargement même si déjà présent
- `--verbose`: Affichage détaillé des opérations
- `--cleanup`: Nettoyer le corpus existant avant chargement

## Documents disponibles

### Juridique (15 documents)
- **RGPD** : Guide de conformité, procédures DPO, registres de traitement
- **Contentieux** : Procédures d'injonction de payer, recouvrement amiable
- **Contrats** : Modèles SaaS, CGV, accords de confidentialité

### Ressources Humaines (12 documents)  
- **Manuels** : Procédures RH 2024, guide télétravail, politique formation
- **Recrutement** : Process d'embauche, grilles d'évaluation
- **Administration** : Calcul congés, RTT, note de frais

### Fiscal (10 documents)
- **Guides** : Crédit d'impôt recherche, TVA, IS
- **Calculateurs** : Simulateurs fiscaux Excel
- **Obligations** : Calendrier déclaratif, échéances

### Technique (8 documents)
- **Produits** : Spécifications techniques, documentation API
- **Procédures** : Installation, configuration, maintenance
- **Support** : FAQ technique, résolution incidents

### Commercial (7 documents)
- **Analyses** : Études de marché, veille concurrentielle
- **Clients** : Base clients anonymisée, segmentation
- **Tarification** : Grilles tarifaires, conditions commerciales

## Questions de test recommandées

### RGPD & Conformité
- "Quelles sont les obligations du responsable de traitement selon le RGPD ?"
- "Comment procéder à une analyse d'impact (AIPD) ?"
- "Quels sont les délais de notification des violations de données ?"

### Ressources Humaines
- "Quelle est la procédure complète de recrutement ?"
- "Comment calculer les jours de RTT pour un cadre ?"
- "Quelles sont les étapes d'intégration d'un nouveau salarié ?"

### Fiscalité
- "Comment optimiser le crédit d'impôt recherche ?"
- "Quel est le calendrier des obligations fiscales pour une PME ?"
- "Comment fonctionne la TVA intracommunautaire ?"

### Aspects Techniques
- "Quelles sont les spécifications minimales du serveur ?"
- "Comment configurer l'authentification SSO ?"
- "Quelle est la procédure de sauvegarde recommandée ?"

### Analyse Commerciale
- "Qui sont nos principaux concurrents sur le marché français ?"
- "Quelle est notre grille tarifaire pour les PME ?"
- "Comment segmenter notre clientèle par secteur d'activité ?"

## Formats supportés

- **PDF** : Documents avec mise en forme complexe (15-20 docs)
- **TXT** : Guides et procédures simples (8-10 docs) 
- **CSV** : Données clients, statistiques, tarification (5-7 fichiers)
- **DOCX** : Contrats, manuels, rapports (8-10 docs)
- **XLSX** : Calculateurs, analyses financières (3-5 fichiers)

## Performance et métriques

- **Temps d'indexation** : 3-5 minutes pour le corpus complet (52 documents)
- **Précision RAG** : 88-95% selon la complexité de la question
- **Temps de réponse** : < 2 secondes en moyenne
- **Taille totale** : ~150 MB (documents optimisés)
- **Chunks générés** : ~1,200-1,500 segments de texte

## Maintenance du corpus

### Ajout de nouveaux documents
1. Placer le fichier dans la catégorie appropriée
2. Exécuter `python scripts/load_demo_corpus.py --category <categorie>`
3. Vérifier l'indexation avec une question de test

### Mise à jour
```bash
# Nettoyer et recharger complètement
python scripts/load_demo_corpus.py --cleanup --force-reload

# Ajouter uniquement les nouveaux documents
python scripts/load_demo_corpus.py --incremental
```

### Vérification de l'intégrité
```bash
# Vérifier les doublons
python scripts/load_demo_corpus.py --check-duplicates

# Statistiques du corpus
python scripts/load_demo_corpus.py --stats
```

## Conformité et licences

- Tous les documents sont libres de droits ou sous licence ouverte
- Les données clients sont totalement anonymisées
- Conformité RGPD : aucune donnée personnelle réelle
- Sources publiques : guides officiels, modèles légaux, documentation open source