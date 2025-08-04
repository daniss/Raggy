-- RAG Support Chatbot Database Schema
-- Execute this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table (if not using Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    uploaded_by UUID REFERENCES users(id),
    file_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    response_time FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat analytics/logs table
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    response_time FLOAT NOT NULL,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    UNIQUE(category, key)
);

-- Analytics aggregations table
CREATE TABLE IF NOT EXISTS analytics_daily (
    date DATE PRIMARY KEY,
    total_queries INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0,
    successful_queries INTEGER DEFAULT 0,
    failed_queries INTEGER DEFAULT 0,
    avg_satisfaction FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date DESC);

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust as needed)
-- Users can only see their own documents
CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON chat_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only see messages from their conversations
CREATE POLICY "Users can view own messages" ON chat_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM chat_conversations WHERE user_id = auth.uid()
        )
    );

-- Insert default system settings
INSERT INTO system_settings (category, key, value) VALUES
    ('rag', 'embedding_model', '"sentence-transformers/all-MiniLM-L6-v2"'),
    ('rag', 'chunk_size', '1000'),
    ('rag', 'chunk_overlap', '200'),
    ('rag', 'max_chunks_retrieved', '5'),
    ('rag', 'similarity_threshold', '0.7'),
    ('llm', 'model', '"deepseek-r1-distill-llama-70b"'),
    ('llm', 'temperature', '0.1'),
    ('llm', 'max_tokens', '2000'),
    ('api', 'rate_limit_per_minute', '100'),
    ('api', 'timeout_seconds', '30'),
    ('security', 'enable_cors', 'true'),
    ('security', 'require_authentication', 'false'),
    ('notifications', 'email_notifications', 'true'),
    ('notifications', 'alert_on_errors', 'true')
ON CONFLICT (category, key) DO NOTHING;

-- Functions for analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS void AS $$
BEGIN
    INSERT INTO analytics_daily (
        date,
        total_queries,
        unique_users,
        avg_response_time,
        successful_queries,
        failed_queries,
        avg_satisfaction
    )
    SELECT 
        CURRENT_DATE,
        COUNT(*) as total_queries,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time) as avg_response_time,
        COUNT(*) FILTER (WHERE response_time IS NOT NULL) as successful_queries,
        COUNT(*) FILTER (WHERE response_time IS NULL) as failed_queries,
        AVG(satisfaction_rating) as avg_satisfaction
    FROM chat_logs
    WHERE DATE(created_at) = CURRENT_DATE
    ON CONFLICT (date) DO UPDATE SET
        total_queries = EXCLUDED.total_queries,
        unique_users = EXCLUDED.unique_users,
        avg_response_time = EXCLUDED.avg_response_time,
        successful_queries = EXCLUDED.successful_queries,
        failed_queries = EXCLUDED.failed_queries,
        avg_satisfaction = EXCLUDED.avg_satisfaction;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics
CREATE OR REPLACE FUNCTION trigger_update_analytics()
RETURNS trigger AS $$
BEGIN
    PERFORM update_daily_analytics();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analytics_trigger
    AFTER INSERT ON chat_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_analytics();