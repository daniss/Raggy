import uuid
from typing import List, Dict, Any, Optional
from langchain.schema import Document
import logging
from app.core.config import settings
from app.rag.embedder import embedder
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)


class SupabaseVectorRetriever:
    """Supabase pgvector-based document retriever."""
    
    def __init__(self):
        """Initialize Supabase vector retriever."""
        self.client = supabase_client
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize Supabase connection and test vector functionality."""
        try:
            # Test connection with a simple query
            result = self.client.table("document_vectors").select("id").limit(1).execute()
            logger.info("✓ Supabase vector store connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Supabase vector store: {e}")
            raise
    
    def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to the vector store."""
        if not documents:
            return []
        
        try:
            # Generate embeddings for all documents
            texts = [doc.page_content for doc in documents]
            embeddings = embedder.embed_documents(texts)
            
            # Prepare data for insertion
            vectors_data = []
            document_ids = []
            
            for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                vector_id = str(uuid.uuid4())
                document_ids.append(vector_id)
                
                # Extract metadata
                metadata = doc.metadata or {}
                document_id = metadata.get("document_id", str(uuid.uuid4()))
                organization_id = metadata.get("organization_id")
                chunk_index = metadata.get("chunk_index", i)
                
                vectors_data.append({
                    "id": vector_id,
                    "document_id": document_id,
                    "organization_id": organization_id,
                    "chunk_index": chunk_index,
                    "content": doc.page_content,
                    "embedding": embedding,
                    "metadata": metadata
                })
            
            # Insert vectors into Supabase
            result = self.client.table("document_vectors").insert(vectors_data).execute()
            
            if result.data:
                logger.info(f"Successfully added {len(result.data)} document vectors")
                return document_ids
            else:
                logger.error("Failed to insert document vectors")
                return []
                
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}")
            return []
    
    def similarity_search(
        self, 
        query: str, 
        k: int = 5, 
        organization_id: Optional[str] = None,
        similarity_threshold: float = 0.1
    ) -> List[Document]:
        """Search for similar documents using vector similarity."""
        try:
            # Generate query embedding
            query_embedding = embedder.embed_query(query)
            
            # Use the organization-scoped search function if organization_id is provided
            if organization_id:
                result = self.client.rpc(
                    "search_similar_documents_org",
                    {
                        "query_embedding": query_embedding,
                        "organization_id": organization_id,
                        "match_threshold": similarity_threshold,
                        "match_count": k
                    }
                ).execute()
            else:
                # Fallback to basic similarity search (for backward compatibility)
                # This would need a generic search function in the database
                logger.warning("Performing search without organization context")
                return []
            
            if not result.data:
                return []
            
            # Convert results to Document objects
            documents = []
            for row in result.data:
                doc = Document(
                    page_content=row["content"],
                    metadata={
                        **row.get("metadata", {}),
                        "document_id": row["document_id"],
                        "chunk_index": row["chunk_index"],
                        "similarity": row["similarity"],
                        "vector_id": row["id"]
                    }
                )
                documents.append(doc)
            
            logger.info(f"Found {len(documents)} similar documents")
            return documents
            
        except Exception as e:
            logger.error(f"Error performing similarity search: {e}")
            return []
    
    def delete_documents_by_filename(self, filename: str) -> bool:
        """Delete all document vectors for a specific filename."""
        try:
            # Find documents with matching filename in metadata
            result = self.client.table("document_vectors").select("id").contains(
                "metadata", {"filename": filename}
            ).execute()
            
            if not result.data:
                logger.info(f"No vectors found for filename: {filename}")
                return True
            
            # Delete the vectors
            vector_ids = [row["id"] for row in result.data]
            delete_result = self.client.table("document_vectors").delete().in_(
                "id", vector_ids
            ).execute()
            
            logger.info(f"Deleted {len(vector_ids)} vectors for filename: {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting documents by filename {filename}: {e}")
            return False
    
    def delete_documents_by_document_id(self, document_id: str) -> bool:
        """Delete all vectors for a specific document ID."""
        try:
            # Use the helper function
            result = self.client.rpc(
                "delete_document_vectors",
                {"target_document_id": document_id}
            ).execute()
            
            deleted_count = result.data if result.data is not None else 0
            logger.info(f"Deleted {deleted_count} vectors for document: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document vectors for {document_id}: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector collection."""
        try:
            # Get total count of vectors
            total_result = self.client.table("document_vectors").select(
                "id", count="exact"
            ).execute()
            total_vectors = total_result.count or 0
            
            # Get unique document count
            doc_result = self.client.table("document_vectors").select(
                "document_id", count="exact"
            ).execute()
            
            # Get unique documents by counting distinct document_ids
            unique_docs_result = self.client.rpc("get_distinct_document_count").execute()
            total_documents = unique_docs_result.data if unique_docs_result.data else 0
            
            # Get embedding dimension (assume 384 for all-MiniLM-L6-v2)
            embedding_dimension = 384
            
            return {
                "total_vectors": total_vectors,
                "total_documents": total_documents,
                "embedding_dimension": embedding_dimension,
                "vector_store": "Supabase pgvector"
            }
            
        except Exception as e:
            logger.error(f"Error getting collection stats: {e}")
            return {
                "total_vectors": 0,
                "total_documents": 0,
                "embedding_dimension": 384,
                "vector_store": "Supabase pgvector",
                "error": str(e)
            }
    
    def reset_collection(self) -> bool:
        """Reset the entire vector collection (delete all vectors)."""
        try:
            # Delete all vectors
            result = self.client.table("document_vectors").delete().neq("id", "").execute()
            logger.info("Vector collection reset successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error resetting collection: {e}")
            return False
    
    def get_documents_by_organization(self, organization_id: str, limit: int = 100) -> List[Document]:
        """Get all documents for a specific organization."""
        try:
            result = self.client.table("document_vectors").select(
                "id, document_id, chunk_index, content, metadata"
            ).eq("organization_id", organization_id).limit(limit).execute()
            
            if not result.data:
                return []
            
            documents = []
            for row in result.data:
                doc = Document(
                    page_content=row["content"],
                    metadata={
                        **row.get("metadata", {}),
                        "document_id": row["document_id"],
                        "chunk_index": row["chunk_index"],
                        "vector_id": row["id"]
                    }
                )
                documents.append(doc)
            
            return documents
            
        except Exception as e:
            logger.error(f"Error getting documents for organization {organization_id}: {e}")
            return []
    
    def health_check(self) -> bool:
        """Check if the vector store is healthy."""
        try:
            # Simple health check query
            result = self.client.table("document_vectors").select("id").limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Vector store health check failed: {e}")
            return False


# Create the retriever instance
retriever = SupabaseVectorRetriever()