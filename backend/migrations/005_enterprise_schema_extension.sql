-- RAG Enterprise Dashboard - Database Schema Extensions
-- Phase 4.1: Multi-tenant enterprise features
-- Execute this in your Supabase SQL editor after the base schema

-- Enable additional extensions for enterprise features
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query performance monitoring

-- =============================================================================
-- CORE MULTI-TENANCY TABLES
-- =============================================================================

-- Organizations table (central to multi-tenancy)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter' 
        CHECK (plan IN ('starter', 'team', 'business', 'enterprise')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
    
    -- Settings and limits
    settings JSONB DEFAULT '{
        "dataResidency": "eu",
        "hdsCompliant": false,
        "maxDocuments": 100,
        "maxUsers": 5,
        "maxTokensPerMonth": 50000,
        "maxStorageMB": 1000
    }'::jsonb,
    
    -- Branding and customization
    branding JSONB DEFAULT '{}'::jsonb, -- logo, colors, domain
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Billing
    billing_email VARCHAR(255),
    billing_address JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

-- Organization members (team management)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('admin', 'member', 'viewer', 'dpo', 'billing')),
    status VARCHAR(20) NOT NULL DEFAULT 'invited' 
        CHECK (status IN ('active', 'invited', 'suspended')),
    
    -- Permissions (fine-grained RBAC)
    permissions JSONB DEFAULT '{
        "documents": {"read": true, "write": false, "delete": false},
        "conversations": {"read": true, "moderate": false},
        "analytics": {"read": false},
        "settings": {"read": false, "write": false},
        "billing": {"read": false, "write": false},
        "security": {"read": false, "write": false}
    }'::jsonb,
    
    -- Timestamps
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    last_active TIMESTAMP WITH TIME ZONE,
    
    -- Invitation tracking
    invited_by UUID REFERENCES users(id),
    invitation_token VARCHAR(255) UNIQUE,
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(organization_id, user_id)
);

-- Update existing tables to add organization_id for multi-tenancy
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- =============================================================================
-- ENHANCED DOCUMENT MANAGEMENT
-- =============================================================================

-- Document metadata and governance
CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Metadata and classification
    title VARCHAR(500),
    summary TEXT,
    language VARCHAR(10) DEFAULT 'fr',
    content_type_detected VARCHAR(100),
    
    -- Taxonomy and tags
    tags TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    department VARCHAR(100),
    
    -- PII and compliance
    contains_pii BOOLEAN DEFAULT false,
    pii_types TEXT[] DEFAULT '{}', -- email, phone, ssn, etc.
    sensitivity_level VARCHAR(20) DEFAULT 'public' 
        CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
    
    -- Processing metadata
    extraction_method VARCHAR(50) DEFAULT 'auto',
    chunking_strategy VARCHAR(50) DEFAULT 'recursive',
    chunk_size INTEGER DEFAULT 800,
    chunk_overlap INTEGER DEFAULT 100,
    
    -- Quality metrics
    readability_score FLOAT,
    information_density FLOAT,
    
    -- Timestamps
    processed_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document versions (for tracking changes)
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for deduplication
    changes_summary TEXT,
    
    -- Version metadata
    size_bytes INTEGER NOT NULL,
    chunks_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(document_id, version_number)
);

-- Document vectors (for better performance and organization isolation)
CREATE TABLE IF NOT EXISTS document_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Vector data
    content TEXT NOT NULL,
    embedding VECTOR(384), -- Adjust dimension based on your embedding model
    chunk_index INTEGER NOT NULL,
    
    -- Metadata for retrieval
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Performance fields
    token_count INTEGER,
    character_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- ENHANCED CONVERSATION MANAGEMENT
-- =============================================================================

-- Conversation metadata and moderation
CREATE TABLE IF NOT EXISTS conversation_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Classification
    topic VARCHAR(200),
    intent VARCHAR(100),
    language VARCHAR(10) DEFAULT 'fr',
    
    -- Quality metrics
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    feedback TEXT,
    feedback_tags TEXT[] DEFAULT '{}',
    
    -- Moderation
    requires_review BOOLEAN DEFAULT false,
    flagged_content BOOLEAN DEFAULT false,
    moderation_notes TEXT,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP WITH TIME ZONE,
    
    -- Analytics
    total_messages INTEGER DEFAULT 0,
    total_response_time FLOAT DEFAULT 0,
    sources_used INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message-level moderation and analytics
CREATE TABLE IF NOT EXISTS message_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Performance metrics
    processing_time FLOAT,
    embedding_time FLOAT,
    retrieval_time FLOAT,
    generation_time FLOAT,
    
    -- Quality metrics
    relevance_score FLOAT,
    confidence_score FLOAT,
    source_quality_score FLOAT,
    
    -- Usage tracking
    tokens_used INTEGER,
    cost_cents INTEGER, -- Cost in cents for precise tracking
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PROMPT MANAGEMENT AND PLAYGROUND
-- =============================================================================

-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Template metadata
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general' 
        CHECK (category IN ('general', 'faq', 'summary', 'extraction', 'classification')),
    
    -- Template content
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    
    -- Variables and configuration
    variables JSONB DEFAULT '[]'::jsonb, -- List of template variables
    model_config JSONB DEFAULT '{
        "temperature": 0.1,
        "max_tokens": 2000,
        "top_p": 1.0
    }'::jsonb,
    
    -- Usage and performance
    usage_count INTEGER DEFAULT 0,
    avg_rating FLOAT DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0,
    avg_cost_cents INTEGER DEFAULT 0,
    
    -- Status and versioning
    status VARCHAR(20) DEFAULT 'draft' 
        CHECK (status IN ('draft', 'active', 'archived')),
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Prompt test executions (for A/B testing and optimization)
CREATE TABLE IF NOT EXISTS prompt_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Execution context
    input_variables JSONB NOT NULL,
    rendered_prompt TEXT NOT NULL,
    
    -- Results
    output TEXT,
    response_time FLOAT,
    cost_cents INTEGER,
    tokens_used INTEGER,
    
    -- Quality metrics
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    automated_score FLOAT,
    
    -- Timestamps
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_by UUID REFERENCES users(id)
);

-- =============================================================================
-- SECURITY AND COMPLIANCE
-- =============================================================================

-- Security incidents and tracking
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Incident details
    title VARCHAR(300) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' 
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(50) NOT NULL DEFAULT 'other'
        CHECK (category IN ('data_breach', 'unauthorized_access', 'pii_exposure', 'system_compromise', 'other')),
    
    -- Status and resolution
    status VARCHAR(20) NOT NULL DEFAULT 'open' 
        CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution_notes TEXT,
    
    -- Impact assessment
    affected_users INTEGER DEFAULT 0,
    affected_documents INTEGER DEFAULT 0,
    data_types_affected TEXT[] DEFAULT '{}',
    
    -- Timeline
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    reported_by UUID REFERENCES users(id)
);

-- Data processing activities (RGPD compliance)
CREATE TABLE IF NOT EXISTS data_processing_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Activity details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    purpose TEXT NOT NULL,
    legal_basis VARCHAR(100) NOT NULL,
    
    -- Data categories
    data_categories TEXT[] DEFAULT '{}', -- personal, sensitive, etc.
    data_subjects TEXT[] DEFAULT '{}', -- employees, customers, etc.
    
    -- Processing details
    automated_processing BOOLEAN DEFAULT false,
    profiling_involved BOOLEAN DEFAULT false,
    retention_period_months INTEGER,
    
    -- Third parties
    third_parties_involved BOOLEAN DEFAULT false,
    third_party_details JSONB DEFAULT '{}'::jsonb,
    
    -- Risk assessment
    privacy_impact_score INTEGER CHECK (privacy_impact_score >= 1 AND privacy_impact_score <= 10),
    risk_mitigation_measures TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_by UUID REFERENCES users(id)
);

-- Compliance audits and DPO activities
CREATE TABLE IF NOT EXISTS compliance_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Audit details
    audit_type VARCHAR(50) NOT NULL 
        CHECK (audit_type IN ('internal', 'external', 'regulatory', 'certification')),
    framework VARCHAR(50) NOT NULL 
        CHECK (framework IN ('gdpr', 'hds', 'iso27001', 'soc2', 'custom')),
    
    title VARCHAR(200) NOT NULL,
    description TEXT,
    scope TEXT,
    
    -- Status and timeline
    status VARCHAR(20) NOT NULL DEFAULT 'planned' 
        CHECK (status IN ('planned', 'in_progress', 'completed', 'failed')),
    
    planned_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    score INTEGER CHECK (score >= 0 AND score <= 100),
    findings JSONB DEFAULT '[]'::jsonb,
    recommendations TEXT,
    
    -- Assignment
    auditor_name VARCHAR(100),
    dpo_assigned UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- BILLING AND SUBSCRIPTION MANAGEMENT
-- =============================================================================

-- Subscription plans and pricing
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Pricing
    price_cents INTEGER NOT NULL, -- Monthly price in cents
    billing_interval VARCHAR(20) DEFAULT 'monthly' 
        CHECK (billing_interval IN ('monthly', 'yearly')),
    
    -- Limits and features
    features JSONB DEFAULT '{
        "maxDocuments": 100,
        "maxUsers": 5,
        "maxTokensPerMonth": 50000,
        "maxStorageMB": 1000,
        "advancedAnalytics": false,
        "prioritySupport": false,
        "sso": false,
        "apiAccess": false
    }'::jsonb,
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Subscription details
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    
    -- Billing cycle
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Payment
    payment_method_id VARCHAR(255), -- Stripe payment method ID
    next_invoice_date TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    usage_reset_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Usage period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Usage metrics
    documents_processed INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    storage_used_mb INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    
    -- Costs (in cents for precision)
    total_cost_cents INTEGER DEFAULT 0,
    token_cost_cents INTEGER DEFAULT 0,
    storage_cost_cents INTEGER DEFAULT 0,
    embedding_cost_cents INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, period_start, period_end)
);

-- Invoices and payments
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id),
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Status and dates
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
    
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Line items
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Payment details
    payment_intent_id VARCHAR(255), -- Stripe payment intent
    payment_method_id VARCHAR(255),
    
    -- File references
    pdf_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- ENHANCED ANALYTICS AND REPORTING
-- =============================================================================

-- Daily analytics (enhanced version)
CREATE TABLE IF NOT EXISTS analytics_daily_enhanced (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Usage metrics
    total_queries INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    total_documents_processed INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time FLOAT DEFAULT 0,
    avg_satisfaction FLOAT DEFAULT 0,
    successful_queries INTEGER DEFAULT 0,
    failed_queries INTEGER DEFAULT 0,
    
    -- Cost metrics
    total_cost_cents INTEGER DEFAULT 0,
    token_cost_cents INTEGER DEFAULT 0,
    storage_cost_cents INTEGER DEFAULT 0,
    
    -- Quality metrics
    avg_relevance_score FLOAT DEFAULT 0,
    avg_confidence_score FLOAT DEFAULT 0,
    pii_incidents INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, date)
);

-- Query analytics (for popular topics and optimization)
CREATE TABLE IF NOT EXISTS query_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Query details
    query_hash VARCHAR(64) NOT NULL, -- SHA-256 of normalized query
    query_text TEXT NOT NULL,
    query_category VARCHAR(100),
    
    -- Performance
    execution_count INTEGER DEFAULT 1,
    avg_response_time FLOAT,
    avg_satisfaction FLOAT,
    
    -- Last execution
    last_executed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, query_hash)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Organization-based indexes (critical for multi-tenancy performance)
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_logs_org_id ON chat_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_id ON chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_vectors_org_id ON document_vectors(organization_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_document_metadata_org_tags ON document_metadata USING GIN (organization_id, tags);
CREATE INDEX IF NOT EXISTS idx_document_metadata_pii ON document_metadata(organization_id, contains_pii);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_rating ON conversation_metadata(organization_id, satisfaction_rating);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_org_category ON prompt_templates(organization_id, category, status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_org_date ON analytics_daily_enhanced(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_org_severity ON security_incidents(organization_id, severity, status);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_documents_filename_search ON documents USING GIN (to_tsvector('french', filename));
CREATE INDEX IF NOT EXISTS idx_document_metadata_content_search ON document_metadata USING GIN (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(summary, '')));

-- Vector similarity search index (HNSW for performance)
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding_hnsw 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all organization-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_analytics ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = user_uuid 
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example RLS policies (implement for all tables)
CREATE POLICY "Users can access their organization's data" ON organizations
    FOR ALL USING (id = ANY(get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can access their organization's documents" ON document_metadata
    FOR ALL USING (organization_id = ANY(get_user_organization_ids(auth.uid())));

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to get organization usage statistics
CREATE OR REPLACE FUNCTION get_organization_usage_stats(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    doc_count INTEGER;
    member_count INTEGER;
    current_usage RECORD;
    org_limits RECORD;
BEGIN
    -- Get basic counts
    SELECT COUNT(*) INTO doc_count FROM documents WHERE organization_id = org_id;
    SELECT COUNT(*) INTO member_count FROM organization_members WHERE organization_id = org_id AND status = 'active';
    
    -- Get current month usage
    SELECT * INTO current_usage FROM usage_tracking 
    WHERE organization_id = org_id 
    AND period_start <= CURRENT_DATE 
    AND period_end >= CURRENT_DATE
    LIMIT 1;
    
    -- Get organization limits
    SELECT settings INTO org_limits FROM organizations WHERE id = org_id;
    
    -- Build result JSON
    result := jsonb_build_object(
        'documents', jsonb_build_object(
            'current', doc_count,
            'limit', (org_limits->'maxDocuments')::INTEGER,
            'percentage', CASE 
                WHEN (org_limits->'maxDocuments')::INTEGER > 0 
                THEN (doc_count::FLOAT / (org_limits->'maxDocuments')::INTEGER * 100)::INTEGER
                ELSE 0 
            END
        ),
        'members', jsonb_build_object(
            'current', member_count,
            'limit', (org_limits->'maxUsers')::INTEGER,
            'percentage', CASE 
                WHEN (org_limits->'maxUsers')::INTEGER > 0 
                THEN (member_count::FLOAT / (org_limits->'maxUsers')::INTEGER * 100)::INTEGER
                ELSE 0 
            END
        ),
        'tokens', jsonb_build_object(
            'current', COALESCE(current_usage.tokens_used, 0),
            'limit', (org_limits->'maxTokensPerMonth')::INTEGER,
            'percentage', CASE 
                WHEN (org_limits->'maxTokensPerMonth')::INTEGER > 0 
                THEN (COALESCE(current_usage.tokens_used, 0)::FLOAT / (org_limits->'maxTokensPerMonth')::INTEGER * 100)::INTEGER
                ELSE 0 
            END
        ),
        'storage', jsonb_build_object(
            'current', COALESCE(current_usage.storage_used_mb, 0),
            'limit', (org_limits->'maxStorageMB')::INTEGER,
            'percentage', CASE 
                WHEN (org_limits->'maxStorageMB')::INTEGER > 0 
                THEN (COALESCE(current_usage.storage_used_mb, 0)::FLOAT / (org_limits->'maxStorageMB')::INTEGER * 100)::INTEGER
                ELSE 0 
            END
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_enhanced_daily_analytics()
RETURNS void AS $$
BEGIN
    INSERT INTO analytics_daily_enhanced (
        organization_id,
        date,
        total_queries,
        unique_users,
        avg_response_time,
        successful_queries,
        failed_queries,
        avg_satisfaction,
        total_cost_cents
    )
    SELECT 
        organization_id,
        CURRENT_DATE,
        COUNT(*) as total_queries,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time) as avg_response_time,
        COUNT(*) FILTER (WHERE response_time IS NOT NULL) as successful_queries,
        COUNT(*) FILTER (WHERE response_time IS NULL) as failed_queries,
        AVG(satisfaction_rating) as avg_satisfaction,
        SUM(COALESCE(ma.cost_cents, 0)) as total_cost_cents
    FROM chat_logs cl
    LEFT JOIN chat_messages cm ON cm.conversation_id::text = cl.metadata->>'conversation_id'
    LEFT JOIN message_analytics ma ON ma.message_id = cm.id
    WHERE DATE(cl.created_at) = CURRENT_DATE
    AND cl.organization_id IS NOT NULL
    GROUP BY organization_id
    ON CONFLICT (organization_id, date) DO UPDATE SET
        total_queries = EXCLUDED.total_queries,
        unique_users = EXCLUDED.unique_users,
        avg_response_time = EXCLUDED.avg_response_time,
        successful_queries = EXCLUDED.successful_queries,
        failed_queries = EXCLUDED.failed_queries,
        avg_satisfaction = EXCLUDED.avg_satisfaction,
        total_cost_cents = EXCLUDED.total_cost_cents;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics
CREATE OR REPLACE FUNCTION trigger_update_enhanced_analytics()
RETURNS trigger AS $$
BEGIN
    PERFORM update_enhanced_daily_analytics();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS update_analytics_trigger ON chat_logs;
CREATE TRIGGER update_enhanced_analytics_trigger
    AFTER INSERT ON chat_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_enhanced_analytics();

-- =============================================================================
-- INSERT DEFAULT DATA
-- =============================================================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_cents, features) VALUES
('Starter', 'Perfect for small teams getting started with RAG', 4900, '{
    "maxDocuments": 100,
    "maxUsers": 3,
    "maxTokensPerMonth": 50000,
    "maxStorageMB": 1000,
    "advancedAnalytics": false,
    "prioritySupport": false,
    "sso": false,
    "apiAccess": false
}'),
('Team', 'Great for growing teams with more documents', 14900, '{
    "maxDocuments": 500,
    "maxUsers": 10,
    "maxTokensPerMonth": 200000,
    "maxStorageMB": 5000,
    "advancedAnalytics": true,
    "prioritySupport": false,
    "sso": false,
    "apiAccess": true
}'),
('Business', 'For businesses with advanced compliance needs', 39900, '{
    "maxDocuments": 2000,
    "maxUsers": 25,
    "maxTokensPerMonth": 500000,
    "maxStorageMB": 20000,
    "advancedAnalytics": true,
    "prioritySupport": true,
    "sso": true,
    "apiAccess": true
}'),
('Enterprise', 'Custom solution for large organizations', 99900, '{
    "maxDocuments": 10000,
    "maxUsers": 100,
    "maxTokensPerMonth": 2000000,
    "maxStorageMB": 100000,
    "advancedAnalytics": true,
    "prioritySupport": true,
    "sso": true,
    "apiAccess": true
}')
ON CONFLICT (name) DO NOTHING;

-- Insert default prompt templates
INSERT INTO prompt_templates (organization_id, name, description, category, system_prompt, user_prompt_template) 
SELECT 
    o.id,
    'FAQ Standard',
    'Template standard pour les réponses FAQ',
    'faq',
    'Vous êtes un assistant IA spécialisé dans les réponses aux questions fréquemment posées. Répondez de manière claire, concise et professionnelle en français.',
    'Question: {question}\n\nContexte: {context}\n\nRépondez à cette question en vous basant sur le contexte fourni.'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM prompt_templates pt 
    WHERE pt.organization_id = o.id 
    AND pt.name = 'FAQ Standard'
);

COMMIT;