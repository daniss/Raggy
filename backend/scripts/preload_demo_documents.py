#!/usr/bin/env python3
"""
Script to pre-load demo documents into the database.
These documents will be available to all demo sessions.
"""

import asyncio
import sys
import os
import uuid
from pathlib import Path

# Add the backend directory to the path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.supabase_client import get_supabase_client
from app.rag import loader
from app.rag.splitter import ContentAwareDocumentSplitter
from app.rag.enhanced_retriever import enhanced_retriever
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Demo organization ID for shared demo documents (using a fixed UUID)
DEMO_BASE_ORG_ID = "00000000-0000-4000-8000-000000000001"

# Demo documents content
DEMO_DOCUMENTS = {
    "Guide_Conformite_RGPD.pdf": """
Guide de Conformité RGPD 2024

INTRODUCTION
Ce guide couvre l'ensemble des obligations réglementaires en matière de protection des données personnelles selon le RGPD. Il détaille les principes fondamentaux, les droits des personnes concernées, les obligations des responsables de traitement et les mesures techniques et organisationnelles à mettre en œuvre.

CHAPITRE 1 - OBLIGATIONS GÉNÉRALES
Les obligations RGPD pour le traitement des données clients incluent l'obtention du consentement explicite, la mise en place de mesures techniques appropriées, la tenue d'un registre des traitements et la désignation d'un DPO si nécessaire. Article 6 RGPD définit les bases légales : consentement, contrat, obligation légale, intérêt vital, mission de service public, intérêt légitime.

CHAPITRE 2 - DROITS DES PERSONNES
Article 15 RGPD - Droit d'accès : La personne concernée a le droit d'obtenir confirmation que des données la concernant sont ou ne sont pas traitées et, lorsqu'elles le sont, l'accès aux données ainsi qu'aux informations sur les finalités, catégories de données, destinataires, durée de conservation et droits de la personne.

Article 16 RGPD - Droit de rectification : La personne concernée a le droit d'obtenir la rectification des données inexactes la concernant.

Article 17 RGPD - Droit à l'effacement "droit à l'oubli" : La personne concernée a le droit d'obtenir l'effacement de données la concernant dans certaines conditions.

CHAPITRE 3 - MESURES TECHNIQUES
Chiffrement des données sensibles, pseudonymisation des données clients, registre des traitements tenu à jour, formation du personnel.

CHAPITRE 4 - DÉLAIS DE RÉPONSE
Maximum 1 mois pour traiter une demande d'exercice de droits.
""",

    "Manuel_Procedures_RH_2024.pdf": """
Manuel des Procédures Ressources Humaines 2024

PRÉSENTATION
Manuel des procédures ressources humaines incluant recrutement, formation, évaluation et gestion des carrières. Mise à jour 2024 avec nouvelles dispositions légales, processus digitalisés et indicateurs de performance RH pour un suivi optimal des collaborateurs.

SECTION 1 - RECRUTEMENT
Procédure de recrutement standardisée : Phase 1 - Définition du besoin et validation budgétaire (J-15), Phase 2 - Sourcing des candidats via sites emploi et réseaux (J-10), Phase 3 - Processus de sélection avec entretiens téléphonique, technique et RH (J-5), Phase 4 - Intégration avec formation sécurité obligatoire et suivi RH.

SECTION 2 - INTÉGRATION
L'intégration d'un nouveau collaborateur comprend la remise du kit d'accueil (badge, matériel, accès), la formation sécurité obligatoire de 2h, la présentation de l'équipe et de l'organisation, ainsi qu'un suivi RH planifié à 1 mois, 3 mois et 6 mois pour évaluer l'adaptation et identifier les besoins de formation.

SECTION 3 - FORMATION
Plan de formation annuel établi en janvier, budget formation 2% de la masse salariale, formations obligatoires (sécurité, RGPD, déontologie), formations métiers selon besoins identifiés lors des entretiens annuels.

SECTION 4 - ÉVALUATION
Entretien annuel d'évaluation entre janvier et mars, fiche d'évaluation standardisée, objectifs SMART, plan de développement individuel, possibilité d'entretien de carrière tous les 6 ans.
""",

    "Contrat_Type_Client.docx": """
Contrat Type Client - Modèle Standard

ARTICLE 1 - OBJET
Le présent contrat a pour objet la fourniture de services conformément aux conditions générales de vente.

ARTICLE 2 - DURÉE
Le contrat prend effet à la signature et est conclu pour une durée déterminée de 12 mois, renouvelable par tacite reconduction.

ARTICLE 3 - CONDITIONS GÉNÉRALES
Article 6 - Conditions de paiement : Les factures sont payables à 30 jours nets pour les particuliers, 45 jours fin de mois pour les professionnels, 60 jours maximum pour les administrations publiques. Modalités : virement bancaire privilégié, chèque pour montants < 1000€, pénalités de retard à 3x taux BCE + 10 points, indemnité forfaitaire 40€.

ARTICLE 4 - PÉNALITÉS DE RETARD
En cas de retard de paiement, le client s'expose à des pénalités au taux de 3 fois le taux de refinancement de la BCE majoré de 10 points, plus une indemnité forfaitaire de 40€ pour frais de recouvrement.

ARTICLE 5 - CLAUSE DE RÉSERVE DE PROPRIÉTÉ
Les marchandises livrées demeurent la propriété du vendeur jusqu'au parfait encaissement du prix.

ARTICLE 6 - CONDITIONS PARTICULIÈRES
Acompte de 30% à la commande pour les nouveaux clients, escompte 2% si paiement sous 10 jours, révision tarifaire annuelle au 1er janvier.
""",

    "Analyse_Fiscale_2024.xlsx": """
Analyse Fiscale et Optimisation 2024

SECTION 1 - CRÉDIT IMPÔT RECHERCHE
Calcul CIR 2024 : 30% des dépenses R&D jusqu'à 100M€, 5% au-delà. Bonus 'jeunes docteurs' +200% pendant 24 mois. Dépenses éligibles : salaires chercheurs (charges incluses), amortissement matériel recherche, veille technologique (max 60k€), sous-traitance (3x coût interne). Justificatifs : description projets, feuilles de temps, factures matériel.

SECTION 2 - OPTIMISATION FISCALE 2024
Anticipation des dépenses en fin d'année, valorisation des brevets et propriété intellectuelle, utilisation du crédit pour réduire l'IS ou demander remboursement.

SECTION 3 - TVA ET DÉDUCTIONS
Règles de déduction TVA, TVA sur prestations de services, TVA intracommunautaire, régime des acomptes provisionnels.

SECTION 4 - TAXES SUR LES SALAIRES
Calcul de la taxe sur les salaires pour les entreprises non assujetties à la TVA, exonérations possibles, déclaration annuelle.

SECTION 5 - PROVISIONS ET AMORTISSEMENTS
Règles d'amortissement dégressif et linéaire, provisions pour charges, provisions pour dépréciation, impact fiscal des provisions.
""",

    "Documentation_Technique_Produit.pdf": """
Documentation Technique Produit - Spécifications Complètes

SECTION 1 - PRÉSENTATION
Documentation technique complète du produit incluant architecture, spécifications, intégrations et procédures de maintenance.

SECTION 2 - ARCHITECTURE
Architecture technique : Backend FastAPI + PostgreSQL + pgvector, Frontend Next.js 14 + TypeScript, Infrastructure Docker + Redis + Nginx. Performance : temps de réponse < 2s (99e percentile), débit 1000 req/s, disponibilité 99.9% SLA, latence < 50ms Europe. Sécurité : TLS 1.3, isolation multi-tenant RLS, audit trail, conformité RGPD native.

SECTION 3 - SPÉCIFICATIONS TECHNIQUES
API REST et streaming (SSE), authentification JWT + Row Level Security, embeddings multilingues (384 dimensions), recherche hybride (dense + sparse).

SECTION 4 - PERFORMANCE
Temps de réponse < 2s (99e percentile), débit : 1000 requêtes/seconde, disponibilité : 99.9% (SLA), latence réseau < 50ms en Europe.

SECTION 5 - SÉCURITÉ
Chiffrement TLS 1.3, isolation multi-tenant (RLS), audit trail complet, conformité RGPD native.

SECTION 6 - INTÉGRATIONS DISPONIBLES
API REST (OpenAPI 3.0), webhooks temps réel, SDK JavaScript/Python, connecteurs Slack, Teams, Zapier.

SECTION 7 - MONITORING
Métriques de performance, logs applicatifs, alertes automatiques, tableau de bord de supervision.
"""
}


async def preload_demo_documents():
    """Pre-load demo documents into the database."""
    
    logger.info("Starting demo document preloading...")
    
    try:
        supabase = get_supabase_client()
        
        # First, create the demo organization if it doesn't exist
        org_result = supabase.table("organizations").select("*").eq("id", DEMO_BASE_ORG_ID).execute()
        if not org_result.data:
            logger.info("Creating demo base organization...")
            org_data = {
                "id": DEMO_BASE_ORG_ID,
                "name": "Demo Base Organization",
                "slug": "demo-base",
                "description": "Shared demo documents for all demo sessions",
                "plan": "demo"
            }
            try:
                supabase.table("organizations").insert(org_data).execute()
                logger.info("Demo base organization created successfully")
            except Exception as e:
                logger.warning(f"Could not create demo organization (may already exist): {e}")
        
        # Check if demo documents already exist
        result = supabase.table("documents").select("*").eq(
            "organization_id", DEMO_BASE_ORG_ID
        ).execute()
        
        if result.data:
            logger.info(f"Demo documents already exist ({len(result.data)} documents). Skipping preload.")
            return
        
        total_chunks = 0
        
        for filename, content in DEMO_DOCUMENTS.items():
            logger.info(f"Processing {filename}...")
            
            # Create document record (only using existing columns)
            doc_id = str(uuid.uuid4())
            doc_data = {
                "id": doc_id,
                "filename": filename,
                "content_type": "application/pdf" if filename.endswith('.pdf') else 
                              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if filename.endswith('.docx') else
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "size_bytes": len(content.encode('utf-8')),
                "file_path": f"/demo/{filename}",
                "status": "completed",
                "uploaded_by": None,  # System upload, no user 
                "organization_id": DEMO_BASE_ORG_ID,
                "chunks_count": 0,
                "metadata": {
                    "extraction_method": "demo_preload",
                    "processing_time": 0.1,
                    "document_type": filename.split('_')[0] if '_' in filename else "Demo"
                }
            }
            
            # Insert document record
            doc_result = supabase.table("documents").insert(doc_data).execute()
            if not doc_result.data:
                logger.error(f"Failed to insert document record for {filename}")
                continue
                
            document_id = doc_result.data[0]["id"]
            
            # Split content into chunks
            text_splitter = ContentAwareDocumentSplitter(chunk_size=400, chunk_overlap=50)
            chunk_docs = text_splitter.split_text(content, metadata={"filename": filename})
            chunks = [doc.page_content for doc in chunk_docs]
            logger.info(f"Created {len(chunks)} chunks for {filename}")
            
            # Process each chunk
            chunk_records = []
            for i, chunk in enumerate(chunks):
                try:
                    # Generate embedding for chunk
                    embedding = await enhanced_retriever.embedding_provider.embed_query_async(chunk)
                    
                    if embedding:
                        chunk_record = {
                            "id": str(uuid.uuid4()),
                            "document_id": document_id,
                            "organization_id": DEMO_BASE_ORG_ID,
                            "content": chunk,
                            "chunk_index": i,
                            "embedding": embedding,
                            "metadata": {
                                "filename": filename,
                                "chunk_index": i,
                                "total_chunks": len(chunks),
                                "chunk_size": len(chunk),
                                "extraction_method": "demo_preload",
                                "document_type": filename.split('_')[0] if '_' in filename else "Demo",
                                "page": i // 3 + 1  # Approximate page number
                            }
                        }
                        chunk_records.append(chunk_record)
                        
                except Exception as e:
                    logger.error(f"Failed to process chunk {i} for {filename}: {e}")
            
            # Batch insert chunks
            if chunk_records:
                try:
                    chunks_result = supabase.table("document_vectors").insert(chunk_records).execute()
                    if chunks_result.data:
                        total_chunks += len(chunk_records)
                        logger.info(f"Inserted {len(chunk_records)} chunks for {filename}")
                        
                        # Update document with chunk count
                        supabase.table("documents").update({
                            "chunks_count": len(chunk_records)
                        }).eq("id", document_id).execute()
                    else:
                        logger.error(f"Failed to insert chunks for {filename}")
                except Exception as e:
                    logger.error(f"Failed to batch insert chunks for {filename}: {e}")
        
        logger.info(f"Demo document preloading completed! Created {total_chunks} total chunks across {len(DEMO_DOCUMENTS)} documents.")
        
    except Exception as e:
        logger.error(f"Failed to preload demo documents: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(preload_demo_documents())