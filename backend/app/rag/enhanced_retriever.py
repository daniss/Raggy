"""Enhanced RAG retriever with confidence scoring and metadata filtering."""

import logging
import math
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import json

from langchain.schema import Document
from app.db.supabase_client import get_supabase_client
from app.rag.embedding_providers import embedding_provider
from app.core.retry_handler import retry_database
from app.core.config import settings

logger = logging.getLogger(__name__)


class EnhancedSupabaseRetriever:
    """Enhanced vector store retriever with confidence scoring and metadata filtering."""
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self.embedding_provider = embedding_provider
        self.collection_name = "document_vectors"
        
        logger.info(f"Initialized enhanced retriever with {self.embedding_provider.__class__.__name__}")
    
    def _calculate_confidence_score(self, similarity: float, source_metadata: Dict[str, Any] = None) -> float:
        """Calculate confidence score from similarity score and metadata."""
        # Base confidence from similarity score
        # With normalized embeddings, cosine similarity ranges from 0 to 1
        # Convert directly to percentage (0-100%)
        base_confidence = max(0, similarity * 100)
        
        # Apply confidence boosters based on metadata
        confidence_multiplier = 1.0
        
        if source_metadata:
            # Boost confidence for certain extraction methods
            extraction_method = source_metadata.get('extraction_method', '')
            if extraction_method in ['pymupdf', 'python_docx']:
                confidence_multiplier *= 1.05  # 5% boost for reliable extractors
            elif extraction_method in ['pdfplumber']:
                confidence_multiplier *= 1.02  # 2% boost for good fallback
            
            # Boost confidence for documents with rich metadata
            if source_metadata.get('author') or source_metadata.get('title'):
                confidence_multiplier *= 1.03  # 3% boost for metadata-rich docs
            
            # Boost confidence for recent documents (within last year)
            if source_metadata.get('processed_at'):
                try:
                    from datetime import datetime
                    processed_date = datetime.fromisoformat(source_metadata['processed_at'].replace('Z', '+00:00'))
                    days_old = (datetime.now().replace(tzinfo=processed_date.tzinfo) - processed_date).days
                    if days_old < 365:  # Less than a year old
                        freshness_boost = max(1.0, 1.1 - (days_old / 365) * 0.1)  # Up to 10% boost
                        confidence_multiplier *= freshness_boost
                except Exception:
                    pass  # Ignore date parsing errors
            
            # Penalize very short chunks (likely incomplete information)
            chunk_size = source_metadata.get('chunk_size', 1000)
            if chunk_size < 200:
                confidence_multiplier *= 0.9  # 10% penalty for very short chunks
        
        # Apply multiplier and cap at 100%
        final_confidence = min(100.0, base_confidence * confidence_multiplier)
        
        return round(final_confidence, 2)
    
    def _apply_metadata_filters(self, base_query, metadata_filters: Dict[str, Any]) -> Any:
        """Apply metadata filters to Supabase query."""
        query = base_query
        
        for key, value in metadata_filters.items():
            if key == 'filename':
                query = query.ilike('metadata->filename', f'%{value}%')
            elif key == 'file_type':
                query = query.eq('metadata->file_type', value)
            elif key == 'extraction_method':
                query = query.eq('metadata->extraction_method', value)
            elif key == 'author':
                query = query.ilike('metadata->author', f'%{value}%')
            elif key == 'date_range':
                # Expecting format: {'start': 'YYYY-MM-DD', 'end': 'YYYY-MM-DD'}
                if isinstance(value, dict) and 'start' in value:
                    query = query.gte('created_at', value['start'])
                if isinstance(value, dict) and 'end' in value:
                    query = query.lte('created_at', value['end'])
            elif key == 'min_chunk_size':
                query = query.gte('metadata->chunk_size', str(value))
            elif key == 'has_metadata':
                # Filter for documents with rich metadata
                if value:
                    query = query.or_('metadata->author.neq.null,metadata->title.neq.null')
        
        return query
    
    async def similarity_search_with_confidence(
        self,
        query: str,
        k: int = 8,
        organization_id: Optional[str] = None,
        metadata_filters: Optional[Dict[str, Any]] = None,
        min_confidence: float = 0.0
    ) -> List[Tuple[Document, float]]:
        """
        Perform similarity search with confidence scoring and metadata filtering.
        
        Returns:
            List of (Document, confidence_score) tuples sorted by confidence descending.
        """
        try:
            logger.debug(f"Enhanced similarity search: query='{query[:50]}...', k={k}, filters={metadata_filters}")
            
            # Generate query embedding
            query_embedding = await self.embedding_provider.embed_query_async(query)
            
            if not query_embedding:
                logger.warning("Empty query embedding generated")
                return []
            
            # Build base query
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # Use RPC function for vector similarity search
            rpc_query = self.supabase.rpc(
                "search_similar_documents_org",
                {
                    "query_embedding": embedding_str,
                    "match_threshold": 0.1,  # Lower threshold to get more candidates
                    "match_count": k * 2,    # Get more candidates for filtering
                    "organization_id": organization_id
                }
            )
            
            # Apply metadata filters if provided
            if metadata_filters:
                # Note: RPC functions can't easily have metadata filters applied
                # So we'll get more results and filter in Python for now
                # In production, consider creating separate RPC functions for common filters
                pass
            
            result = rpc_query.execute()
            
            if not result.data:
                logger.info("No similar documents found")
                return []
            
            # Process results with confidence scoring
            documents_with_confidence = []
            
            for item in result.data:
                try:
                    # Extract metadata and content
                    metadata = item.get('metadata', {})
                    if isinstance(metadata, str):
                        metadata = json.loads(metadata)
                    
                    similarity = float(item.get('similarity', 0))
                    
                    # Apply post-query metadata filtering
                    if metadata_filters and not self._matches_metadata_filters(metadata, metadata_filters):
                        continue
                    
                    # Calculate confidence score
                    confidence = self._calculate_confidence_score(similarity, metadata)
                    
                    # Filter by minimum confidence
                    if confidence < min_confidence:
                        continue
                    
                    # Create document object
                    doc_metadata = metadata.copy()
                    doc_metadata.update({
                        'similarity': similarity,
                        'confidence': confidence,
                        'document_id': item.get('document_id'),
                        'chunk_id': item.get('id')
                    })
                    
                    document = Document(
                        page_content=item.get('content', ''),
                        metadata=doc_metadata
                    )
                    
                    documents_with_confidence.append((document, confidence))
                    
                except Exception as item_error:
                    logger.warning(f"Error processing search result: {item_error}")
                    continue
            
            # Sort by confidence score (descending) and limit to k
            documents_with_confidence.sort(key=lambda x: x[1], reverse=True)
            final_results = documents_with_confidence[:k]
            
            logger.info(f"Enhanced search completed: {len(final_results)} documents with avg confidence {sum(c for _, c in final_results) / len(final_results):.1f}% (query: '{query[:30]}...')")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Enhanced similarity search failed: {e}")
            # Fallback to basic search without confidence scoring
            return await self._fallback_similarity_search(query, k, organization_id)
    
    def _matches_metadata_filters(self, metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Check if document metadata matches the provided filters."""
        for key, filter_value in filters.items():
            if key == 'filename':
                filename = metadata.get('filename', '')
                if filter_value.lower() not in filename.lower():
                    return False
            elif key == 'file_type':
                if metadata.get('file_type') != filter_value:
                    return False
            elif key == 'extraction_method':
                if metadata.get('extraction_method') != filter_value:
                    return False
            elif key == 'author':
                author = metadata.get('author', '')
                if filter_value.lower() not in author.lower():
                    return False
            elif key == 'min_chunk_size':
                chunk_size = metadata.get('chunk_size', 0)
                if chunk_size < filter_value:
                    return False
            elif key == 'has_metadata':
                if filter_value and not (metadata.get('author') or metadata.get('title')):
                    return False
        
        return True
    
    async def _fallback_similarity_search(
        self,
        query: str,
        k: int,
        organization_id: Optional[str] = None
    ) -> List[Tuple[Document, float]]:
        """Fallback to basic similarity search without advanced features."""
        try:
            logger.warning("Using fallback similarity search")
            
            # Generate query embedding
            query_embedding = await self.embedding_provider.embed_query_async(query)
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # Basic RPC call
            result = self.supabase.rpc(
                "search_similar_documents_org",
                {
                    "query_embedding": embedding_str,
                    "match_threshold": 0.1,
                    "match_count": k,
                    "organization_id": organization_id
                }
            ).execute()
            
            if not result.data:
                return []
            
            # Convert to documents with basic confidence
            documents_with_confidence = []
            for item in result.data:
                similarity = float(item.get('similarity', 0))
                # With normalized embeddings, similarity is 0-1, convert to percentage
                basic_confidence = max(0, similarity * 100)
                
                metadata = item.get('metadata', {})
                if isinstance(metadata, str):
                    metadata = json.loads(metadata)
                
                metadata.update({
                    'similarity': similarity,
                    'confidence': basic_confidence
                })
                
                document = Document(
                    page_content=item.get('content', ''),
                    metadata=metadata
                )
                
                documents_with_confidence.append((document, basic_confidence))
            
            return documents_with_confidence
            
        except Exception as e:
            logger.error(f"Fallback similarity search failed: {e}")
            return []
    
    def similarity_search(
        self,
        query: str,
        k: int = 8,
        organization_id: Optional[str] = None,
        metadata_filters: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """Synchronous wrapper for similarity search (backward compatibility)."""
        import asyncio
        
        try:
            # Run async method
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            documents_with_confidence = loop.run_until_complete(
                self.similarity_search_with_confidence(
                    query, k, organization_id, metadata_filters
                )
            )
            
            # Return just documents for backward compatibility
            return [doc for doc, _ in documents_with_confidence]
            
        except Exception as e:
            logger.error(f"Sync similarity search failed: {e}")
            return []
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to vector store using enhanced embedding provider."""
        try:
            if not documents:
                return []
            
            logger.info(f"Adding {len(documents)} documents with enhanced embedder")
            
            # Extract texts for embedding
            texts = [doc.page_content for doc in documents]
            
            # Generate embeddings using enhanced provider
            embeddings = self.embedding_provider.embed_documents(texts)
            
            if len(embeddings) != len(documents):
                raise ValueError(f"Embedding count mismatch: {len(embeddings)} vs {len(documents)}")
            
            # Prepare batch insert data
            batch_data = []
            for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                # Add content hash to metadata if available from document loader
                metadata = doc.metadata.copy()
                
                # Ensure required fields
                doc_id = metadata.get('document_id')
                org_id = metadata.get('organization_id')
                
                if not doc_id or not org_id:
                    logger.warning(f"Skipping document {i}: missing document_id or organization_id")
                    continue
                
                item = {
                    'document_id': doc_id,
                    'content': doc.page_content,
                    'metadata': metadata,
                    'embedding': embedding,
                    'organization_id': org_id,
                    'content_hash': metadata.get('content_hash')
                }
                
                batch_data.append(item)
            
            if not batch_data:
                logger.warning("No valid documents to insert")
                return []
            
            # Insert in batches
            batch_size = 25
            all_ids = []
            
            for i in range(0, len(batch_data), batch_size):
                batch = batch_data[i:i + batch_size]
                try:
                    result = self.supabase.table("document_vectors").insert(batch).execute()
                    batch_ids = [item['id'] for item in result.data] if result.data else []
                    all_ids.extend(batch_ids)
                    logger.debug(f"Inserted batch {i//batch_size + 1}: {len(batch_ids)} documents")
                except Exception as batch_error:
                    logger.error(f"Batch insert failed: {batch_error}")
                    continue
            
            logger.info(f"Successfully added {len(all_ids)} documents to enhanced vector store")
            return [str(id_) for id_ in all_ids]
            
        except Exception as e:
            logger.error(f"Enhanced add_documents failed: {e}")
            raise
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get enhanced collection statistics."""
        try:
            # Get basic stats
            result = self.supabase.table("document_vectors").select("id", count="exact").execute()
            total_vectors = result.count or 0
            
            # Get stats with extraction methods if the enhanced schema is available
            try:
                enhanced_result = self.supabase.rpc("get_enhanced_document_stats", {
                    "org_id": "demo-org-12345"  # Use demo org for stats
                }).execute()
                
                if enhanced_result.data and len(enhanced_result.data) > 0:
                    stats_data = enhanced_result.data[0]
                    return {
                        "total_vectors": total_vectors,
                        "total_documents": stats_data.get('total_documents', 0),
                        "total_size_bytes": stats_data.get('total_size_bytes', 0),
                        "unique_content_hashes": stats_data.get('unique_content_hashes', 0),
                        "extraction_methods": stats_data.get('extraction_methods', {}),
                        "avg_file_size": float(stats_data.get('avg_file_size', 0)),
                        "documents_with_metadata": stats_data.get('documents_with_metadata', 0),
                        "embedding_dimension": self.embedding_provider.get_embedding_dimension(),
                        "provider_type": self.embedding_provider.__class__.__name__
                    }
            except Exception as enhanced_error:
                logger.debug(f"Enhanced stats not available: {enhanced_error}")
            
            # Fallback to basic stats
            return {
                "total_vectors": total_vectors,
                "total_documents": total_vectors,  # Approximate
                "embedding_dimension": self.embedding_provider.get_embedding_dimension(),
                "provider_type": self.embedding_provider.__class__.__name__
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {"error": str(e)}


# Global enhanced retriever instance
enhanced_retriever = EnhancedSupabaseRetriever()