# Corpus de démonstration Raggy

Ce dossier contient des documents d'exemple en français pour tester le système RAG.

## Contenu

- **Juridique** : Guides RGPD, procédures contentieuses
- **RH** : Manuels des ressources humaines, politiques
- **Fiscal** : Guides fiscaux, calculs CIR
- **Technique** : Documentation produits, spécifications

## Utilisation

Ces documents sont automatiquement chargés lors de l'exécution de :
```bash
./scripts/load_demo_data.sh
```

## Questions d'exemple

Après avoir chargé les documents, vous pouvez poser ces questions :

### RGPD & Juridique
- "Quels sont les droits des personnes concernées par le RGPD ?"
- "Quelle est la procédure d'injonction de payer ?"
- "Comment gérer un contentieux commercial ?"

### Ressources Humaines  
- "Quelle est la procédure de recrutement ?"
- "Comment valider une demande de congés ?"
- "Combien de jours de RTT pour les cadres ?"

### Fiscal
- "Comment calculer le crédit d'impôt recherche ?"
- "Quel est le taux d'IS pour les PME ?"
- "Quelles sont les obligations déclaratives TVA ?"

### Technique
- "Quelles sont les spécifications du produit ?"
- "Comment installer le logiciel ?"
- "Quelle est la procédure de maintenance ?"

## Format des documents

- **PDF** : Documents complexes avec mise en forme
- **TXT** : Documents simples, traitement rapide  
- **CSV** : Données structurées
- **DOCX** : Documents Word standard

## Performance

- **Indexation** : ~1-2 minutes pour l'ensemble
- **Requêtes** : < 2 secondes en moyenne
- **Précision** : 85-95% selon la complexité