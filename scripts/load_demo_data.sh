#!/bin/bash

# Load Demo Data Script
# Populate Raggy with French demo documents

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL=${API_URL:-http://localhost:8000}
DEMO_DIR="./demo_corpus"

echo -e "${GREEN}=== Loading Demo Documents ===${NC}"
echo "API URL: $API_URL"
echo ""

# Check if demo corpus exists
if [ ! -d "$DEMO_DIR" ]; then
    echo -e "${YELLOW}Creating demo corpus...${NC}"
    mkdir -p $DEMO_DIR
    
    # Create sample French documents
    cat > $DEMO_DIR/guide_rgpd.txt << 'EOF'
GUIDE DE CONFORMITÉ RGPD
========================

1. PRINCIPES FONDAMENTAUX
Le Règlement Général sur la Protection des Données (RGPD) impose plusieurs obligations :
- Licéité, loyauté et transparence du traitement
- Limitation des finalités
- Minimisation des données
- Exactitude des données
- Limitation de la conservation
- Intégrité et confidentialité

2. DROITS DES PERSONNES CONCERNÉES
Toute personne dispose des droits suivants :
- Droit d'accès à ses données personnelles
- Droit de rectification des données inexactes
- Droit à l'effacement ("droit à l'oubli")
- Droit à la limitation du traitement
- Droit à la portabilité des données
- Droit d'opposition au traitement

3. OBLIGATIONS DU RESPONSABLE DE TRAITEMENT
- Tenir un registre des traitements
- Réaliser des analyses d'impact (AIPD) si nécessaire
- Notifier les violations de données sous 72h
- Désigner un DPO si requis
- Mettre en place des mesures techniques et organisationnelles

4. SANCTIONS
Les violations du RGPD peuvent entraîner des amendes jusqu'à :
- 20 millions d'euros ou 4% du CA mondial annuel
EOF

    cat > $DEMO_DIR/manuel_rh.txt << 'EOF'
MANUEL DES RESSOURCES HUMAINES 2024
====================================

CHAPITRE 1 : RECRUTEMENT
1.1 Processus de recrutement
- Définition du besoin avec le manager
- Publication de l'offre (interne puis externe)
- Présélection des CV (délai max 10 jours)
- Entretiens (téléphonique puis physique)
- Décision collégiale sous 5 jours
- Proposition d'embauche écrite

1.2 Intégration nouveau collaborateur
Jour 1 : Accueil administratif et remise du kit de bienvenue
Semaine 1 : Formation aux outils et présentation équipes
Mois 1 : Définition des objectifs avec le manager
Mois 3 : Point d'étape intégration
Mois 6 : Fin de période d'essai

CHAPITRE 2 : CONGÉS ET ABSENCES
2.1 Congés payés
- 25 jours ouvrés par an (2.08 jours/mois)
- Demande via SIRH minimum 15 jours avant
- Validation N+1 automatique si < 5 jours
- Validation N+2 requise si > 5 jours consécutifs
- Report possible jusqu'au 31 mai N+1

2.2 RTT
- 12 jours de RTT par an pour les cadres
- Pose libre avec accord du manager
- Non reportables d'une année sur l'autre

CHAPITRE 3 : FORMATION
Budget formation : 2% de la masse salariale
Plan de développement des compétences validé en CSE
Formations obligatoires prioritaires
CPF : accompagnement possible par l'entreprise

CHAPITRE 4 : TÉLÉTRAVAIL
Eligible après 6 mois d'ancienneté
Maximum 2 jours par semaine
Accord écrit obligatoire
Indemnité télétravail : 2.50€/jour
EOF

    cat > $DEMO_DIR/procedures_contentieux.txt << 'EOF'
PROCÉDURES DE GESTION DES CONTENTIEUX COMMERCIAUX
==================================================

I. PHASE PRÉ-CONTENTIEUSE
1. Relance amiable
   - Relance J+30 : email de rappel
   - Relance J+45 : appel téléphonique + courrier
   - Relance J+60 : mise en demeure

2. Négociation
   - Proposition d'échéancier de paiement
   - Médiation commerciale si montant > 10 000€
   - Documentation complète du dossier

II. PHASE CONTENTIEUSE
1. Injonction de payer
   - Montant < 5 000€ : procédure simplifiée
   - Dépôt requête au greffe du tribunal de commerce
   - Délai moyen obtention : 1 mois

2. Assignation au fond
   - Montant > 5 000€ ou contestation
   - Rédaction assignation par avocat
   - Audience de procédure puis de plaidoiries
   - Délai moyen jugement : 6-12 mois

3. Voies d'exécution
   - Signification du jugement par huissier
   - Saisie-attribution sur comptes bancaires
   - Saisie-vente si nécessaire

III. RECOUVREMENT
Taux de recouvrement moyen : 65%
Coût moyen procédure : 15% du montant récupéré
Provision pour créances douteuses : 30% à 90 jours, 100% à 180 jours
EOF

    cat > $DEMO_DIR/fiscalite_entreprise.txt << 'EOF'
GUIDE FISCAL DE L'ENTREPRISE 2024
==================================

1. IMPÔT SUR LES SOCIÉTÉS
Taux normal : 25%
Taux réduit PME : 15% jusqu'à 42 500€ de bénéfice
Conditions taux réduit :
- CA < 10 millions €
- Capital détenu à 75% minimum par des personnes physiques

2. CRÉDIT D'IMPÔT RECHERCHE (CIR)
Taux : 30% des dépenses jusqu'à 100M€, 5% au-delà
Dépenses éligibles :
- Salaires chercheurs et techniciens
- Amortissements matériels de recherche
- Prestations sous-traitées (plafonné)
- Veille technologique (plafonné 60 000€)
- Frais de propriété industrielle

Calcul simplifié :
CIR = (Salaires × 2) × 30%

3. TVA
Taux normal : 20%
Taux intermédiaire : 10% (restauration, transport)
Taux réduit : 5.5% (produits première nécessité)

Obligations déclaratives :
- CA3 mensuelle si TVA > 4 000€/an
- CA3 trimestrielle si TVA < 4 000€/an

4. CONTRIBUTION ÉCONOMIQUE TERRITORIALE
CFE : base foncière × taux commune
CVAE : 1.5% de la VA si CA > 500 000€

5. TAXES SUR LES SALAIRES
Formation professionnelle : 1% masse salariale
Taxe apprentissage : 0.68% masse salariale
Participation construction : 0.45% (> 50 salariés)
EOF
fi

# Function to upload document
upload_document() {
    local file=$1
    local filename=$(basename $file)
    
    echo "Uploading: $filename"
    
    curl -X POST \
        -H "Content-Type: multipart/form-data" \
        -F "file=@$file" \
        -F "category=demo" \
        "$API_URL/api/v1/upload" \
        -s -o /dev/null -w "%{http_code}" | {
            read http_code
            if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
                echo "  ✓ Success"
            else
                echo "  ✗ Failed (HTTP $http_code)"
            fi
        }
    
    sleep 2  # Rate limiting
}

# Upload all demo documents
echo -e "${YELLOW}Uploading documents...${NC}"
for file in $DEMO_DIR/*; do
    if [ -f "$file" ]; then
        upload_document "$file"
    fi
done

# Also upload from toupload directory if exists
if [ -d "./toupload" ]; then
    echo ""
    echo -e "${YELLOW}Uploading additional documents from toupload...${NC}"
    
    # Upload PDFs
    for file in ./toupload/pdf/*.pdf; do
        if [ -f "$file" ]; then
            upload_document "$file"
        fi
    done
    
    # Upload CSVs
    for file in ./toupload/csv/*.csv; do
        if [ -f "$file" ]; then
            upload_document "$file"
        fi
    done
    
    # Upload TXTs
    for file in ./toupload/txt/*.txt; do
        if [ -f "$file" ]; then
            upload_document "$file"
        fi
    done
fi

# Test the system
echo ""
echo -e "${YELLOW}Testing RAG system...${NC}"

test_question() {
    local question=$1
    echo "Q: $question"
    
    response=$(curl -X POST \
        -H "Content-Type: application/json" \
        -d "{\"question\": \"$question\"}" \
        "$API_URL/api/v1/chat" \
        -s 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "A: $(echo $response | jq -r '.answer' 2>/dev/null || echo "Error parsing response")"
    else
        echo "A: Failed to get response"
    fi
    echo ""
}

echo ""
test_question "Quels sont les droits RGPD d'une personne concernée ?"
test_question "Quelle est la procédure de validation des congés ?"
test_question "Comment calculer le crédit d'impôt recherche ?"

echo -e "${GREEN}=== Demo Data Loading Complete ===${NC}"
echo "Documents loaded and RAG system tested"
echo "You can now access the assistant at http://localhost:3000"