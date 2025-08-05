#!/usr/bin/env python3

import os
import sys
import uuid
sys.path.append('/home/danis/code/Raggy/backend')

from app.db.supabase_client import supabase_client
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_vector_dimension():
    """Check the current vector dimension in the database."""
    try:
        # Try to get vector dimension from actual data
        result = supabase_client.table('document_vectors').select('embedding').limit(1).execute()
        
        if result.data and result.data[0].get('embedding'):
            embedding = result.data[0]['embedding']
            if isinstance(embedding, list):
                logger.info(f"Current embedding dimension: {len(embedding)}")
            else:
                logger.info(f"Embedding data type: {type(embedding)}")
        else:
            logger.info("No vectors found in database")
            
    except Exception as e:
        logger.error(f"Error checking vector data: {e}")

def test_vector_insert():
    """Test inserting a 1024-dimensional vector to see if schema supports it."""
    try:
        # First create a valid document to reference
        doc_data = {
            'filename': 'test_schema_check.txt',
            'content_type': 'text/plain',
            'size_bytes': 100,
            'status': 'completed',
            'file_path': '/tmp/test'
        }
        
        doc_result = supabase_client.table('documents').insert(doc_data).execute()
        if not doc_result.data:
            logger.error("Failed to create test document")
            return False
            
        doc_id = doc_result.data[0]['id']
        
        # Create a test vector with 1024 dimensions
        test_vector = [0.1] * 1024
        
        # Try to insert it (this will fail if schema is wrong)
        test_data = {
            'document_id': doc_id,
            'organization_id': str(uuid.uuid4()),  # This might also need to be valid
            'chunk_index': 0,
            'content': 'Test content for dimension check',
            'embedding': test_vector
        }
        
        result = supabase_client.table('document_vectors').insert(test_data).execute()
        logger.info("✅ Successfully inserted 1024-dimensional vector - schema is correct!")
        
        # Clean up the test records
        if result.data:
            test_id = result.data[0]['id']
            supabase_client.table('document_vectors').delete().eq('id', test_id).execute()
            
        supabase_client.table('documents').delete().eq('id', doc_id).execute()
        logger.info("Test records cleaned up")
            
        return True
        
    except Exception as e:
        error_msg = str(e)
        if "expected 384 dimensions, not 1024" in error_msg:
            logger.error(f"❌ Schema still expects 384 dimensions: {e}")
            return False
        elif "violates foreign key constraint" in error_msg and "organization" in error_msg:
            logger.info("✅ Vector dimensions accepted! (Foreign key constraint on organization_id is expected)")
            return True
        else:
            logger.error(f"❌ Unexpected error inserting 1024-dimensional vector: {e}")
            return False

def run_migration():
    """Run the migration to update vector dimension."""
    try:
        # Since we can't run SQL directly, let's use a direct approach
        # First, let's see if we can insert a 1024-dimensional vector
        if test_vector_insert():
            logger.info("Schema already supports 1024 dimensions - no migration needed")
            return
        
        logger.warning("Schema needs updating but we can't run SQL migrations directly through Supabase client")
        logger.info("The migration needs to be run manually in the Supabase dashboard")
        
    except Exception as e:
        logger.error(f"Error checking migration: {e}")
        raise

if __name__ == "__main__":
    logger.info("Checking current vector schema...")
    check_vector_dimension()
    
    logger.info("\nTesting vector dimension support...")
    run_migration()
    
    logger.info("\nFinal schema check...")
    check_vector_dimension()
