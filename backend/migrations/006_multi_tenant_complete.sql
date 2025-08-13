-- =============================================================================
-- MULTI-TENANT ARCHITECTURE - COMPLETE SCHEMA
-- This migration implements the full multi-tenant architecture per specification
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CORE TENANCY TABLES
-- =============================================================================

-- Organizations table (update existing if needed)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'starter' 
    CHECK (tier IN ('starter', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS dedicated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'FR';

-- Update status check constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check 
    CHECK (status IN ('active', 'suspended', 'trial', 'cancelled'));

-- Organization members (update role constraint)
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['user']::TEXT[],
ALTER COLUMN role SET DEFAULT 'user';

ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'knowledge_manager', 'user', 'observer', 'billing_admin', 'security_admin'));

-- Organization invitations (new table)
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT ARRAY['user']::TEXT[],
    invited_by UUID REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    accepted_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add organization_id to all tenant-scoped tables
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Answers table for tracking citations and tokens
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    latency_ms INTEGER,
    tokens_input INTEGER,
    tokens_output INTEGER,
    citations JSONB DEFAULT '[]'::JSONB,
    status VARCHAR(20) DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purge proofs for compliance
CREATE TABLE IF NOT EXISTS purge_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    before_stats JSONB NOT NULL,
    after_stats JSONB NOT NULL,
    hash_before VARCHAR(64) NOT NULL,
    hash_after VARCHAR(64) NOT NULL,
    proof_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    requested_by UUID REFERENCES users(id)
);

-- Monthly usage tracking
CREATE TABLE IF NOT EXISTS usage_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month_ym VARCHAR(6) NOT NULL, -- YYYYMM format
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    documents_added INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, month_ym)
);

-- Organization settings
CREATE TABLE IF NOT EXISTS org_settings (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    retention_days INTEGER DEFAULT 0, -- 0 means manual purge only
    token_limit_month INTEGER DEFAULT 200000,
    document_limit INTEGER DEFAULT 100,
    feature_flags JSONB DEFAULT '{}'::JSONB,
    default_prompt TEXT,
    allow_user_org_switch BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    hashed_key VARCHAR(255) NOT NULL,
    prefix VARCHAR(10) NOT NULL, -- for display (ragk_xxxx)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id UUID REFERENCES users(id),
    scope VARCHAR(20) DEFAULT 'read' CHECK (scope IN ('read', 'write', 'admin')),
    is_active BOOLEAN DEFAULT true
);

-- Connectors for data sources
CREATE TABLE IF NOT EXISTS connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sharepoint', 's3', 'drive', 'confluence', 'slack', 'custom')),
    config JSONB NOT NULL, -- encrypted in application layer
    status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Connector runs history
CREATE TABLE IF NOT EXISTS connector_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    stats JSONB DEFAULT '{}'::JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE
);

-- Billing subscriptions
CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(20) DEFAULT 'stripe' CHECK (provider IN ('stripe', 'manual')),
    plan_code VARCHAR(50) NOT NULL,
    seats_allowed INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    currency VARCHAR(3) DEFAULT 'EUR',
    amount_cents_mrc INTEGER NOT NULL, -- Monthly recurring charge in cents
    amount_cents_setup INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature gate events for tracking
CREATE TABLE IF NOT EXISTS feature_gate_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    feature_code VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_org_id UUID REFERENCES organizations(id),
    ui_density VARCHAR(20) DEFAULT 'normal' CHECK (ui_density IN ('compact', 'normal', 'comfortable')),
    language VARCHAR(10) DEFAULT 'fr',
    time_format_24h BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Organization-based indexes (critical for multi-tenancy)
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_created ON documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_id ON chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_id ON chat_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_event ON audit_logs(org_id, event_type);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_org_month ON usage_monthly(org_id, month_ym);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON organization_invitations(org_id, email);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purge_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    -- Documents policies
    DROP POLICY IF EXISTS org_isolation_documents ON documents;
    DROP POLICY IF EXISTS org_isolation_chat_conversations ON chat_conversations;
    DROP POLICY IF EXISTS org_isolation_chat_messages ON chat_messages;
    DROP POLICY IF EXISTS org_isolation_answers ON answers;
    DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs;
    DROP POLICY IF EXISTS org_isolation_purge_proofs ON purge_proofs;
    DROP POLICY IF EXISTS org_isolation_usage_monthly ON usage_monthly;
    DROP POLICY IF EXISTS org_isolation_org_settings ON org_settings;
    DROP POLICY IF EXISTS org_isolation_api_keys ON api_keys;
    DROP POLICY IF EXISTS org_isolation_connectors ON connectors;
    DROP POLICY IF EXISTS org_isolation_connector_runs ON connector_runs;
    DROP POLICY IF EXISTS org_isolation_billing_subscriptions ON billing_subscriptions;
    DROP POLICY IF EXISTS org_isolation_feature_gate_events ON feature_gate_events;
    DROP POLICY IF EXISTS org_isolation_invitations ON organization_invitations;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create RLS policies using current_setting
CREATE POLICY org_isolation_documents ON documents
    FOR ALL USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_chat_conversations ON chat_conversations
    FOR ALL USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_chat_messages ON chat_messages
    FOR ALL USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_answers ON answers
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_audit_logs ON audit_logs
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_purge_proofs ON purge_proofs
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_usage_monthly ON usage_monthly
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_org_settings ON org_settings
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_api_keys ON api_keys
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_connectors ON connectors
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_connector_runs ON connector_runs
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_billing_subscriptions ON billing_subscriptions
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_feature_gate_events ON feature_gate_events
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_isolation_invitations ON organization_invitations
    FOR ALL USING (org_id = current_setting('app.current_org', true)::uuid);

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to search similar documents within organization
CREATE OR REPLACE FUNCTION search_similar_documents_org(
    p_org_id UUID,
    p_query_embedding VECTOR,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    document_id UUID,
    content TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.document_id,
        dv.content,
        1 - (dv.embedding <=> p_query_embedding) as similarity
    FROM document_vectors dv
    WHERE dv.organization_id = p_org_id
    ORDER BY dv.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get organization member counts
CREATE OR REPLACE FUNCTION get_organization_counts(p_org_id UUID)
RETURNS TABLE (
    member_count INTEGER,
    document_count INTEGER,
    active_users_30d INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM organization_members WHERE organization_id = p_org_id AND status = 'active'),
        (SELECT COUNT(*)::INTEGER FROM documents WHERE organization_id = p_org_id),
        (SELECT COUNT(DISTINCT user_id)::INTEGER 
         FROM organization_members 
         WHERE organization_id = p_org_id 
         AND last_active > NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- Function to delete document and its vectors
CREATE OR REPLACE FUNCTION delete_document_vectors(p_doc_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM document_vectors 
    WHERE document_id = p_doc_id 
    AND organization_id = p_org_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to update usage_monthly on document operations
CREATE OR REPLACE FUNCTION update_usage_monthly()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO usage_monthly (org_id, month_ym, documents_added, storage_bytes)
        VALUES (
            NEW.organization_id,
            TO_CHAR(NOW(), 'YYYYMM'),
            1,
            COALESCE(NEW.size_bytes, 0)
        )
        ON CONFLICT (org_id, month_ym) DO UPDATE
        SET 
            documents_added = usage_monthly.documents_added + 1,
            storage_bytes = usage_monthly.storage_bytes + EXCLUDED.storage_bytes,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_usage_monthly_trigger ON documents;
CREATE TRIGGER update_usage_monthly_trigger
    AFTER INSERT ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_usage_monthly();

-- Trigger to log audit events
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
    v_payload JSONB;
BEGIN
    -- Determine event type based on table and operation
    v_event_type := TG_TABLE_NAME || '.' || LOWER(TG_OP);
    
    -- Build payload
    IF TG_OP = 'DELETE' THEN
        v_payload := to_jsonb(OLD);
    ELSE
        v_payload := to_jsonb(NEW);
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (org_id, event_type, payload)
    VALUES (
        COALESCE(NEW.organization_id, NEW.org_id, OLD.organization_id, OLD.org_id),
        v_event_type,
        v_payload
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to key tables
DROP TRIGGER IF EXISTS audit_documents ON documents;
CREATE TRIGGER audit_documents
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS audit_api_keys ON api_keys;
CREATE TRIGGER audit_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_event();

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Insert default organization for migration (if no orgs exist)
INSERT INTO organizations (id, name, slug, tier, status, settings)
SELECT 
    'demo-org-12345'::UUID,
    'Organisation Démonstration',
    'demo-org',
    'starter',
    'active',
    jsonb_build_object(
        'dataResidency', 'fr',
        'hdsCompliant', false,
        'maxDocuments', 100,
        'maxUsers', 5,
        'maxTokensPerMonth', 200000,
        'maxStorageMB', 1000
    )
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- Backfill organization_id for existing data (assign to demo org)
UPDATE documents 
SET organization_id = 'demo-org-12345'::UUID 
WHERE organization_id IS NULL;

UPDATE chat_conversations 
SET organization_id = 'demo-org-12345'::UUID 
WHERE organization_id IS NULL;

UPDATE chat_messages 
SET organization_id = 'demo-org-12345'::UUID 
WHERE organization_id IS NULL;