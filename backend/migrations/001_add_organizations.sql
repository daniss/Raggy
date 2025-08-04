-- Migration: Add Organizations and Multi-Tenancy Support
-- This migration adds organization support with proper constraints and RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_slug CHECK (
        slug ~ '^[a-z0-9-]+$' AND 
        LENGTH(slug) >= 3 AND 
        LENGTH(slug) <= 50 AND
        slug NOT LIKE '-%' AND 
        slug NOT LIKE '%-' AND
        slug NOT LIKE '%---%'
    ),
    CONSTRAINT valid_name CHECK (LENGTH(TRIM(name)) >= 1)
);

-- Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    invited_by UUID,
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_org_members_organization 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_user 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_invited_by 
        FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Unique constraint: user can only be in organization once
    CONSTRAINT unique_user_per_org UNIQUE (organization_id, user_id)
);

-- Document vectors table for pgvector support
CREATE TABLE IF NOT EXISTS document_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    embedding vector(384), -- 384 dimensions for all-MiniLM-L6-v2
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_doc_vectors_document 
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_vectors_organization 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Unique constraint for chunk identification
    CONSTRAINT unique_document_chunk UNIQUE (document_id, chunk_index)
);

-- Add organization_id to existing tables
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE chat_logs 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add foreign key constraints to existing tables
ALTER TABLE documents 
ADD CONSTRAINT fk_documents_organization 
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE documents 
ADD CONSTRAINT fk_documents_uploaded_by 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE chat_logs 
ADD CONSTRAINT fk_chat_logs_organization 
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE chat_logs 
ADD CONSTRAINT fk_chat_logs_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_organization ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

CREATE INDEX IF NOT EXISTS idx_document_vectors_document ON document_vectors(document_id);
CREATE INDEX IF NOT EXISTS idx_document_vectors_organization ON document_vectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding ON document_vectors USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_documents_organization ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_organization ON chat_logs(organization_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_vectors ENABLE ROW LEVEL SECURITY;

-- Update existing RLS for documents and chat_logs
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE chat_logs FORCE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update their organizations" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
        )
    );

-- RLS Policies for Organization Members
CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can manage organization members" ON organization_members
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
        )
    );

-- RLS Policies for Documents (updated for organizations)
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;

CREATE POLICY "Users can view organization documents" ON documents
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can upload documents to their organizations" ON documents
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        ) AND uploaded_by = auth.uid()
    );

CREATE POLICY "Users can update their own documents" ON documents
    FOR UPDATE USING (
        uploaded_by = auth.uid() AND
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can delete their own documents, admins can delete any" ON documents
    FOR DELETE USING (
        uploaded_by = auth.uid() OR
        (organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
        ))
    );

-- RLS Policies for Document Vectors
CREATE POLICY "Users can view organization document vectors" ON document_vectors
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "System can manage document vectors" ON document_vectors
    FOR ALL USING (true);

-- RLS Policies for Chat Logs (updated for organizations)
DROP POLICY IF EXISTS "Users can view own messages" ON chat_logs;

CREATE POLICY "Users can view organization chat logs" ON chat_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can create chat logs for their organizations" ON chat_logs
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Functions for organization management
CREATE OR REPLACE FUNCTION get_organization_counts(org_id UUID)
RETURNS JSON AS $$
DECLARE
    member_count INTEGER;
    document_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count
    FROM organization_members 
    WHERE organization_id = org_id AND status = 'active';
    
    SELECT COUNT(*) INTO document_count
    FROM documents 
    WHERE organization_id = org_id;
    
    RETURN json_build_object(
        'member_count', member_count,
        'document_count', document_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for organization-scoped vector search
CREATE OR REPLACE FUNCTION search_similar_documents_org(
    query_embedding vector(384),
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
) AS $$
BEGIN
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
    AND 1 - (dv.embedding <=> query_embedding) > match_threshold
    ORDER BY dv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete document vectors by document_id
CREATE OR REPLACE FUNCTION delete_document_vectors(target_document_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM document_vectors 
    WHERE document_id = target_document_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_audit_logs_organization 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_logs_user 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Enable RLS for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization audit logs" ON audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
        )
    );