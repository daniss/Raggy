-- Raggy Single-Client Database Schema
-- Simplified schema for individual client deployments

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    chunks_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    file_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Add category for better organization
    category VARCHAR(100),
    tags TEXT[]
);

-- Document vectors table for RAG
CREATE TABLE IF NOT EXISTS document_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),  -- For multilingual-e5-large
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- Chat logs table
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    response_time FLOAT NOT NULL,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Demo sessions table (for sandbox mode)
CREATE TABLE IF NOT EXISTS demo_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    company_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    documents_uploaded INTEGER DEFAULT 0,
    queries_made INTEGER DEFAULT 0
);

-- Client configuration table
CREATE TABLE IF NOT EXISTS client_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(255) NOT NULL,
    deployment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config JSONB DEFAULT '{}'::jsonb,
    branding JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding_hnsw 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_token ON demo_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires ON demo_sessions(expires_at);

-- Function to search similar documents
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(384),
    match_count integer DEFAULT 10,
    threshold float DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_index INTEGER,
    content TEXT,
    similarity float,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.id,
        dv.document_id,
        dv.chunk_index,
        dv.content,
        1 - (dv.embedding <=> query_embedding) as similarity,
        dv.metadata
    FROM document_vectors dv
    WHERE 1 - (dv.embedding <=> query_embedding) > threshold
    ORDER BY dv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to cleanup expired demo sessions
CREATE OR REPLACE FUNCTION cleanup_expired_demos()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete expired demo sessions and their associated data
    DELETE FROM chat_logs 
    WHERE session_id IN (
        SELECT session_token FROM demo_sessions 
        WHERE expires_at < NOW()
    );
    
    DELETE FROM demo_sessions 
    WHERE expires_at < NOW();
END;
$$;

-- Create a simple analytics view
CREATE OR REPLACE VIEW analytics_summary AS
SELECT 
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT dv.id) as total_chunks,
    COUNT(DISTINCT cl.id) as total_queries,
    AVG(cl.response_time) as avg_response_time,
    AVG(cl.satisfaction_rating) as avg_satisfaction,
    COUNT(DISTINCT cl.session_id) as unique_sessions
FROM documents d
LEFT JOIN document_vectors dv ON d.id = dv.document_id
LEFT JOIN chat_logs cl ON cl.created_at >= NOW() - INTERVAL '30 days';

-- Insert default client configuration
INSERT INTO client_config (client_name, config, branding, features)
VALUES (
    'Demo Client',
    '{"max_documents": 100, "max_queries_per_day": 1000}'::jsonb,
    '{"primary_color": "#1e40af", "logo_url": null, "company_name": "Votre Entreprise"}'::jsonb,
    '{"chat_enabled": true, "upload_enabled": true, "export_enabled": true}'::jsonb
) ON CONFLICT DO NOTHING;