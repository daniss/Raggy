"""Comprehensive validation utilities for RAG system components."""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of a validation check."""
    is_valid: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    severity: str = "info"  # info, warning, error


@dataclass
class ComponentValidation:
    """Validation results for a component."""
    component_name: str
    overall_status: str
    checks: List[ValidationResult]
    score: float  # 0-100


class RAGSystemValidator:
    """Comprehensive RAG system validator."""
    
    def __init__(self):
        """Initialize the validator."""
        self.validation_results = {}
    
    def validate_embedding_model(self) -> ComponentValidation:
        """Validate embedding model configuration and functionality."""
        checks = []
        
        try:
            from app.core.config import settings
            
            # Check model configuration
            model_name = settings.embedding_model
            is_instruct = "instruct" in model_name.lower()
            
            checks.append(ValidationResult(
                is_valid=True,
                message=f"Embedding model configured: {model_name}",
                details={"model_name": model_name, "is_instruct": is_instruct}
            ))
            
            # Check if it's the optimized model
            if model_name == "dangvantuan/sentence-camembert-base":
                checks.append(ValidationResult(
                    is_valid=True,
                    message="Using optimized instruct model",
                    severity="info"
                ))
            else:
                checks.append(ValidationResult(
                    is_valid=True,
                    message="Not using latest optimized model",
                    severity="warning",
                    details={"recommended": "dangvantuan/sentence-camembert-base"}
                ))
            
            # Try to validate embedder functionality
            try:
                from app.rag.embedder import embedder
                
                # Test basic functionality
                test_embedding = embedder.embed_query("test query")
                if test_embedding and len(test_embedding) > 0:
                    checks.append(ValidationResult(
                        is_valid=True,
                        message=f"Embedder functional with dimension {len(test_embedding)}",
                        details={"dimension": len(test_embedding)}
                    ))
                    
                    # Check expected dimension
                    expected_dim = 1024
                    if len(test_embedding) == expected_dim:
                        checks.append(ValidationResult(
                            is_valid=True,
                            message="Embedding dimension matches expected 1024"
                        ))
                    else:
                        checks.append(ValidationResult(
                            is_valid=False,
                            message=f"Unexpected embedding dimension: {len(test_embedding)}, expected {expected_dim}",
                            severity="warning"
                        ))
                else:
                    checks.append(ValidationResult(
                        is_valid=False,
                        message="Embedder returned empty or invalid embedding",
                        severity="error"
                    ))
                    
            except Exception as e:
                checks.append(ValidationResult(
                    is_valid=False,
                    message=f"Embedder functionality test failed: {e}",
                    severity="error"
                ))
                
        except Exception as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Embedding model validation failed: {e}",
                severity="error"
            ))
        
        # Calculate score
        valid_checks = sum(1 for check in checks if check.is_valid)
        score = (valid_checks / len(checks)) * 100 if checks else 0
        
        overall_status = "healthy" if score >= 80 else "degraded" if score >= 60 else "unhealthy"
        
        return ComponentValidation(
            component_name="embedding_model",
            overall_status=overall_status,
            checks=checks,
            score=score
        )
    
    def validate_adaptive_chunking(self) -> ComponentValidation:
        """Validate adaptive chunking implementation."""
        checks = []
        
        try:
            from app.rag.adaptive_splitter import AdaptiveDocumentSplitter, DocumentType
            from langchain.schema import Document
            
            # Check implementation exists
            checks.append(ValidationResult(
                is_valid=True,
                message="Adaptive splitter implementation available"
            ))
            
            # Test basic functionality
            splitter = AdaptiveDocumentSplitter()
            
            # Check document types
            doc_types = len(DocumentType)
            checks.append(ValidationResult(
                is_valid=doc_types >= 7,
                message=f"Document types supported: {doc_types}",
                details={"count": doc_types, "minimum_expected": 7}
            ))
            
            # Test with sample document
            test_doc = Document(
                page_content="This is a test document for validation purposes. " * 50,
                metadata={"filename": "test.txt"}
            )
            
            try:
                analysis = splitter.analyze_document(test_doc)
                checks.append(ValidationResult(
                    is_valid=True,
                    message=f"Document analysis functional: detected type {analysis.document_type.value}",
                    details={
                        "detected_type": analysis.document_type.value,
                        "complexity": analysis.content_complexity,
                        "structure_score": analysis.structure_score
                    }
                ))
                
                # Test splitting
                chunks = splitter.split_documents([test_doc])
                checks.append(ValidationResult(
                    is_valid=len(chunks) > 0,
                    message=f"Document splitting functional: {len(chunks)} chunks created",
                    details={"chunks_created": len(chunks)}
                ))
                
            except Exception as e:
                checks.append(ValidationResult(
                    is_valid=False,
                    message=f"Adaptive splitter functionality test failed: {e}",
                    severity="error"
                ))
            
        except ImportError as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Adaptive splitter not available: {e}",
                severity="error"
            ))
        except Exception as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Adaptive chunking validation failed: {e}",
                severity="error"
            ))
        
        # Calculate score
        valid_checks = sum(1 for check in checks if check.is_valid)
        score = (valid_checks / len(checks)) * 100 if checks else 0
        
        overall_status = "healthy" if score >= 80 else "degraded" if score >= 60 else "unhealthy"
        
        return ComponentValidation(
            component_name="adaptive_chunking",
            overall_status=overall_status,
            checks=checks,
            score=score
        )
    
    def validate_database_schema(self) -> ComponentValidation:
        """Validate database schema and migrations."""
        checks = []
        
        # Check migration files exist
        migrations_dir = Path(__file__).parent.parent.parent / "migrations"
        
        if migrations_dir.exists():
            migration_files = list(migrations_dir.glob("*.sql"))
            checks.append(ValidationResult(
                is_valid=len(migration_files) >= 2,
                message=f"Migration files found: {len(migration_files)}",
                details={"files": [f.name for f in migration_files]}
            ))
            
            # Check for HNSW optimization migration
            hnsw_migration = migrations_dir / "002_optimize_vector_index.sql"
            if hnsw_migration.exists():
                content = hnsw_migration.read_text()
                has_hnsw = "USING hnsw" in content
                has_1024_dim = "vector(1024)" in content
                
                checks.append(ValidationResult(
                    is_valid=has_hnsw,
                    message="HNSW index migration available" if has_hnsw else "HNSW index migration missing",
                    severity="info" if has_hnsw else "warning"
                ))
                
                checks.append(ValidationResult(
                    is_valid=has_1024_dim,
                    message="1024-dimensional vector support available" if has_1024_dim else "1024-dimensional vectors not configured",
                    severity="info" if has_1024_dim else "warning"
                ))
            else:
                checks.append(ValidationResult(
                    is_valid=False,
                    message="HNSW optimization migration not found",
                    severity="warning"
                ))
        else:
            checks.append(ValidationResult(
                is_valid=False,
                message="Migrations directory not found",
                severity="error"
            ))
        
        # Calculate score
        valid_checks = sum(1 for check in checks if check.is_valid)
        score = (valid_checks / len(checks)) * 100 if checks else 0
        
        overall_status = "healthy" if score >= 80 else "degraded" if score >= 60 else "unhealthy"
        
        return ComponentValidation(
            component_name="database_schema",
            overall_status=overall_status,
            checks=checks,
            score=score
        )
    
    def validate_configuration(self) -> ComponentValidation:
        """Validate system configuration."""
        checks = []
        
        try:
            from app.core.config import settings
            
            # Check optimization flags
            optimization_flags = {
                'use_hybrid_search': getattr(settings, 'use_hybrid_search', False),
                'use_reranking': getattr(settings, 'use_reranking', False),
                'use_query_enhancement': getattr(settings, 'use_query_enhancement', False),
                'use_semantic_chunking': getattr(settings, 'use_semantic_chunking', False),
                'use_adaptive_chunking': getattr(settings, 'use_adaptive_chunking', False),
            }
            
            enabled_optimizations = sum(optimization_flags.values())
            total_optimizations = len(optimization_flags)
            
            checks.append(ValidationResult(
                is_valid=enabled_optimizations >= 4,
                message=f"Optimizations enabled: {enabled_optimizations}/{total_optimizations}",
                details=optimization_flags,
                severity="info" if enabled_optimizations >= 4 else "warning"
            ))
            
            # Check model configuration
            model_check = settings.embedding_model == "dangvantuan/sentence-camembert-base"
            checks.append(ValidationResult(
                is_valid=model_check,
                message="Embedding model optimally configured" if model_check else "Using non-optimal embedding model",
                details={"current_model": settings.embedding_model},
                severity="info" if model_check else "warning"
            ))
            
            # Check hybrid search weights
            dense_weight = getattr(settings, 'dense_weight', 0.7)
            sparse_weight = getattr(settings, 'sparse_weight', 0.3)
            
            weights_sum = abs((dense_weight + sparse_weight) - 1.0) < 0.01
            checks.append(ValidationResult(
                is_valid=weights_sum,
                message=f"Hybrid search weights properly configured: dense={dense_weight}, sparse={sparse_weight}",
                details={"dense_weight": dense_weight, "sparse_weight": sparse_weight},
                severity="info" if weights_sum else "warning"
            ))
            
        except Exception as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Configuration validation failed: {e}",
                severity="error"
            ))
        
        # Calculate score
        valid_checks = sum(1 for check in checks if check.is_valid)
        score = (valid_checks / len(checks)) * 100 if checks else 0
        
        overall_status = "healthy" if score >= 80 else "degraded" if score >= 60 else "unhealthy"
        
        return ComponentValidation(
            component_name="configuration",
            overall_status=overall_status,
            checks=checks,
            score=score
        )
    
    def validate_system_integration(self) -> ComponentValidation:
        """Validate system integration and imports."""
        checks = []
        
        try:
            # Test imports
            from app.rag import adaptive_splitter, embedder, hybrid_retriever, qa_chain
            
            checks.append(ValidationResult(
                is_valid=True,
                message="Core RAG components import successfully"
            ))
            
            # Check if components are properly initialized
            components = {
                'adaptive_splitter': adaptive_splitter,
                'embedder': embedder,
                'hybrid_retriever': hybrid_retriever,
                'qa_chain': qa_chain
            }
            
            for name, component in components.items():
                if component is not None:
                    checks.append(ValidationResult(
                        is_valid=True,
                        message=f"{name} properly initialized"
                    ))
                else:
                    checks.append(ValidationResult(
                        is_valid=False,
                        message=f"{name} not initialized",
                        severity="warning"
                    ))
            
            # Check upload API integration
            try:
                from app.api.upload import adaptive_splitter as upload_adaptive_splitter
                checks.append(ValidationResult(
                    is_valid=True,
                    message="Upload API integration available"
                ))
            except ImportError:
                checks.append(ValidationResult(
                    is_valid=False,
                    message="Upload API integration missing",
                    severity="warning"
                ))
            
        except ImportError as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Import validation failed: {e}",
                severity="error"
            ))
        except Exception as e:
            checks.append(ValidationResult(
                is_valid=False,
                message=f"Integration validation failed: {e}",
                severity="error"
            ))
        
        # Calculate score
        valid_checks = sum(1 for check in checks if check.is_valid)
        score = (valid_checks / len(checks)) * 100 if checks else 0
        
        overall_status = "healthy" if score >= 80 else "degraded" if score >= 60 else "unhealthy"
        
        return ComponentValidation(
            component_name="system_integration",
            overall_status=overall_status,
            checks=checks,
            score=score
        )
    
    def run_comprehensive_validation(self) -> Dict[str, ComponentValidation]:
        """Run comprehensive validation of all RAG components."""
        logger.info("Starting comprehensive RAG system validation...")
        
        validations = {
            'embedding_model': self.validate_embedding_model(),
            'adaptive_chunking': self.validate_adaptive_chunking(),
            'database_schema': self.validate_database_schema(),
            'configuration': self.validate_configuration(),
            'system_integration': self.validate_system_integration()
        }
        
        self.validation_results = validations
        
        # Calculate overall score
        total_score = sum(v.score for v in validations.values())
        avg_score = total_score / len(validations)
        
        healthy_components = sum(1 for v in validations.values() if v.overall_status == "healthy")
        
        logger.info(f"Validation complete: {healthy_components}/{len(validations)} components healthy, "
                   f"overall score: {avg_score:.1f}/100")
        
        return validations
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """Get a summary of validation results."""
        if not self.validation_results:
            return {"error": "No validation results available. Run validation first."}
        
        healthy_components = sum(1 for v in self.validation_results.values() if v.overall_status == "healthy")
        total_components = len(self.validation_results)
        
        total_score = sum(v.score for v in self.validation_results.values())
        avg_score = total_score / total_components
        
        critical_issues = []
        warnings = []
        
        for component_name, validation in self.validation_results.items():
            for check in validation.checks:
                if not check.is_valid and check.severity == "error":
                    critical_issues.append(f"{component_name}: {check.message}")
                elif check.severity == "warning":
                    warnings.append(f"{component_name}: {check.message}")
        
        return {
            "overall_score": avg_score,
            "healthy_components": healthy_components,
            "total_components": total_components,
            "health_percentage": (healthy_components / total_components) * 100,
            "critical_issues": critical_issues,
            "warnings": warnings,
            "status": "healthy" if avg_score >= 80 else "degraded" if avg_score >= 60 else "unhealthy"
        }


# Global validator instance
rag_validator = RAGSystemValidator()