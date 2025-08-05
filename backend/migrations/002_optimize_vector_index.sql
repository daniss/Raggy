-- Migration: Optimize Vector Index with HNSW for Better Performance
-- This migration upgrades the vector index to use HNSW (Hierarchical Navigable Small World)
-- which provides better performance for large-scale similarity search

-- Drop existing ivfflat index
DROP INDEX IF EXISTS idx_document_vectors_embedding;

-- Create optimized HNSW index for better performance
-- HNSW parameters:
-- - m=16: Maximum number of bidirectional links for each node (16 is optimal for most cases)
-- - ef_construction=64: Size of dynamic candidate list (higher = better recall, slower build)
CREATE INDEX idx_document_vectors_embedding_hnsw ON document_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Update embedding dimension to support the new multilingual-e5-large-instruct model (1024 dimensions)
-- For dev environment: Clear existing data and update schema safely
DO $$
DECLARE
    current_dimension INTEGER;
    vector_count INTEGER;
    current_env TEXT;
BEGIN
    -- Get current environment with better detection logic
    -- Try multiple methods to detect environment
    BEGIN
        current_env := current_setting('app.environment', false);
    EXCEPTION WHEN OTHERS THEN
        -- Fallback 1: Check if this looks like a dev database
        IF EXISTS (SELECT 1 FROM pg_database WHERE datname LIKE '%_dev%' OR datname LIKE '%dev%' OR datname = current_database() AND current_database() LIKE '%dev%') THEN
            current_env := 'development';
        -- Fallback 2: Check for common dev indicators  
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'development_mode') THEN
            current_env := 'development';
        -- Fallback 3: Assume production for safety
        ELSE
            current_env := 'production';
        END IF;
    END;
    
    -- Get current vector count
    SELECT COUNT(*) INTO vector_count FROM document_vectors;
    
    -- Get current dimension if vectors exist
    IF vector_count > 0 THEN
        SELECT array_length(embedding::real[], 1) INTO current_dimension 
        FROM document_vectors 
        WHERE embedding IS NOT NULL 
        LIMIT 1;
    ELSE
        current_dimension := 0;
    END IF;
    
    RAISE NOTICE 'Current environment: %, Vector count: %, Current dimension: %', 
                 current_env, vector_count, current_dimension;
    
    -- For dev environment, we can safely clear data and update schema
    IF current_env = 'development' AND current_dimension IS NOT NULL AND current_dimension != 1024 THEN
        RAISE NOTICE 'DEV MODE: Clearing existing vector data to safely update dimensions';
        
        -- Clear existing embeddings (dev environment only)
        UPDATE document_vectors SET embedding = NULL;
        
        -- Update column type to 1024 dimensions
        ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(1024);
        
        RAISE NOTICE 'Successfully updated embedding column to 1024 dimensions (data cleared for dev)';
        
    ELSIF current_dimension = 1024 THEN
        RAISE NOTICE 'Embedding column already using 1024 dimensions - no update needed';
        
    ELSIF current_env != 'development' AND vector_count > 0 THEN
        RAISE EXCEPTION 'PRODUCTION SAFETY: Cannot safely update dimensions with existing data. Manual migration required.';
        
    ELSE
        -- No existing data, safe to update
        ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(1024);
        RAISE NOTICE 'Updated empty embedding column to 1024 dimensions';
    END IF;
    
    -- Always ensure we have the correct search function
    DROP FUNCTION IF EXISTS search_similar_documents_org(vector(384), UUID, float, int);
    DROP FUNCTION IF EXISTS search_similar_documents_org(vector(1024), UUID, float, int);
    
    CREATE OR REPLACE FUNCTION search_similar_documents_org(
        query_embedding vector(1024),
        organization_id UUID,
        match_threshold float DEFAULT 0.1,
        match_count int DEFAULT 5
    )
    RETURNS TABLE (
        id UUID,
        document_id UUID,
        chunk_index INTEGER,
        content TEXT,
        metadata JSONB,
        similarity FLOAT
    ) AS $func$
    BEGIN
        -- Validate input parameters
        IF query_embedding IS NULL THEN
            RAISE EXCEPTION 'Query embedding cannot be NULL';
        END IF;
        
        IF array_length(query_embedding::real[], 1) != 1024 THEN
            RAISE EXCEPTION 'Query embedding must be 1024-dimensional, got %', 
                           array_length(query_embedding::real[], 1);
        END IF;
        
        RETURN QUERY
        SELECT 
            dv.id,
            dv.document_id,
            dv.chunk_index,
            dv.content,
            dv.metadata,
            1 - (dv.embedding <=> query_embedding) AS similarity
        FROM document_vectors dv
        WHERE dv.organization_id = search_similar_documents_org.organization_id
        AND dv.embedding IS NOT NULL
        AND 1 - (dv.embedding <=> query_embedding) > match_threshold
        ORDER BY dv.embedding <=> query_embedding
        LIMIT match_count;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Created/updated search function for 1024-dimensional embeddings';
    
END $$;

-- Create additional performance indexes for hybrid search
CREATE INDEX IF NOT EXISTS idx_document_vectors_content_gin ON document_vectors 
USING gin(to_tsvector('french', content));

-- Create index for metadata queries (used in filtering)
CREATE INDEX IF NOT EXISTS idx_document_vectors_metadata_gin ON document_vectors 
USING gin(metadata);

-- Add statistics collection for better query planning
ANALYZE document_vectors;

-- Create function to get vector index statistics (read-only, safe)
CREATE OR REPLACE FUNCTION get_vector_index_stats()
RETURNS JSON AS $$
DECLARE
    index_size TEXT;
    total_vectors INTEGER;
    avg_vector_size INTEGER;
BEGIN
    -- Validate function is being called by authenticated user
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Get index size safely
    SELECT COALESCE(pg_size_pretty(pg_relation_size('idx_document_vectors_embedding_hnsw')), '0 bytes')
    INTO index_size;
    
    -- Get vector count
    SELECT COUNT(*) INTO total_vectors FROM document_vectors;
    
    -- Get average content size (with safety check)
    SELECT COALESCE(AVG(LENGTH(content))::INTEGER, 0) INTO avg_vector_size 
    FROM document_vectors 
    WHERE content IS NOT NULL;
    
    RETURN json_build_object(
        'index_type', 'HNSW',
        'index_size', index_size,
        'total_vectors', total_vectors,
        'avg_content_length', avg_vector_size,
        'dimension', 1024,
        'distance_metric', 'cosine',
        'timestamp', NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'error', 'Unable to retrieve index statistics',
            'detail', SQLERRM,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to optimize HNSW search performance at runtime
CREATE OR REPLACE FUNCTION optimize_hnsw_search(ef_search INTEGER DEFAULT 40)
RETURNS VOID AS $$
BEGIN
    -- Validate function is being called by authenticated user
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Validate ef_search parameter type and range
    IF ef_search IS NULL THEN
        RAISE EXCEPTION 'ef_search parameter cannot be NULL';
    END IF;
    
    IF NOT (ef_search BETWEEN 10 AND 1000) THEN
        RAISE EXCEPTION 'ef_search parameter must be between 10 and 1000, got %', ef_search;
    END IF;
    
    -- Set ef_search parameter for HNSW queries
    -- Higher values = better recall but slower search
    -- 40 is a good balance for most use cases
    EXECUTE format('SET hnsw.ef_search = %L', ef_search);
    
    -- Log the optimization
    RAISE NOTICE 'HNSW ef_search parameter set to %', ef_search;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to optimize HNSW search: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate vector index health
CREATE OR REPLACE FUNCTION check_vector_index_health()
RETURNS JSON AS $$
DECLARE
    index_valid BOOLEAN;
    null_embeddings INTEGER;
    dimension_consistency BOOLEAN;
    total_vectors INTEGER;
    result JSON;
BEGIN
    -- Validate function is being called by authenticated user
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Check if index exists and is valid
    SELECT EXISTS(
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_document_vectors_embedding_hnsw' 
        AND schemaname = 'public'
    ) INTO index_valid;
    
    -- Get total vector count
    SELECT COUNT(*) INTO total_vectors FROM document_vectors;
    
    -- Count null embeddings
    SELECT COUNT(*) INTO null_embeddings 
    FROM document_vectors 
    WHERE embedding IS NULL;
    
    -- Check dimension consistency (all vectors should have same dimension)
    SELECT CASE 
        WHEN total_vectors = 0 THEN true
        WHEN COUNT(DISTINCT array_length(embedding::real[], 1)) <= 1 THEN true
        ELSE false
    END INTO dimension_consistency
    FROM document_vectors 
    WHERE embedding IS NOT NULL;
    
    result := json_build_object(
        'index_exists', index_valid,
        'total_vectors', total_vectors,
        'null_embeddings', null_embeddings,
        'dimension_consistent', dimension_consistency,
        'health_status', CASE 
            WHEN index_valid AND null_embeddings = 0 AND dimension_consistency AND total_vectors > 0 THEN 'healthy'
            WHEN index_valid AND dimension_consistency AND total_vectors = 0 THEN 'healthy_empty'
            WHEN index_valid AND null_embeddings > 0 AND dimension_consistency THEN 'warnings'
            ELSE 'unhealthy'
        END,
        'timestamp', NOW()
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'error', 'Unable to check index health',
            'detail', SQLERRM,
            'health_status', 'error',
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_vector_index_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION optimize_hnsw_search(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_vector_index_health() TO authenticated;

-- Set optimal HNSW search parameter for the session
SELECT optimize_hnsw_search(40);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Vector index optimization completed successfully';
    RAISE NOTICE 'HNSW index created with optimal parameters (m=16, ef_construction=64)';
    RAISE NOTICE 'Updated to support 1024-dimensional embeddings';
    RAISE NOTICE 'Added French text search and metadata indexes for hybrid search';
END $$;