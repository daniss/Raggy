import axios, { AxiosResponse, AxiosError } from 'axios';
import { createClient } from '@/utils/supabase';

// Use relative URLs to leverage Next.js rewrites
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  // Don't set default Content-Type - let axios handle it based on data type
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
        console.log('✓ Added auth token to request:', config.url);
        console.log('🔍 Token details:', {
          length: session.access_token.length,
          starts_with: session.access_token.substring(0, 20) + '...',
          expires_at: session.expires_at,
          token_type: session.token_type,
          user_id: session.user?.id
        });
      } else {
        console.error('⚠ NO AUTH TOKEN AVAILABLE for request:', config.url);
        console.error('🔍 Session debug:', { session, hasSession: !!session });
      }
    }

    // Handle Content-Type intelligently
    const isFormData = config.data instanceof FormData;
    
    if (isFormData) {
      // For FormData, don't set Content-Type - let axios/browser handle it
      console.debug('📄 FormData detected, letting browser set Content-Type with boundary');
      // Remove any existing Content-Type to avoid conflicts
      if (config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
      }
    } else if (!config.headers['Content-Type']) {
      // For non-FormData requests, set JSON Content-Type
      config.headers['Content-Type'] = 'application/json';
      console.debug('📝 Set Content-Type to application/json for:', config.url);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling (auth-only)
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.debug('✓ Request successful:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error: AxiosError) => {
    // Enhanced error logging
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const responseData = error.response?.data;
    
    console.error('❌ API Request failed:', {
      url,
      method,
      status,
      statusText,
      data: responseData,
      headers: error.config?.headers
    });
    
    // Handle common errors
    if (error.response?.status === 401) {
      console.error('🔒 Authentication failed - 401 Unauthorized');
      
      // Auto-logout on authentication failure
      if (typeof window !== 'undefined') {
        console.log('🚪 Signing out user due to auth failure');
        const supabase = createClient();
        supabase.auth.signOut();
        window.location.href = '/login';
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
   * Upload documents (authenticated mode)
   */
  uploadDocuments: async (files: File[]): Promise<UploadResponse> => {
    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    console.log('🔄 Starting authenticated upload for', files.length, 'files');
    
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file);
      console.debug(`📎 Added file ${index + 1}:`, file.name, `(${file.size} bytes)`);
    });

    try {
      // Don't set Content-Type manually - let axios handle FormData properly
      console.debug('🚀 Sending upload request to /api/v1/upload/');
      const response = await api.post<UploadResponse>('/upload/', formData);
      
      console.log('✅ Upload successful:', response.data.message);
      return response.data;
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error; // Re-throw to let caller handle it
    }
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

export const documentApi = {
  /**
   * Get document details and content
   */
  getDocument: async (documentId: string): Promise<any> => {
    const response = await api.get(`/upload/documents/${documentId}`);
    return response.data;
  },

  /**
   * Get document chunks for preview
   */
  getDocumentChunks: async (documentId: string): Promise<any[]> => {
    const response = await api.get(`/upload/documents/${documentId}/chunks`);
    return response.data;
  },

  /**
   * Download a document
   */
  downloadDocument: async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/upload/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get document analytics
   */
  getDocumentAnalytics: async (documentId: string): Promise<any> => {
    const response = await api.get(`/upload/documents/${documentId}/analytics`);
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

export const advancedAnalyticsApi = {
  /**
   * Get advanced dashboard data
   */
  getDashboard: async (days: number = 30): Promise<any> => {
    const response = await api.get(`/analytics/advanced/dashboard?days=${days}`);
    return response.data;
  },

  /**
   * Get user engagement metrics
   */
  getUserEngagement: async (days: number = 30): Promise<any> => {
    const response = await api.get(`/analytics/advanced/user-engagement?days=${days}`);
    return response.data;
  },

  /**
   * Get document effectiveness analysis
   */
  getDocumentEffectiveness: async (days: number = 30): Promise<any> => {
    const response = await api.get(`/analytics/advanced/document-effectiveness?days=${days}`);
    return response.data;
  },

  /**
   * Get system health metrics
   */
  getSystemHealth: async (days: number = 7): Promise<any> => {
    const response = await api.get(`/analytics/advanced/system-health?days=${days}`);
    return response.data;
  },
};

export const healthApi = {
  /**
   * Get application health
   */
  getHealth: async (): Promise<HealthResponse> => {
    const response = await api.get<HealthResponse>('/health');
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
  // Log the full error for debugging
  console.error('API Error:', {
    message: error.message,
    response: error.response?.data,
    status: error.response?.status,
    config: {
      url: error.config?.url,
      method: error.config?.method,
      data: error.config?.data
    }
  });

  // Authentication-specific errors
  if (error.response?.status === 401) {
    return 'Session expirée. Veuillez vous reconnecter.';
  }

  if (error.response?.status === 403) {
    return 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
  }

  // Specific error messages from API
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Upload-specific errors
  if (error.response?.status === 413) {
    return 'Fichier trop volumineux. Taille maximale : 50 MB pour les utilisateurs authentifiés, 10 MB pour la démo.';
  }
  if (error.response?.status === 415) {
    return 'Type de fichier non supporté. Formats acceptés : PDF, DOCX, TXT, CSV, XLSX.';
  }
  if (error.response?.status === 422) {
    return 'Erreur de validation. Vérifiez le format et le contenu de votre fichier.';
  }

  // Server errors
  if (error.response?.status === 500) {
    return 'Erreur interne du serveur. Veuillez réessayer dans quelques instants.';
  }
  if (error.response?.status === 502) {
    return 'Service temporairement indisponible. Veuillez réessayer dans quelques instants.';
  }
  if (error.response?.status === 503) {
    return 'Service en cours de maintenance. Veuillez réessayer plus tard.';
  }

  // Network errors
  if (error.message?.includes('timeout')) {
    return 'Délai d\'attente dépassé. Le document peut être en cours de traitement.';
  }
  if (error.message?.includes('Network Error')) {
    return 'Erreur de connexion. Vérifiez votre connexion internet.';
  }

  // Generic fallback
  if (error.message) {
    return error.message;
  }
  return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
};

export const isApiError = (error: any): boolean => {
  return error.isAxiosError || error.response;
};

export default api;