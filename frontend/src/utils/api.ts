import axios, { AxiosResponse, AxiosError } from 'axios';
import { createClient } from '@/utils/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    // Get auth token from Supabase session
    if (typeof window !== 'undefined') {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - sign out and redirect to login
      if (typeof window !== 'undefined') {
        const supabase = createClient();
        supabase.auth.signOut();
        window.location.href = '/auth/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API Types
export interface ChatRequest {
  question: string;
  conversation_id?: string;
}

export interface Source {
  content: string;
  metadata: Record<string, any>;
  score?: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  conversation_id: string;
  response_time: number;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  document_id?: string;
  chunks_created?: number;
}

export interface AnalyticsResponse {
  total_queries: number;
  avg_response_time: number;
  recent_queries: any[];
  popular_topics: any[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  dependencies: Record<string, string>;
}

// API Functions
export const chatApi = {
  /**
   * Send a chat message
   */
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', request);
    return response.data;
  },

  /**
   * Get chat health status
   */
  getHealth: async (): Promise<any> => {
    const response = await api.get('/chat/health');
    return response.data;
  },

  /**
   * Get chat statistics
   */
  getStats: async (): Promise<any> => {
    const response = await api.get('/chat/stats');
    return response.data;
  },
};

export const uploadApi = {
  /**
   * Upload documents
   */
  uploadDocuments: async (files: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * List uploaded documents
   */
  listDocuments: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
  }): Promise<any> => {
    const response = await api.get('/upload/documents', { params });
    return response.data;
  },

  /**
   * Delete a document
   */
  deleteDocument: async (documentId: string): Promise<any> => {
    const response = await api.delete(`/upload/documents/${documentId}`);
    return response.data;
  },

  /**
   * Reset knowledge base
   */
  resetKnowledgeBase: async (): Promise<any> => {
    const response = await api.post('/upload/reset');
    return response.data;
  },

  /**
   * Get upload statistics
   */
  getStats: async (): Promise<any> => {
    const response = await api.get('/upload/stats');
    return response.data;
  },
};

export const analyticsApi = {
  /**
   * Get analytics data
   */
  getAnalytics: async (days: number = 30): Promise<AnalyticsResponse> => {
    const response = await api.get<AnalyticsResponse>(`/analytics?days=${days}`);
    return response.data;
  },

  /**
   * Get time-series analytics
   */
  getTimeSeries: async (days: number = 7): Promise<any> => {
    const response = await api.get(`/analytics/time-series?days=${days}`);
    return response.data;
  },

  /**
   * Get popular topics
   */
  getPopularTopics: async (days: number = 30, limit: number = 10): Promise<any> => {
    const response = await api.get(`/analytics/popular-topics?days=${days}&limit=${limit}`);
    return response.data;
  },

  /**
   * Get user satisfaction metrics
   */
  getUserSatisfaction: async (days: number = 30): Promise<any> => {
    const response = await api.get(`/analytics/user-satisfaction?days=${days}`);
    return response.data;
  },

  /**
   * Export analytics data
   */
  exportAnalytics: async (format: 'json' | 'csv' = 'json', days: number = 30): Promise<any> => {
    const response = await api.get(`/analytics/export?format=${format}&days=${days}`, {
      responseType: format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  },
};

export const healthApi = {
  /**
   * Get application health
   */
  getHealth: async (): Promise<HealthResponse> => {
    const response = await api.get<HealthResponse>('/health', {
      baseURL: API_BASE_URL, // Use root health endpoint
    });
    return response.data;
  },
};

// Organization API Types
export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan: string;
  member_count: number;
  document_count: number;
  created_at: string;
}

export interface MemberInfo {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'suspended';
  joined_at?: string;
  invited_at?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member';
}

export interface UsageStats {
  organization: {
    id: string;
    name: string;
    plan: string;
  };
  document_usage: {
    current_documents: number;
    max_documents: number;
    usage_percentage: number;
    max_document_size_mb: number;
  };
  api_usage?: {
    current_requests: number;
    max_requests: number;
    usage_percentage: number;
  };
  storage_usage?: {
    current_storage_mb: number;
    max_storage_mb: number;
    usage_percentage: number;
  };
  user_usage?: {
    current_users: number;
    max_users: number;
    usage_percentage: number;
  };
}

export const organizationApi = {
  /**
   * Get current organization info
   */
  getCurrentOrganization: async (): Promise<OrganizationInfo> => {
    const response = await api.get<OrganizationInfo>('/organizations/current');
    return response.data;
  },

  /**
   * Get organization members
   */
  getMembers: async (): Promise<MemberInfo[]> => {
    const response = await api.get<MemberInfo[]>('/organizations/members');
    return response.data;
  },

  /**
   * Invite a member to the organization
   */
  inviteMember: async (request: InviteMemberRequest): Promise<{ message: string }> => {
    const response = await api.post('/organizations/members/invite', request);
    return response.data;
  },

  /**
   * Update a member's role or status
   */
  updateMember: async (memberId: string, updates: { role?: 'admin' | 'member'; status?: 'active' | 'suspended' }): Promise<{ message: string }> => {
    const response = await api.put(`/organizations/members/${memberId}`, updates);
    return response.data;
  },

  /**
   * Remove a member from the organization
   */
  removeMember: async (memberId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/organizations/members/${memberId}`);
    return response.data;
  },

  /**
   * Update organization info
   */
  updateOrganization: async (updates: { name?: string; description?: string }): Promise<{ message: string }> => {
    const response = await api.put('/organizations/current', updates);
    return response.data;
  },
};

export const usageApi = {
  /**
   * Get current usage statistics
   */
  getCurrentUsage: async (): Promise<UsageStats> => {
    const response = await api.get<UsageStats>('/usage/current');
    return response.data;
  },

  /**
   * Get plan limits and features
   */
  getPlanLimits: async (): Promise<any> => {
    const response = await api.get('/usage/limits');
    return response.data;
  },

  /**
   * Get quota status with warnings
   */
  getQuotaStatus: async (): Promise<any> => {
    const response = await api.get('/usage/quotas');
    return response.data;
  },
};

// Utility functions
export const handleApiError = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.message) {
    return error.message;
  }
  return 'Une erreur inattendue s\'est produite';
};

export const isApiError = (error: any): boolean => {
  return error.isAxiosError || error.response;
};

export default api;