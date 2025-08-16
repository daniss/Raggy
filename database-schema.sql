-- RAG Database Schema for Supabase
-- This file contains the additional tables and functions needed for the RAG system

-- ============================================================================
-- 1. Organization Keys Table - Stores encrypted DEKs for each organization
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    encrypted_dek TEXT NOT NULL, -- Base64 encoded encrypted DEK
    dek_version INTEGER DEFAULT 1, -- For key rotation in the future
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one DEK per org (for now, later can support key rotation)
    UNIQUE(org_id, dek_version)
);

-- Index for fast org lookup
CREATE INDEX IF NOT EXISTS idx_org_keys_org_id ON org_keys(org_id);

-- RLS (Row Level Security) - users can only access their org's keys
ALTER TABLE org_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their org keys" ON org_keys
    FOR ALL USING (
        org_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 2. RAG Chunks Table - Stores encrypted document chunks with embeddings
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL, -- Position in the document
    
    -- Embedding for vector similarity search
    embedding vector(768), -- Assuming 768D embeddings (configurable)
    
    -- Encrypted content
    ciphertext BYTEA NOT NULL, -- AES-256-GCM encrypted chunk text
    nonce BYTEA NOT NULL, -- 96-bit nonce for GCM
    aad TEXT NOT NULL, -- Additional Authenticated Data (org_id|document_id|chunk_index)
    
    -- Integrity and metadata
    plaintext_sha256 TEXT NOT NULL, -- SHA-256 hash of original text for integrity
    section TEXT, -- Optional: section name (header, body, footer, etc.)
    page INTEGER, -- Optional: page number
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique chunks per document
    UNIQUE(document_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_chunks_org_id ON rag_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

-- RLS - users can only access chunks from their org's documents
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their org chunks" ON rag_chunks
    FOR ALL USING (
        org_id IN (
            SELECT organization_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 3. Vector Similarity Search Function
-- ============================================================================

CREATE OR REPLACE FUNCTION match_rag_chunks(
    p_org_id UUID,
    p_query_embedding vector(768),
    p_match_count INTEGER DEFAULT 10,
    p_min_similarity FLOAT DEFAULT 0.1
)
RETURNS TABLE(
    id UUID,
    document_id UUID,
    chunk_index INTEGER,
    ciphertext BYTEA,
    nonce BYTEA,
    aad TEXT,
    plaintext_sha256 TEXT,
    section TEXT,
    page INTEGER,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        rc.id,
        rc.document_id,
        rc.chunk_index,
        rc.ciphertext,
        rc.nonce,
        rc.aad,
        rc.plaintext_sha256,
        rc.section,
        rc.page,
        1 - (rc.embedding <=> p_query_embedding) AS similarity
    FROM rag_chunks rc
    WHERE rc.org_id = p_org_id
    AND 1 - (rc.embedding <=> p_query_embedding) > p_min_similarity
    ORDER BY similarity DESC
    LIMIT p_match_count;
$$;

-- ============================================================================
-- 4. Document Status Updates for RAG Indexing
-- ============================================================================

-- Add indexing status to documents table if not exists
DO $$ 
BEGIN
    -- Add rag_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'rag_status'
    ) THEN
        ALTER TABLE documents ADD COLUMN rag_status TEXT DEFAULT 'pending' CHECK (rag_status IN ('pending', 'indexing', 'ready', 'error'));
    END IF;
    
    -- Add rag_error column for error messages
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'rag_error'
    ) THEN
        ALTER TABLE documents ADD COLUMN rag_error TEXT;
    END IF;
    
    -- Add indexed_at timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'rag_indexed_at'
    ) THEN
        ALTER TABLE documents ADD COLUMN rag_indexed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Index for filtering by RAG status
CREATE INDEX IF NOT EXISTS idx_documents_rag_status ON documents(rag_status);

-- ============================================================================
-- 5. Cleanup Functions (for compliance and maintenance)
-- ============================================================================

-- Function to safely delete all RAG data for an organization
CREATE OR REPLACE FUNCTION cleanup_org_rag_data(p_org_id UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL
AS $$
DECLARE
    chunk_count INTEGER;
BEGIN
    -- Count chunks to be deleted
    SELECT COUNT(*) INTO chunk_count FROM rag_chunks WHERE org_id = p_org_id;
    
    -- Delete chunks
    DELETE FROM rag_chunks WHERE org_id = p_org_id;
    
    -- Delete org keys
    DELETE FROM org_keys WHERE org_id = p_org_id;
    
    -- Reset document status
    UPDATE documents 
    SET rag_status = 'pending', rag_error = NULL, rag_indexed_at = NULL 
    WHERE org_id = p_org_id;
    
    RETURN chunk_count;
END;
$$;

-- Function to cleanup chunks for a specific document
CREATE OR REPLACE FUNCTION cleanup_document_rag_data(p_document_id UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL
AS $$
DECLARE
    chunk_count INTEGER;
BEGIN
    -- Count chunks to be deleted
    SELECT COUNT(*) INTO chunk_count FROM rag_chunks WHERE document_id = p_document_id;
    
    -- Delete chunks
    DELETE FROM rag_chunks WHERE document_id = p_document_id;
    
    -- Reset document status
    UPDATE documents 
    SET rag_status = 'pending', rag_error = NULL, rag_indexed_at = NULL 
    WHERE id = p_document_id;
    
    RETURN chunk_count;
END;
$$;

-- ============================================================================
-- 6. Triggers for automatic timestamp updates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply to relevant tables
CREATE TRIGGER update_org_keys_updated_at 
    BEFORE UPDATE ON org_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rag_chunks_updated_at 
    BEFORE UPDATE ON rag_chunks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Initial Setup Verification
-- ============================================================================

-- Grant permissions to service role (used by FastAPI)
-- Note: Replace 'service_role' with your actual service role if different
GRANT ALL ON org_keys TO service_role;
GRANT ALL ON rag_chunks TO service_role; 
GRANT EXECUTE ON FUNCTION match_rag_chunks TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_org_rag_data TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_document_rag_data TO service_role;

-- Ensure RPC functions are accessible to authenticated users
GRANT EXECUTE ON FUNCTION match_rag_chunks TO authenticated;

COMMENT ON TABLE org_keys IS 'Stores encrypted Data Encryption Keys (DEK) for each organization using envelope encryption';
COMMENT ON TABLE rag_chunks IS 'Stores encrypted document chunks with embeddings for RAG retrieval';
COMMENT ON FUNCTION match_rag_chunks IS 'Vector similarity search function for RAG retrieval';