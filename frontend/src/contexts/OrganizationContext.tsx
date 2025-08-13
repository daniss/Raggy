'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/utils/supabase';
import { User } from '@supabase/supabase-js';

// Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tier: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  settings: {
    dataResidency: string;
    hdsCompliant: boolean;
    maxDocuments: number;
    maxUsers: number;
    maxTokensPerMonth: number;
    maxStorageMB: number;
  };
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    customDomain?: string;
  };
  created_at: string;
  updated_at: string;
  trial_ends_at?: string;
  billing_email?: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'knowledge_manager' | 'user' | 'observer' | 'billing_admin' | 'security_admin';
  roles: string[];
  status: 'invited' | 'active' | 'suspended';
  permissions?: Record<string, any>;
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  last_active?: string;
  is_admin: boolean;
  role_display: string;
}

interface OrganizationContextType {
  // Current organization state
  organization: Organization | null;
  membership: OrganizationMember | null;
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  
  // Actions
  switchOrganization: (orgId: string) => Promise<void>;
  updateOrganization: (updates: Partial<Organization>) => Promise<void>;
  refreshOrganization: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  
  // Permissions
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  canAccessFeature: (feature: string) => boolean;
  
  // Navigation
  getVisibleNavigation: () => string[];
  
  // Utilities
  getUsageStatus: () => {
    documents: { current: number; max: number; percentage: number };
    users: { current: number; max: number; percentage: number };
    storage: { current: number; max: number; percentage: number };
    tokens: { current: number; max: number; percentage: number };
  };
  
  // Multi-org utilities
  isMultiOrg: boolean;
  canSwitchOrgs: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
  user?: User | null;
}

export function OrganizationProvider({ children, user }: OrganizationProviderProps) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  // Load user's organizations
  const loadOrganizations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get session to get access token
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch user's organizations from API
      const response = await fetch('/api/v1/users/me/organizations', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });

      if (response.ok) {
        const userOrgs = await response.json();
        // Map 'plan' field to 'tier' for compatibility
        const mappedOrgs = userOrgs.map((org: any) => ({
          ...org,
          tier: org.plan || org.tier || 'starter'
        }));
        setOrganizations(mappedOrgs);
        
        // Set current organization
        const savedOrgId = typeof window !== 'undefined' 
          ? localStorage.getItem('currentOrganizationId')
          : null;
        
        let currentOrg = mappedOrgs.find((org: any) => org.id === savedOrgId);
        if (!currentOrg && mappedOrgs.length > 0) {
          currentOrg = mappedOrgs[0]; // Default to first organization
        }
        
        if (currentOrg) {
          await setCurrentOrganization(currentOrg);
        }
      } else {
        // Fallback to demo mode
        await loadDemoOrganization();
      }

    } catch (err: any) {
      console.error('Error loading organizations:', err);
      // Fallback to demo mode
      await loadDemoOrganization();
    } finally {
      setLoading(false);
    }
  };
  
  // Fallback demo organization
  const loadDemoOrganization = async () => {
    const defaultOrg: Organization = {
      id: 'demo-org-12345',
      name: 'Mon Organisation',
      slug: 'demo-org',
      description: 'Organisation de démonstration',
      tier: 'starter',
      status: 'active',
      settings: {
        dataResidency: 'france',
        hdsCompliant: false,
        maxDocuments: 100,
        maxUsers: 5,
        maxTokensPerMonth: 200000,
        maxStorageMB: 1000,
      },
      branding: {
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      billing_email: user?.email,
    };

    const defaultMembership: OrganizationMember = {
      id: user?.id + '-membership' || 'demo-membership',
      organization_id: defaultOrg.id,
      user_id: user?.id || 'demo-user',
      role: 'owner',
      roles: ['owner'],
      status: 'active',
      joined_at: new Date().toISOString(),
      is_admin: true,
      role_display: 'Propriétaire'
    };

    setOrganizations([defaultOrg]);
    setOrganization(defaultOrg);
    setMembership(defaultMembership);

    // Store current org in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentOrganizationId', defaultOrg.id);
    }
  };
  
  // Set current organization and membership
  const setCurrentOrganization = async (org: Organization) => {
    setOrganization(org);
    
    // Find membership for this org
    // In a full implementation, this would come from the API
    const mockMembership: OrganizationMember = {
      id: `${user?.id}-${org.id}`,
      organization_id: org.id,
      user_id: user?.id || '',
      role: 'owner', // This should come from API
      roles: ['owner'],
      status: 'active',
      joined_at: new Date().toISOString(),
      is_admin: true,
      role_display: 'Propriétaire'
    };
    
    setMembership(mockMembership);
    
    // Store current org in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentOrganizationId', org.id);
      // Set cookie for backend
      document.cookie = `org_id=${org.id}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
    }
  };

  // Switch to different organization
  const switchOrganization = async (orgId: string) => {
    const targetOrg = organizations.find(org => org.id === orgId);
    if (targetOrg) {
      await setCurrentOrganization(targetOrg);
    } else {
      throw new Error('Organization not found');
    }
  };
  
  // Refresh organizations list
  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  // Update organization
  const updateOrganization = async (updates: Partial<Organization>) => {
    if (!organization || !user) return;

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organization.id)
        .select()
        .single();

      if (error) throw error;

      setOrganization(data);
    } catch (err: any) {
      console.error('Error updating organization:', err);
      throw err;
    }
  };

  // Refresh current organization data
  const refreshOrganization = async () => {
    if (organization) {
      await setCurrentOrganization(organization);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    if (!membership) return false;

    // Owner and admin have all permissions
    if (membership.roles.includes('owner') || membership.roles.includes('admin')) {
      return true;
    }

    // Check specific permissions matrix
    // This would integrate with the backend permission system
    return membership.permissions?.[permission] === true;
  };

  // Check if user has specific role(s)
  const hasRole = (role: string | string[]): boolean => {
    if (!membership) return false;

    const roles = Array.isArray(role) ? role : [role];
    return roles.some(r => membership.roles.includes(r));
  };
  
  // Check if user can access a feature based on tier
  const canAccessFeature = (feature: string): boolean => {
    if (!organization) return false;
    
    const tierFeatures = {
      starter: ['documents', 'assistant', 'support'],
      pro: ['documents', 'assistant', 'conversations', 'usage', 'compliance', 'team', 'settings', 'support'],
      enterprise: ['documents', 'assistant', 'conversations', 'usage', 'compliance', 'team', 'settings', 'api_keys', 'billing', 'connectors', 'environment', 'support']
    };
    
    return tierFeatures[organization.tier]?.includes(feature) || false;
  };
  
  // Get visible navigation items
  const getVisibleNavigation = (): string[] => {
    if (!organization || !membership) return ['dashboard', 'support'];
    
    const navigation = ['dashboard', 'documents', 'assistant'];
    
    // Add tier-based items
    if (organization.tier === 'pro' || organization.tier === 'enterprise') {
      navigation.push('conversations');
      
      if (hasPermission('usage:view')) {
        navigation.push('usage');
      }
      
      if (hasPermission('compliance:view')) {
        navigation.push('compliance');
      }
    }
    
    // Add role-based items
    if (hasPermission('team:manage')) {
      navigation.push('team');
    }
    
    if (hasPermission('org:settings')) {
      navigation.push('settings');
    }
    
    if (hasPermission('apikeys:manage') && canAccessFeature('api_keys')) {
      navigation.push('api_keys');
    }
    
    if (hasPermission('billing:view') && canAccessFeature('billing')) {
      navigation.push('billing');
    }
    
    if (organization.tier === 'enterprise') {
      if (hasPermission('connectors:manage')) {
        navigation.push('connectors');
      }
      navigation.push('environment');
    }
    
    navigation.push('support');
    
    return navigation;
  };

  // Get usage status
  const getUsageStatus = () => {
    if (!organization) {
      return {
        documents: { current: 0, max: 0, percentage: 0 },
        users: { current: 0, max: 0, percentage: 0 },
        storage: { current: 0, max: 0, percentage: 0 },
        tokens: { current: 0, max: 0, percentage: 0 },
      };
    }

    // TODO: These should come from actual usage API
    // For now, using mock data based on organization settings
    const settings = organization.settings;
    
    return {
      documents: {
        current: 45, // TODO: Get from documents count API
        max: settings.maxDocuments,
        percentage: (45 / settings.maxDocuments) * 100,
      },
      users: {
        current: organizations.length > 1 ? 5 : 1, // TODO: Get from members count API
        max: settings.maxUsers,
        percentage: ((organizations.length > 1 ? 5 : 1) / settings.maxUsers) * 100,
      },
      storage: {
        current: 150, // TODO: Get from actual storage usage in MB
        max: settings.maxStorageMB,
        percentage: (150 / settings.maxStorageMB) * 100,
      },
      tokens: {
        current: 15000, // TODO: Get from current month token usage
        max: settings.maxTokensPerMonth,
        percentage: (15000 / settings.maxTokensPerMonth) * 100,
      },
    };
  };

  // Initialize on mount and user change
  useEffect(() => {
    if (user) {
      loadOrganizations();
    } else {
      setOrganization(null);
      setMembership(null);
      setOrganizations([]);
      setLoading(false);
    }
  }, [user?.id]);
  
  // Computed properties
  const isMultiOrg = organizations.length > 1;
  const canSwitchOrgs = isMultiOrg && membership?.status === 'active';

  const value: OrganizationContextType = {
    organization,
    membership,
    organizations,
    loading,
    error,
    switchOrganization,
    updateOrganization,
    refreshOrganization,
    refreshOrganizations,
    hasPermission,
    hasRole,
    canAccessFeature,
    getVisibleNavigation,
    getUsageStatus,
    isMultiOrg,
    canSwitchOrgs,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}