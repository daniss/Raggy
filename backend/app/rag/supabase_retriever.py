"""Supabase pgvector-based document retriever."""

import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
import asyncio
from concurrent.futures import ThreadPoolExecutor

from langchain.schema import Document
from langchain.vectorstores.base import VectorStore
from app.db.supabase_client import supabase_client
from app.rag.embedder import embedder
from app.core.retry_handler import retry_database, database_circuit_breaker

logger = logging.getLogger(__name__)


class SupabaseRetriever:
    """Vector store retriever using Supabase pgvector."""
    
    def __init__(self):
        self.supabase = supabase_client
        self.embedder = embedder
        self.collection_name = "document_vectors"
        
    def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to the vector store."""
        try:
            if not documents:
                return []
                
            logger.info(f"Adding {len(documents)} documents to Supabase vector store")
            
            # Process documents in batches to avoid memory issues
            batch_size = 100
            all_ids = []
            
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                batch_ids = self._add_document_batch(batch)
                all_ids.extend(batch_ids)
                
            logger.info(f"Successfully added {len(all_ids)} documents")
            return all_ids
            
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise
    
    @retry_database
    def _execute_supabase_query(self, operation: str, *args, **kwargs):
        """Execute Supabase operation with retry logic."""
        try:
            if operation == "insert":
                return self.supabase.table("document_vectors").insert(*args, **kwargs).execute()
            elif operation == "select":
                return self.supabase.table("document_vectors").select(*args, **kwargs).execute()
            elif operation == "rpc":
                return self.supabase.rpc(*args, **kwargs).execute()
            elif operation == "delete":
                return self.supabase.table("document_vectors").delete(*args, **kwargs).execute()
            else:
                raise ValueError(f"Unknown operation: {operation}")
        except Exception as e:
            logger.error(f"Supabase {operation} operation failed: {e}")
            raise
    
    def _add_document_batch(self, documents: List[Document]) -> List[str]:
        """Add a batch of documents."""
        batch_data = []
        
        for doc in documents:
            try:
                # Generate embedding for the document content
                embedding = self.embedder.embed_query(doc.page_content)
                
                # Prepare data for insertion
                doc_data = {
                    "document_id": doc.metadata.get("document_id"),
                    "chunk_index": doc.metadata.get("chunk_index", 0),
                    "content": doc.page_content,
                    "embedding": embedding,
                    "metadata": doc.metadata,
                    "organization_id": doc.metadata.get("organization_id")
                }
                batch_data.append(doc_data)
                
            except Exception as e:
                logger.error(f"Failed to process document: {e}")
                continue
        
        if not batch_data:
            return []
            
        # Insert batch into Supabase with retry logic
        try:
            result = self._execute_supabase_query("insert", batch_data)
            if result.data:
                return [str(row["id"]) for row in result.data]
            return []
            
        except Exception as e:
            logger.error(f"Failed to insert batch: {e}")
            raise
    
    def similarity_search(
        self, 
        query: str, 
        k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
        organization_id: Optional[str] = None
    ) -> List[Document]:
        """Search for similar documents."""
        try:
            # Generate embedding for the query
            query_embedding = self.embedder.embed_query(query)
            
            # Try optimized PostgreSQL RPC function first
            try:
                logger.info(f"Using optimized PostgreSQL similarity search for org: {organization_id}")
                rpc_params = {
                    "query_embedding": query_embedding,
                    "match_threshold": 0.1,
                    "match_count": k
                }
                if organization_id:
                    rpc_params["organization_id"] = organization_id
                
                result = self.supabase.rpc(
                    "search_similar_documents_org" if organization_id else "search_similar_documents",
                    rpc_params
                ).execute()
                
                if result.data:
                    documents = []
                    for row in result.data:
                        doc = Document(
                            page_content=row["content"],
                            metadata={
                                **row["metadata"],
                                "id": row["id"],
                                "document_id": row["document_id"],
                                "chunk_index": row["chunk_index"],
                                "similarity": row["similarity"]
                            }
                        )
                        documents.append(doc)
                    
                    # Apply metadata filtering if provided
                    if filter_metadata:
                        documents = [
                            doc for doc in documents
                            if self._matches_filter(doc.metadata, filter_metadata)
                        ]
                    
                    logger.info(f"Found {len(documents)} similar documents for query (optimized method)")
                    return documents
                    
            except Exception as rpc_error:
                logger.warning(f"RPC function failed, falling back to Python similarity: {rpc_error}")
            
            # Fallback: Get all documents and compute similarity in Python
            logger.info(f"Using fallback similarity search for org: {organization_id}")
            
            # Build query with organization filtering if provided
            query_builder = self.supabase.table("document_vectors").select("*")
            if organization_id:
                # Need to join with documents table to filter by organization_id
                query_builder = self.supabase.table("document_vectors").select(
                    "*, documents!inner(organization_id)"
                ).eq("documents.organization_id", organization_id)
            
            result = query_builder.execute()
            
            if not result.data:
                return []
            
            # Compute similarities manually
            import numpy as np
            documents_with_scores = []
            
            for row in result.data:
                if row["embedding"]:
                    # Convert embedding from string representation to numpy array
                    import json
                    if isinstance(row["embedding"], str):
                        # Parse string representation of array
                        embedding_list = json.loads(row["embedding"])
                    else:
                        # Already a list
                        embedding_list = row["embedding"]
                    
                    doc_embedding = np.array(embedding_list, dtype=np.float32)
                    query_emb = np.array(query_embedding, dtype=np.float32)
                    
                    # Compute cosine similarity
                    similarity = np.dot(query_emb, doc_embedding) / (np.linalg.norm(query_emb) * np.linalg.norm(doc_embedding))
                    
                    documents_with_scores.append((row, float(similarity)))
            
            # Sort by similarity score (descending)
            documents_with_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Take top k results with reasonable similarity
            filtered_docs = [(row, score) for row, score in documents_with_scores if score > 0.1][:k]
            
            # Convert to Document objects
            documents = []
            for row, similarity in filtered_docs:
                doc = Document(
                    page_content=row["content"],
                    metadata={
                        **row["metadata"],
                        "id": row["id"],
                        "document_id": row["document_id"],
                        "chunk_index": row["chunk_index"],
                        "similarity": similarity
                    }
                )
                documents.append(doc)
            
            # Apply metadata filtering if provided
            if filter_metadata:
                documents = [
                    doc for doc in documents
                    if self._matches_filter(doc.metadata, filter_metadata)
                ]
            
            logger.info(f"Found {len(documents)} similar documents for query (fallback method)")
            return documents
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    def _matches_filter(self, metadata: Dict[str, Any], filter_metadata: Dict[str, Any]) -> bool:
        """Check if document metadata matches the filter."""
        for key, value in filter_metadata.items():
            if metadata.get(key) != value:
                return False
        return True
    
    def delete_documents_by_filename(self, filename: str) -> bool:
        """Delete all documents with a specific filename."""
        try:
            # First, find documents with the given filename
            doc_result = self.supabase.table("documents").select("id").eq("filename", filename).execute()
            
            if not doc_result.data:
                logger.info(f"No documents found with filename: {filename}")
                return True
            
            document_ids = [doc["id"] for doc in doc_result.data]
            
            # Delete vectors for these documents
            for doc_id in document_ids:
                delete_result = self.supabase.rpc(
                    "delete_document_vectors",
                    {"target_document_id": doc_id}
                ).execute()
                
                if delete_result.data:
                    logger.info(f"Deleted {delete_result.data} vectors for document {doc_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete documents by filename {filename}: {e}")
            return False
    
    def delete_document_by_id(self, document_id: str) -> bool:
        """Delete a document by its ID."""
        try:
            result = self.supabase.rpc(
                "delete_document_vectors",
                {"target_document_id": document_id}
            ).execute()
            
            if result.data is not None:
                logger.info(f"Deleted {result.data} vectors for document {document_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector collection."""
        try:
            # Get total vector count
            count_result = self.supabase.table("document_vectors").select("*", count="exact", head=True).execute()
            total_vectors = count_result.count or 0
            
            # Get unique document count
            doc_count_result = self.supabase.table("documents").select("*", count="exact", head=True).execute()
            total_documents = doc_count_result.count or 0
            
            # Get storage size (approximate) - skip for now due to RPC issues
            storage_size = "Unknown"
            
            return {
                "total_vectors": total_vectors,
                "total_documents": total_documents,
                "collection_name": self.collection_name,
                "storage_size": storage_size
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {
                "total_vectors": 0,
                "total_documents": 0,
                "collection_name": self.collection_name,
                "storage_size": "Unknown"
            }
    
    def reset_collection(self) -> bool:
        """Reset the entire collection (delete all vectors)."""
        try:
            result = self.supabase.table("document_vectors").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            logger.info("Successfully reset vector collection")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset collection: {e}")
            return False
    
    def get_document_chunks(self, document_id: str) -> List[Document]:
        """Get all chunks for a specific document."""
        try:
            result = self.supabase.rpc(
                "get_document_chunks",
                {"target_document_id": document_id}
            ).execute()
            
            if not result.data:
                return []
            
            documents = []
            for row in result.data:
                doc = Document(
                    page_content=row["content"],
                    metadata={
                        **row["metadata"],
                        "id": row["id"],
                        "chunk_index": row["chunk_index"]
                    }
                )
                documents.append(doc)
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to get document chunks for {document_id}: {e}")
            return []


# Create global instance
supabase_retriever = SupabaseRetriever()