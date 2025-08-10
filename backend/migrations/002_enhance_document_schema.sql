-- Migration 002: Enhance document schema with content hashing and metadata
-- Description: Add content_hash, enhanced metadata support, and indexing for better document management

-- Add content_hash column to documents table for idempotency
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'unstructured',
ADD COLUMN IF NOT EXISTS document_metadata JSONB DEFAULT '{}';

-- Add content_hash column to document_vectors table
ALTER TABLE document_vectors 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create index on content_hash for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_document_vectors_content_hash ON document_vectors(content_hash);

-- Create index on extraction_method for analytics
CREATE INDEX IF NOT EXISTS idx_documents_extraction_method ON documents(extraction_method);

-- Create GIN index on document_metadata for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin ON documents USING GIN(document_metadata);

-- Add constraints
ALTER TABLE documents 
ADD CONSTRAINT IF NOT EXISTS chk_content_hash_format 
CHECK (content_hash IS NULL OR length(content_hash) = 64);

-- Function to check for duplicate content by hash
CREATE OR REPLACE FUNCTION check_duplicate_content(
    hash_value TEXT,
    org_id TEXT
)
RETURNS TABLE(
    document_id UUID,
    filename TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.filename, d.created_at
    FROM documents d
    WHERE d.content_hash = hash_value 
    AND d.organization_id = org_id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document statistics with enhanced metadata
CREATE OR REPLACE FUNCTION get_enhanced_document_stats(org_id TEXT)
RETURNS TABLE(
    total_documents BIGINT,
    total_size_bytes BIGINT,
    unique_content_hashes BIGINT,
    extraction_methods JSONB,
    avg_file_size NUMERIC,
    documents_with_metadata BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_documents,
        COALESCE(SUM(d.size_bytes), 0)::BIGINT as total_size_bytes,
        COUNT(DISTINCT d.content_hash)::BIGINT as unique_content_hashes,
        COALESCE(
            jsonb_object_agg(
                COALESCE(d.extraction_method, 'unknown'), 
                method_count
            ), 
            '{}'::jsonb
        ) as extraction_methods,
        COALESCE(AVG(d.size_bytes), 0) as avg_file_size,
        COUNT(*) FILTER (WHERE d.document_metadata != '{}')::BIGINT as documents_with_metadata
    FROM documents d
    LEFT JOIN (
        SELECT 
            extraction_method, 
            COUNT(*) as method_count
        FROM documents 
        WHERE organization_id = org_id
        GROUP BY extraction_method
    ) methods ON methods.extraction_method = d.extraction_method
    WHERE d.organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up orphaned vectors when documents are deleted
CREATE OR REPLACE FUNCTION cleanup_orphaned_vectors()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM document_vectors dv
    WHERE NOT EXISTS (
        SELECT 1 FROM documents d 
        WHERE d.id = dv.document_id
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced RLS policies for new columns
-- The existing RLS policies should automatically cover the new columns
-- but we'll add specific ones for content_hash queries

-- Policy for checking duplicate content (allow authenticated users to check their org's duplicates)
CREATE POLICY IF NOT EXISTS "Users can check duplicate content in their organization" ON documents
    FOR SELECT
    USING (organization_id = current_setting('app.current_organization_id', true));

-- Update existing policies to handle NULL content_hash gracefully
-- This is handled automatically by the existing RLS policies

-- Add comments for documentation
COMMENT ON COLUMN documents.content_hash IS 'SHA256 hash of document content for idempotency checking';
COMMENT ON COLUMN documents.extraction_method IS 'Method used to extract text (pymupdf, pdfplumber, unstructured, etc.)';
COMMENT ON COLUMN documents.document_metadata IS 'Additional metadata extracted from document (author, title, creation date, etc.)';
COMMENT ON COLUMN document_vectors.content_hash IS 'Content hash linking to parent document';

COMMENT ON FUNCTION check_duplicate_content(TEXT, TEXT) IS 'Check for duplicate documents by content hash within organization';
COMMENT ON FUNCTION get_enhanced_document_stats(TEXT) IS 'Get comprehensive document statistics with extraction method breakdown';
COMMENT ON FUNCTION cleanup_orphaned_vectors() IS 'Remove vector entries that no longer have corresponding documents';

-- Migration completion log
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed: Enhanced document schema with content hashing and metadata support';
END $$;