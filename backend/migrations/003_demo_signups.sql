-- Demo Signups Migration
-- Creates table for storing demo registration information

-- Create demo_signups table
CREATE TABLE IF NOT EXISTS demo_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted')),
    
    -- Optional fields for analytics
    source VARCHAR(100), -- 'landing', 'direct', 'referral', etc.
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    -- Demo usage tracking
    questions_asked INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    
    -- Conversion tracking
    converted_at TIMESTAMP WITH TIME ZONE,
    conversion_type VARCHAR(50), -- 'quote_request', 'contact', 'call_scheduled'
    
    -- Technical metadata
    ip_address INET,
    user_agent TEXT,
    browser_info JSONB,
    
    CONSTRAINT unique_active_email UNIQUE (email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_demo_signups_email ON demo_signups(email);
CREATE INDEX IF NOT EXISTS idx_demo_signups_session_token ON demo_signups(session_token);
CREATE INDEX IF NOT EXISTS idx_demo_signups_created_at ON demo_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_demo_signups_expires_at ON demo_signups(expires_at);
CREATE INDEX IF NOT EXISTS idx_demo_signups_status ON demo_signups(status);
CREATE INDEX IF NOT EXISTS idx_demo_signups_source ON demo_signups(source);

-- Create demo_sessions table for session management
CREATE TABLE IF NOT EXISTS demo_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demo_signup_id UUID REFERENCES demo_signups(id) ON DELETE CASCADE,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Session activity
    pages_visited JSONB DEFAULT '[]',
    interactions JSONB DEFAULT '[]',
    questions_asked JSONB DEFAULT '[]',
    documents_viewed JSONB DEFAULT '[]',
    
    -- Exit tracking
    exit_page VARCHAR(255),
    exit_action VARCHAR(100), -- 'timeout', 'manual', 'conversion', 'navigation'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for demo_sessions
CREATE INDEX IF NOT EXISTS idx_demo_sessions_signup_id ON demo_sessions(demo_signup_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_session_start ON demo_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_duration ON demo_sessions(duration_seconds);

-- Function to cleanup expired demo signups
CREATE OR REPLACE FUNCTION cleanup_expired_demo_signups()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired demo signups and their associated data
    WITH deleted AS (
        DELETE FROM demo_signups 
        WHERE expires_at < NOW() 
        AND status != 'converted'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update demo signup activity
CREATE OR REPLACE FUNCTION update_demo_activity(
    p_session_token VARCHAR(255),
    p_interaction_type VARCHAR(100) DEFAULT 'page_view',
    p_interaction_data JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    signup_id UUID;
BEGIN
    -- Update last activity and increment counters
    UPDATE demo_signups 
    SET 
        last_activity_at = NOW(),
        total_interactions = total_interactions + 1,
        questions_asked = CASE 
            WHEN p_interaction_type = 'question' THEN questions_asked + 1 
            ELSE questions_asked 
        END,
        documents_uploaded = CASE 
            WHEN p_interaction_type = 'upload' THEN documents_uploaded + 1 
            ELSE documents_uploaded 
        END
    WHERE session_token = p_session_token
    AND status = 'active'
    AND expires_at > NOW()
    RETURNING id INTO signup_id;
    
    -- Log the interaction in demo_sessions if signup exists
    IF signup_id IS NOT NULL THEN
        INSERT INTO demo_sessions (demo_signup_id, interactions, pages_visited)
        VALUES (
            signup_id, 
            JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
                'type', p_interaction_type,
                'timestamp', NOW(),
                'data', p_interaction_data
            )),
            '[]'
        )
        ON CONFLICT (demo_signup_id) DO UPDATE SET
            interactions = demo_sessions.interactions || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
                'type', p_interaction_type,
                'timestamp', NOW(),
                'data', p_interaction_data
            )),
            updated_at = NOW();
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to convert demo signup
CREATE OR REPLACE FUNCTION convert_demo_signup(
    p_session_token VARCHAR(255),
    p_conversion_type VARCHAR(50) DEFAULT 'quote_request'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE demo_signups 
    SET 
        status = 'converted',
        converted_at = NOW(),
        conversion_type = p_conversion_type
    WHERE session_token = p_session_token
    AND status = 'active';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a view for demo analytics
CREATE OR REPLACE VIEW demo_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as signup_date,
    COUNT(*) as total_signups,
    COUNT(CASE WHEN status = 'converted' THEN 1 END) as conversions,
    COUNT(CASE WHEN status = 'active' AND expires_at > NOW() THEN 1 END) as active_demos,
    COUNT(CASE WHEN status = 'expired' OR expires_at <= NOW() THEN 1 END) as expired_demos,
    
    -- Conversion metrics
    ROUND(
        COUNT(CASE WHEN status = 'converted' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(*), 0), 2
    ) as conversion_rate_percent,
    
    -- Engagement metrics
    AVG(questions_asked) as avg_questions_per_demo,
    AVG(documents_uploaded) as avg_uploads_per_demo,
    AVG(total_interactions) as avg_interactions_per_demo,
    
    -- Source analysis
    source,
    utm_source,
    utm_campaign
FROM demo_signups
GROUP BY 
    DATE_TRUNC('day', created_at),
    source,
    utm_source,
    utm_campaign
ORDER BY signup_date DESC;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON demo_signups TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON demo_sessions TO your_app_user;
-- GRANT SELECT ON demo_analytics TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_demo_signups() TO your_app_user;
-- GRANT EXECUTE ON FUNCTION update_demo_activity(VARCHAR, VARCHAR, JSONB) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION convert_demo_signup(VARCHAR, VARCHAR) TO your_app_user;

-- Insert sample data for testing (remove in production)
-- INSERT INTO demo_signups (email, company_name, session_token, expires_at, source, questions_asked, total_interactions)
-- VALUES 
-- ('test@example.com', 'Test Company', 'demo_test_123', NOW() + INTERVAL '24 hours', 'landing', 5, 12),
-- ('demo@enterprise.fr', 'Enterprise Corp', 'demo_test_456', NOW() + INTERVAL '24 hours', 'referral', 8, 20);

COMMENT ON TABLE demo_signups IS 'Stores demo registration information and tracks user engagement';
COMMENT ON TABLE demo_sessions IS 'Tracks detailed session activity for demo users';
COMMENT ON VIEW demo_analytics IS 'Provides aggregated analytics for demo performance and conversion tracking';