'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase';
import axios from 'axios';

// API Client Setup - use relative URLs to leverage Next.js rewrites
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Types for enterprise API responses
export interface AnalyticsDashboard {
  metrics: {
    totalQueries: number;
    uniqueUsers: number;
    avgResponseTime: number;
    avgSatisfaction: number;
    totalDocuments: number;
    activeUsers: number;
    costThisMonth: number;
    quotaUsage: number;
  };
  charts: {
    queryVolume: Array<{ date: string; queries: number; users: number }>;
    satisfaction: Array<{ date: string; positive: number; negative: number; neutral: number }>;
    responseTime: Array<{ date: string; avg: number; p95: number }>;
    topQueries: Array<{ query: string; count: number; satisfaction: number }>;
  };
}

export interface SecurityIncident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  title: string;
  description: string;
  detected_at: string;
  resolved_at?: string;
  assigned_to?: string;
}

export interface BillingInfo {
  subscription: {
    plan: string;
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
  usage: {
    queries: number;
    documents: number;
    users: number;
    storage_mb: number;
  };
  invoices: Array<{
    id: string;
    amount: number;
    status: string;
    due_date: string;
    invoice_pdf?: string;
  }>;
}

interface EnterpriseApiContextType {
  // Analytics queries
  useAnalyticsDashboard: (organizationId: string) => any;
  useQueryAnalytics: (organizationId: string, period: string) => any;
  useUserActivity: (organizationId: string, period: string) => any;

  // Security queries
  useSecurityIncidents: (organizationId: string) => any;
  useComplianceAudits: (organizationId: string) => any;

  // Billing queries
  useBillingInfo: (organizationId: string) => any;
  useUsageTracking: (organizationId: string) => any;

  // Playground queries
  usePromptTemplates: (organizationId: string) => any;
  useTemplateExecutions: (templateId: string) => any;

  // Mutations
  createSecurityIncident: any;
  updateSecurityIncident: any;
  executePromptTemplate: any;
  updateBillingSettings: any;
}

const EnterpriseApiContext = createContext<EnterpriseApiContextType | undefined>(undefined);

interface EnterpriseApiProviderProps {
  children: ReactNode;
}

export function EnterpriseApiProvider({ children }: EnterpriseApiProviderProps) {
  const queryClient = useQueryClient();

  // Analytics API hooks
  const useAnalyticsDashboard = (organizationId: string) => {
    return useQuery({
      queryKey: ['analytics', 'dashboard', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/analytics/dashboard?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useQueryAnalytics = (organizationId: string, period: string) => {
    return useQuery({
      queryKey: ['analytics', 'queries', organizationId, period],
      queryFn: async () => {
        const { data } = await apiClient.get(
          `/analytics/queries?org_id=${organizationId}&period=${period}`
        );
        return data;
      },
      enabled: !!organizationId,
    });
  };

  const useUserActivity = (organizationId: string, period: string) => {
    return useQuery({
      queryKey: ['analytics', 'users', organizationId, period],
      queryFn: async () => {
        const { data } = await apiClient.get(
          `/analytics/users?org_id=${organizationId}&period=${period}`
        );
        return data;
      },
      enabled: !!organizationId,
    });
  };

  // Security API hooks
  const useSecurityIncidents = (organizationId: string) => {
    return useQuery({
      queryKey: ['security', 'incidents', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/security/incidents?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
    });
  };

  const useComplianceAudits = (organizationId: string) => {
    return useQuery({
      queryKey: ['compliance', 'audits', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/security/audits?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
    });
  };

  // Billing API hooks
  const useBillingInfo = (organizationId: string) => {
    return useQuery({
      queryKey: ['billing', 'info', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/billing/info?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
    });
  };

  const useUsageTracking = (organizationId: string) => {
    return useQuery({
      queryKey: ['billing', 'usage', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/billing/usage?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
    });
  };

  // Playground API hooks
  const usePromptTemplates = (organizationId: string) => {
    return useQuery({
      queryKey: ['playground', 'templates', organizationId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/playground/templates?org_id=${organizationId}`);
        return data;
      },
      enabled: !!organizationId,
    });
  };

  const useTemplateExecutions = (templateId: string) => {
    return useQuery({
      queryKey: ['playground', 'executions', templateId],
      queryFn: async () => {
        const { data } = await apiClient.get(`/playground/templates/${templateId}/executions`);
        return data;
      },
      enabled: !!templateId,
    });
  };

  // Mutations
  const createSecurityIncident = useMutation({
    mutationFn: async (incident: Partial<SecurityIncident>) => {
      const { data } = await apiClient.post('/security/incidents', incident);
      return data;
    },
    onSuccess: (data, variables: any) => {
      queryClient.invalidateQueries({
        queryKey: ['security', 'incidents', variables.organization_id]
      });
    },
  });

  const updateSecurityIncident = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SecurityIncident> }) => {
      const { data } = await apiClient.put(`/security/incidents/${id}`, updates);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['security', 'incidents']
      });
    },
  });

  const executePromptTemplate = useMutation({
    mutationFn: async ({
      templateId,
      variables,
    }: {
      templateId: string;
      variables: Record<string, any>;
    }) => {
      const { data } = await apiClient.post(`/playground/templates/${templateId}/execute`, {
        variables,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['playground', 'executions', variables.templateId]
      });
    },
  });

  const updateBillingSettings = useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      const { data } = await apiClient.put('/billing/settings', settings);
      return data;
    },
    onSuccess: (data, variables: any) => {
      queryClient.invalidateQueries({
        queryKey: ['billing']
      });
    },
  });

  const value: EnterpriseApiContextType = {
    // Analytics
    useAnalyticsDashboard,
    useQueryAnalytics,
    useUserActivity,

    // Security
    useSecurityIncidents,
    useComplianceAudits,

    // Billing
    useBillingInfo,
    useUsageTracking,

    // Playground
    usePromptTemplates,
    useTemplateExecutions,

    // Mutations
    createSecurityIncident,
    updateSecurityIncident,
    executePromptTemplate,
    updateBillingSettings,
  };

  return (
    <EnterpriseApiContext.Provider value={value}>
      {children}
    </EnterpriseApiContext.Provider>
  );
}

export function useEnterpriseApi() {
  const context = useContext(EnterpriseApiContext);
  if (context === undefined) {
    throw new Error('useEnterpriseApi must be used within an EnterpriseApiProvider');
  }
  return context;
}

// Utility function to handle API errors
export function handleApiError(error: any) {
  console.error('API Error:', error);
  
  if (error.response?.status === 401) {
    // Handle unauthorized
    window.location.href = '/auth/login';
    return;
  }
  
  if (error.response?.status === 403) {
    // Handle forbidden
    return 'You do not have permission to perform this action';
  }
  
  if (error.response?.status === 429) {
    // Handle rate limiting
    return 'Too many requests. Please try again later.';
  }
  
  return error.response?.data?.message || error.message || 'An unexpected error occurred';
}