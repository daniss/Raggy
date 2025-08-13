/**
 * Dashboard API utilities for connecting to real backend data
 */

const API_BASE_URL = ''; // Use relative URLs to leverage Next.js rewrites

export interface DashboardOverview {
  kpi_tokens_month: {
    value: number;
    trend: number;
    label: string;
  };
  kpi_latency: {
    p50: number;
    p95: number;
    trend: number;
  };
  kpi_satisfaction: {
    value: number;
    trend: number;
    count: number;
  };
  recent_activity: Array<{
    id: string;
    type: 'upload' | 'conversation' | 'system';
    description: string;
    timestamp: string;
    user?: string;
  }>;
}

export interface Document {
  id: string;
  filename: string;
  size_mb: number;
  status: 'processing' | 'ready' | 'failed';
  embedding_version: string;
  chunks: number;
  duplicates: number;
  updated_at: string;
}

export interface Conversation {
  conversation_id: string;
  messages: number;
  avg_latency: number;
  csat?: number;
  updated_at: string;
}

export interface ServiceHealth {
  backend_status: 'healthy' | 'degraded' | 'down';
  vector_status: 'healthy' | 'degraded' | 'down';
  llm_status: 'healthy' | 'degraded' | 'down';
  uptime: string;
}

class DashboardAPI {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      // Get auth token from Supabase session
      let authHeaders = {};
      if (typeof window !== 'undefined') {
        const { createClient } = await import('@/utils/supabase');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeaders = {
            'Authorization': `Bearer ${session.access_token}`
          };
        }
      }
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Dashboard Overview - Real KPIs and metrics
  async getDashboardOverview(orgId?: string): Promise<DashboardOverview> {
    const endpoint = orgId 
      ? `/api/v1/dashboard/overview?org_id=${orgId}`
      : '/api/v1/dashboard/overview';
    
    return this.request<DashboardOverview>(endpoint);
  }

  // Documents - Real document list and stats
  async getDocuments(orgId?: string): Promise<Document[]> {
    const endpoint = orgId 
      ? `/api/v1/documents?org_id=${orgId}`
      : '/api/v1/documents';
    
    return this.request<Document[]>(endpoint);
  }

  async getDocumentStats(orgId?: string) {
    const endpoint = orgId 
      ? `/api/v1/documents/stats?org_id=${orgId}`
      : '/api/v1/documents/stats';
    
    return this.request<{
      total_docs: number;
      total_vectors: number;
      total_size_mb: number;
      duplicate_rate: number;
    }>(endpoint);
  }

  // Conversations - Real conversation data
  async getConversations(orgId?: string): Promise<Conversation[]> {
    const endpoint = orgId 
      ? `/api/v1/conversations?org_id=${orgId}`
      : '/api/v1/conversations';
    
    return this.request<Conversation[]>(endpoint);
  }

  // Health Status - Real service status
  async getServiceHealth(): Promise<ServiceHealth> {
    return this.request<ServiceHealth>('/api/v1/status/health');
  }

  // Fallback methods for when endpoints don't exist yet - query Supabase directly
  async getDocumentsFromSupabase(orgId?: string): Promise<Document[]> {
    // This will query the documents table directly via our backend
    return this.request<Document[]>('/api/v1/supabase/documents');
  }

  async getConversationsFromSupabase(orgId?: string): Promise<Conversation[]> {
    // This will query chat_conversations table directly via our backend  
    return this.request<Conversation[]>('/api/v1/supabase/conversations');
  }

  async getOverviewFromSupabase(): Promise<Partial<DashboardOverview>> {
    // Get real data from multiple Supabase tables
    return this.request<Partial<DashboardOverview>>('/api/v1/supabase/overview');
  }
}

// Export singleton instance
export const dashboardApi = new DashboardAPI();

// Hook for React components
export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = async <T>(apiCall: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiCall();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { fetchData, loading, error };
}

import { useState } from 'react';