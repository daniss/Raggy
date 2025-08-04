# 📖 Guide Utilisateur - Support Chatbot

Ce guide explique comment utiliser efficacement le Support Chatbot, depuis l'interface utilisateur jusqu'au dashboard administrateur.

## 🎯 Table des Matières

1. [Interface Utilisateur](#interface-utilisateur)
2. [Chat Widget](#chat-widget)
3. [Dashboard Admin](#dashboard-admin)
4. [Gestion des Documents](#gestion-des-documents)
5. [Analytics et Rapports](#analytics-et-rapports)
6. [Paramètres et Configuration](#paramètres-et-configuration)
7. [Conseils et Bonnes Pratiques](#conseils-et-bonnes-pratiques)

## Interface Utilisateur

### Page d'Accueil

La page d'accueil présente le chatbot avec :
- **Section Hero** : Présentation du service
- **Fonctionnalités** : Avantages principaux
- **Témoignages** : Retours d'expérience
- **Chat Widget** : Assistant accessible en permanence

![Homepage](../assets/homepage-mockup.png)

### Navigation

```
Header Navigation:
├── Accueil
├── Fonctionnalités
├── Tarifs
├── Support
└── Connexion/Dashboard
```

## Chat Widget

### Activation du Chat

Le chat widget est situé en bas à droite de toutes les pages :

1. **Cliquer sur l'icône** 💬 pour ouvrir
2. **Interface s'anime** avec un effet de slide
3. **Message de bienvenue** s'affiche automatiquement

### Interface du Chat

```
┌─────────────────────────────┐
│ ● Assistant IA         ⚊ ✕ │
├─────────────────────────────┤
│                             │
│  Bonjour ! Comment puis-je  │
│  vous aider ?               │
│                             │
│              Votre message  │
│              se trouvera ici│
│                             │
├─────────────────────────────┤
│ [Tapez votre message...] 📤 │
└─────────────────────────────┘
```

### Fonctionnalités du Chat

#### 1. Messages et Réponses
- **Messages utilisateur** : Alignés à droite (bleu)
- **Réponses IA** : Alignées à gauche (gris)
- **Horodatage** : Affiché sous chaque message
- **Indicateur de frappe** : Points animés pendant la génération

#### 2. Sources et Références
Chaque réponse peut inclure des sources :

```
┌─────────────────────────────┐
│ Voici les informations sur  │
│ nos tarifs...               │
│                             │
│ [Source 1] [Source 2]       │
│ 🕐 14:32                    │
└─────────────────────────────┘
```

**Cliquer sur une source** ouvre une modal avec :
- Nom du fichier source
- Page/section concernée
- Score de pertinence
- Extrait complet du texte

#### 3. Contrôles du Widget
- **Minimiser** ⚊ : Réduit en barre de titre
- **Fermer** ✕ : Ferme complètement le widget
- **Redimensionner** : Adapte automatiquement à l'écran

### Types de Questions Supportées

#### Questions Générales
```
👤 "Quels sont vos horaires d'ouverture ?"
🤖 "Nos horaires sont de 9h à 18h du lundi au vendredi..."
```

#### Questions Techniques
```
👤 "Comment intégrer l'API dans mon site ?"
🤖 "Pour intégrer notre API, voici les étapes :
    1. Obtenez votre clé API depuis le dashboard
    2. Installez le SDK JavaScript..."
```

#### Questions Tarifaires
```
👤 "Quel est le prix pour 100 employés ?"
🤖 "Pour une entreprise de 100 employés, notre offre Enterprise 
    à 499€/mois serait adaptée..."
```

## Dashboard Admin

### Accès au Dashboard

1. **Se connecter** via le bouton "Connexion"
2. **Authentification Supabase** (email/mot de passe)
3. **Redirection automatique** vers `/admin`

### Vue d'Ensemble

Le dashboard principal affiche :

#### Métriques Clés
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 📊 Requêtes │ 📄 Documents│ ⏱️ Temps    │ ✅ Succès   │
│ 1,234       │ 45          │ 1.2s        │ 98.5%       │
│ +12% ↗️      │ Base connais│ Performance │ Satisfaisant│
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Activité Récente
- **Questions posées** avec horodatage
- **Documents ajoutés** par les administrateurs
- **Erreurs système** et résolutions
- **Mises à jour** de configuration

#### État du Système
```
🟢 Système Opérationnel
├── Vector Store : ✅ Connecté (1,234 documents)
├── Groq API : ✅ Fonctionnel
├── Supabase : ✅ Connecté
└── Dernière MAJ : Il y a 2 minutes
```

### Navigation du Dashboard

```
Sidebar Navigation:
├── 📊 Dashboard (vue d'ensemble)
├── 📄 Documents (gestion fichiers)
├── 📈 Analytics (statistiques)
└── ⚙️ Paramètres (configuration)
```

## Gestion des Documents

### Accès à la Section Documents

**Navigation** : Dashboard → Documents

### Upload de Documents

#### 1. Interface d'Upload
```
┌─────────────────────────────────────────────┐
│ 📁 Glisser-déposer vos fichiers ici        │
│    ou cliquer pour sélectionner            │
│                                             │
│ Formats supportés: PDF, DOC, DOCX, TXT, MD │
│ Taille max: 10MB par fichier               │
└─────────────────────────────────────────────┘
```

#### 2. Processus d'Upload
1. **Sélection** : Choisir un ou plusieurs fichiers
2. **Validation** : Vérification format et taille
3. **Upload** : Barre de progression en temps réel
4. **Traitement** : Extraction et segmentation du texte
5. **Indexation** : Ajout à la base vectorielle
6. **Confirmation** : Notification de succès

#### 3. Statuts de Traitement
- 🔄 **En cours** : Document en traitement
- ✅ **Traité** : Prêt pour les requêtes
- ❌ **Erreur** : Problème lors du traitement
- ⏸️ **En attente** : Dans la file d'attente

### Liste des Documents

#### Vue Tableau
```
┌──────────────┬─────────┬─────────┬─────────┬──────────┐
│ Nom Fichier  │ Type    │ Taille  │ Chunks  │ Actions  │
├──────────────┼─────────┼─────────┼─────────┼──────────┤
│ guide-api.pdf│ PDF     │ 2.4 MB  │ 45      │ 👁️ 🗑️    │
│ faq.docx     │ Word    │ 856 KB  │ 23      │ 👁️ 🗑️    │
│ tarifs.md    │ Markdown│ 12 KB   │ 3       │ 👁️ 🗑️    │
└──────────────┴─────────┴─────────┴─────────┴──────────┘
```

#### Actions Disponibles
- **👁️ Prévisualiser** : Voir le contenu et les chunks
- **📊 Analytics** : Statistiques d'utilisation du document
- **🗑️ Supprimer** : Retirer de la base de connaissances
- **📥 Télécharger** : Récupérer le fichier original

### Prévisualisation des Documents

Cliquer sur 👁️ ouvre une modal avec :

#### Onglet Contenu
```
┌─────────────────────────────────────────────┐
│ 📄 guide-api.pdf                            │
├─────────────────────────────────────────────┤
│ Page 1/15                            [🔍 +/-] │
│                                             │
│ API Documentation                           │
│ =================                           │
│                                             │
│ Notre API REST permet d'intégrer...        │
└─────────────────────────────────────────────┘
```

#### Onglet Chunks
```
Chunk 1/45 (Score: 0.95)
─────────────────────
"Pour commencer avec notre API, vous devez d'abord 
obtenir une clé d'authentification depuis votre 
dashboard. Cette clé vous permettra..."

Métadonnées:
• Page: 1
• Position: 0-512
• Mots-clés: API, authentification, clé
```

### Gestion Avancée

#### Recherche et Filtres
```
🔍 [Rechercher dans les documents...]

Filtres:
☐ PDF    ☐ Word    ☐ Markdown    ☐ Texte
☐ Récents ☐ Les plus utilisés ☐ Problèmes

Tri: [📅 Date ↓] [📊 Utilisation] [📏 Taille]
```

#### Actions en Lot
- **Sélection multiple** avec checkboxes
- **Suppression groupée** de documents
- **Export des métadonnées** en CSV
- **Réindexation** de la base vectorielle

## Analytics et Rapports

### Accès aux Analytics

**Navigation** : Dashboard → Analytics

### Métriques Principales

#### 1. Vue d'Ensemble
```
Période: [Derniers 30 jours ▼]        [📊 Exporter]

┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Requêtes    │ Utilisateurs│ Taux Succès │ Temps Moyen │
│ 2,456       │ 189         │ 97.3%       │ 1.4s        │
│ +18% ↗️      │ +23% ↗️      │ +2.1% ↗️     │ -0.2s ↗️     │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### 2. Graphiques Temporels

**Requêtes par Jour**
```
📈 [Graphique linéaire interactif]
   ┌─ 100
   │   
   │     ●──●
   │    ╱    ╲
   │   ●      ●──●
   │ ●          ╲
   └─────────────────────
   Lu Ma Me Je Ve Sa Di
```

**Temps de Réponse**
```
📊 [Histogramme]
   ┌─ 3s
   │   ■
   │   ■ ■
   │ ■ ■ ■ ■
   │ ■ ■ ■ ■ ■
   └─────────────
   <1s 1-2s 2-3s >3s
```

### Analytics Détaillées

#### 3. Questions Populaires
```
Top 10 des sujets:
1. 🔑 API et intégration (23%)
2. 💰 Tarifs et abonnements (18%)
3. 🛠️ Support technique (15%)
4. 📋 Fonctionnalités (12%)
5. 🔒 Sécurité et confidentialité (10%)
...
```

#### 4. Performance par Document
```
Documents les plus consultés:
┌─────────────────┬─────────┬──────────┬─────────┐
│ Document        │ Requêtes│ Pertinence│ Score   │
├─────────────────┼─────────┼──────────┼─────────┤
│ guide-api.pdf   │ 234     │ 94%      │ ⭐⭐⭐⭐⭐ │
│ faq-generale.md │ 189     │ 91%      │ ⭐⭐⭐⭐⭐ │
│ tarifs-2024.pdf │ 156     │ 88%      │ ⭐⭐⭐⭐  │
└─────────────────┴─────────┴──────────┴─────────┘
```

### Rapports et Export

#### Types d'Export
1. **📊 Excel/CSV** : Données brutes pour analyse
2. **📈 PDF** : Rapport formaté avec graphiques
3. **📋 JSON** : Données API pour intégration
4. **📧 Email** : Envoi automatique périodique

#### Configuration des Rapports
```
Rapport Automatique:
├── 📅 Fréquence: [Hebdomadaire ▼]
├── 👥 Destinataires: admin@company.com
├── 📊 Métriques: [Toutes] [Personnalisées]
└── 📧 Format: [PDF + Excel]
```

## Paramètres et Configuration

### Accès aux Paramètres

**Navigation** : Dashboard → Paramètres

### Configuration RAG

#### 1. Paramètres d'Embedding
```
🧠 Modèle d'Embedding
├── Modèle: sentence-transformers/all-MiniLM-L6-v2
├── Dimension: 384
└── Device: [CUDA] [CPU]

📏 Segmentation du Texte
├── Taille chunk: [1000] caractères
├── Chevauchement: [200] caractères
└── Séparateurs: [\n\n, \n, " ", ""]
```

#### 2. Paramètres de Récupération
```
🔍 Recherche Vectorielle
├── Nombre de documents: [3] (k)
├── Score minimum: [0.5]
└── Algorithme: [Similarité Cosinus]

🤖 Génération de Réponse
├── Température: [0.0] (créativité)
├── Tokens max: [1000]
└── Modèle: deepseek-r1-distill-llama-70b
```

### Configuration du Chat

#### 3. Interface Utilisateur
```
🎨 Apparence du Widget
├── Position: [Bas-droite ▼]
├── Couleur principale: [#0BC5EA]
├── Couleur secondaire: [#4A5568]
└── Thème par défaut: [Clair] [Sombre]

💬 Messages par Défaut
├── Message d'accueil: "Bonjour ! Comment puis-je vous aider ?"
├── Message d'erreur: "Désolé, une erreur s'est produite..."
└── Message hors-ligne: "Service temporairement indisponible"
```

#### 4. Comportement du Chat
```
⚙️ Fonctionnalités
├── ☑️ Afficher les sources
├── ☑️ Permettre le feedback
├── ☑️ Historique des conversations
└── ☑️ Mode hors-ligne

🔒 Sécurité
├── ☑️ Authentification requise pour admin
├── ☑️ Rate limiting (10 req/min)
├── ☑️ Filtrage du contenu
└── ☑️ Logging des interactions
```

### Intégrations

#### 5. APIs Externes
```
🔑 Clés API
├── Groq API: [••••••••••••••••] [Tester]
├── Supabase: [••••••••••••••••] [Tester]
└── Sentry (opt): [••••••••••••••••] [Tester]

📧 Notifications
├── Email SMTP: [Configurer]
├── Slack Webhook: [Configurer]
└── Discord Bot: [Configurer]
```

### Sauvegardes et Maintenance

#### 6. Gestion des Données
```
💾 Sauvegardes
├── Auto-backup: [Quotidien ▼]
├── Rétention: [30 jours]
├── Destination: [Local] [Cloud S3]
└── [🔄 Sauvegarder maintenant]

🧹 Maintenance
├── Nettoyage logs: [7 jours]
├── Optimisation DB: [Hebdomadaire]
├── MAJ sécurité: [Automatique]
└── [🔧 Lancer maintenance]
```

## Conseils et Bonnes Pratiques

### Pour les Utilisateurs

#### Poser de Bonnes Questions
```
✅ Bon: "Comment intégrer l'API dans un site WordPress ?"
❌ Éviter: "Ça marche pas"

✅ Bon: "Quel est le prix pour 50 utilisateurs actifs ?"
❌ Éviter: "C'est cher ?"

✅ Bon: "Quelles sont les étapes pour configurer l'authentification SSO ?"
❌ Éviter: "Comment faire ça ?"
```

#### Utiliser les Sources
- **Cliquer sur les sources** pour plus de contexte
- **Vérifier la pertinence** avec le score affiché
- **Consulter le document complet** si nécessaire

### Pour les Administrateurs

#### Qualité des Documents
1. **Format approprié** : Utiliser PDF ou Markdown
2. **Structure claire** : Titres, sous-titres, listes
3. **Contenu à jour** : Réviser régulièrement
4. **Éviter les doublons** : Un seul document par sujet

#### Optimisation RAG
1. **Taille des chunks** : 1000-1500 caractères optimal
2. **Chevauchement** : 15-20% pour la continuité
3. **Nombre de documents** : 3-5 pour la précision
4. **Score minimum** : 0.6-0.7 pour la pertinence

#### Monitoring Régulier
- **Vérifier les métriques** quotidiennement
- **Analyser les questions** sans réponse
- **Mettre à jour les documents** selon les besoins
- **Optimiser les paramètres** selon les performances

### Dépannage Courant

#### Chat ne Répond Pas
1. Vérifier la connexion internet
2. Actualiser la page
3. Vider le cache du navigateur
4. Contacter l'administrateur

#### Réponses Imprécises
1. Reformuler la question plus précisément
2. Utiliser des mots-clés spécifiques
3. Consulter les sources fournies
4. Poser des questions de suivi

#### Problèmes d'Upload
1. Vérifier le format de fichier
2. Réduire la taille si nécessaire
3. Essayer un seul fichier à la fois
4. Contacter le support technique

Ce guide couvre l'utilisation complète du Support Chatbot. Pour des questions spécifiques ou des problèmes techniques, n'hésitez pas à contacter l'équipe de support.