-- Migration: Add conversation_id to chat_logs table
-- Date: 2025-08-10
-- Purpose: Enable conversation history tracking for improved context

-- Add conversation_id column to chat_logs table
ALTER TABLE chat_logs 
ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- Create index for efficient conversation retrieval
CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation_id 
ON chat_logs(conversation_id, created_at DESC);

-- Create index for organization-scoped conversation queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_org_conversation 
ON chat_logs(organization_id, conversation_id, created_at DESC);

-- Update RLS policy to allow conversation-based queries
-- (Assuming existing RLS policies already handle organization_id filtering)

COMMENT ON COLUMN chat_logs.conversation_id IS 'Unique identifier for conversation thread, enables context continuity';