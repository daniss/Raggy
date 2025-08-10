"""Demo-specific health check endpoints."""

import logging
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["demo-health"])


@router.get("/status")
async def get_demo_status() -> Dict[str, Any]:
    """Get demo sandbox health and availability status."""
    try:
        demo_status = {
            "status": "available",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "raggy-demo-sandbox",
            "version": settings.api_version,
            "environment": settings.environment,
            "checks": {}
        }
        
        # Check demo organization exists
        demo_org_id = getattr(settings, 'demo_org_id', 'demo-org-12345')
        try:
            org_result = supabase_client.table("organizations").select("id,name").eq("id", demo_org_id).execute()
            if org_result.data:
                demo_status["checks"]["demo_organization"] = {
                    "status": "available",
                    "org_id": demo_org_id,
                    "org_name": org_result.data[0].get("name", "Demo Organization")
                }
            else:
                demo_status["checks"]["demo_organization"] = {
                    "status": "missing",
                    "org_id": demo_org_id,
                    "message": "Demo organization not found in database"
                }
                demo_status["status"] = "degraded"
        except Exception as e:
            demo_status["checks"]["demo_organization"] = {
                "status": "error",
                "error": str(e)[:100]
            }
            demo_status["status"] = "degraded"
        
        # Check demo corpus availability
        try:
            docs_result = supabase_client.table("documents").select("id,title,file_size").eq("organization_id", demo_org_id).execute()
            doc_count = len(docs_result.data) if docs_result.data else 0
            
            demo_status["checks"]["demo_corpus"] = {
                "status": "available" if doc_count > 0 else "empty",
                "document_count": doc_count,
                "message": f"{doc_count} demo documents available" if doc_count > 0 else "No demo documents found"
            }
            
            if doc_count == 0:
                demo_status["status"] = "degraded"
                
        except Exception as e:
            demo_status["checks"]["demo_corpus"] = {
                "status": "error",
                "error": str(e)[:100]
            }
            demo_status["status"] = "degraded"
        
        # Check vector embeddings for demo corpus
        try:
            vectors_result = supabase_client.table("document_vectors").select("id,document_id").eq("organization_id", demo_org_id).execute()
            vector_count = len(vectors_result.data) if vectors_result.data else 0
            
            demo_status["checks"]["demo_vectors"] = {
                "status": "available" if vector_count > 0 else "empty",
                "vector_count": vector_count,
                "message": f"{vector_count} vector embeddings ready" if vector_count > 0 else "No vector embeddings found"
            }
            
        except Exception as e:
            demo_status["checks"]["demo_vectors"] = {
                "status": "error", 
                "error": str(e)[:100]
            }
        
        # Add demo capabilities
        demo_status["capabilities"] = {
            "chat": True,
            "document_upload": getattr(settings, 'enable_upload', True),
            "document_search": True,
            "demo_corpus": True,
            "rag_pipeline": True
        }
        
        # Add demo configuration
        demo_status["configuration"] = {
            "max_documents": getattr(settings, 'max_documents', 1000),
            "max_upload_size_mb": getattr(settings, 'max_upload_size_mb', 50),
            "embedding_model": getattr(settings, 'embedding_model', 'intfloat/multilingual-e5-large-instruct'),
            "llm_model": getattr(settings, 'groq_model', 'deepseek-r1-distill-llama-70b'),
            "demo_org_id": demo_org_id
        }
        
        return demo_status
        
    except Exception as e:
        logger.error(f"Demo status check failed: {e}")
        raise HTTPException(status_code=503, detail="Demo service unavailable")


@router.get("/corpus-stats")
async def get_demo_corpus_stats() -> Dict[str, Any]:
    """Get detailed statistics about the demo corpus."""
    try:
        demo_org_id = getattr(settings, 'demo_org_id', 'demo-org-12345')
        
        # Get document statistics
        docs_result = supabase_client.table("documents").select("*").eq("organization_id", demo_org_id).execute()
        documents = docs_result.data or []
        
        # Get vector statistics
        vectors_result = supabase_client.table("document_vectors").select("document_id,chunk_index").eq("organization_id", demo_org_id).execute()
        vectors = vectors_result.data or []
        
        # Calculate statistics
        total_size = sum(doc.get('file_size', 0) for doc in documents)
        doc_types = {}
        for doc in documents:
            content_type = doc.get('content_type', 'unknown')
            if content_type not in doc_types:
                doc_types[content_type] = 0
            doc_types[content_type] += 1
        
        # Group vectors by document
        vectors_by_doc = {}
        for vector in vectors:
            doc_id = vector['document_id']
            if doc_id not in vectors_by_doc:
                vectors_by_doc[doc_id] = 0
            vectors_by_doc[doc_id] += 1
        
        corpus_stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "demo_org_id": demo_org_id,
            "documents": {
                "total_count": len(documents),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / 1024 / 1024, 2),
                "types": doc_types,
                "sample_titles": [doc.get('title', 'Untitled')[:50] for doc in documents[:5]]
            },
            "vectors": {
                "total_count": len(vectors),
                "documents_with_vectors": len(vectors_by_doc),
                "avg_chunks_per_doc": round(len(vectors) / len(documents), 1) if documents else 0
            },
            "readiness": {
                "documents_loaded": len(documents) > 0,
                "vectors_generated": len(vectors) > 0,
                "ready_for_chat": len(documents) > 0 and len(vectors) > 0
            }
        }
        
        return corpus_stats
        
    except Exception as e:
        logger.error(f"Demo corpus stats failed: {e}")
        raise HTTPException(status_code=503, detail="Failed to get demo corpus statistics")


@router.get("/recommended-queries")
async def get_recommended_demo_queries() -> Dict[str, Any]:
    """Get recommended queries for testing the demo corpus."""
    try:
        demo_org_id = getattr(settings, 'demo_org_id', 'demo-org-12345')
        
        # Get available document categories from the corpus
        docs_result = supabase_client.table("documents").select("title,content_type").eq("organization_id", demo_org_id).execute()
        documents = docs_result.data or []
        
        # Prepare recommended queries based on available content
        recommended_queries = {
            "timestamp": datetime.utcnow().isoformat(),
            "demo_org_id": demo_org_id,
            "document_count": len(documents),
            "queries": {
                "juridique": [
                    "Quelles sont les obligations du responsable de traitement selon le RGPD ?",
                    "Comment procéder à une analyse d'impact (AIPD) ?",
                    "Quelle est la procédure d'injonction de payer ?"
                ],
                "rh": [
                    "Quelle est la procédure complète de recrutement ?",
                    "Comment calculer les jours de RTT pour un cadre ?",
                    "Quelles sont les étapes de l'évaluation annuelle ?"
                ],
                "fiscal": [
                    "Comment optimiser le crédit d'impôt recherche ?",
                    "Quels sont les taux du CIR en 2024 ?",
                    "Quelles dépenses sont éligibles au CIR ?"
                ],
                "technique": [
                    "Quelles sont les spécifications de l'API Raggy ?",
                    "Comment installer Raggy en production ?",
                    "Quels sont les prérequis système pour Raggy ?"
                ],
                "commercial": [
                    "Quelle est notre grille tarifaire pour les PME ?",
                    "Quels sont nos principaux secteurs clients ?",
                    "Quel est le prix de l'offre Enterprise ?"
                ]
            },
            "quick_tests": [
                "Qu'est-ce que le RGPD ?",
                "Comment fonctionne Raggy ?",
                "Combien coûte la solution ?"
            ],
            "available_documents": [doc.get('title', 'Untitled')[:60] for doc in documents[:10]]
        }
        
        return recommended_queries
        
    except Exception as e:
        logger.error(f"Failed to get recommended queries: {e}")
        raise HTTPException(status_code=503, detail="Failed to get recommended demo queries")