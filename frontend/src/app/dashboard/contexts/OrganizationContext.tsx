'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'team' | 'business' | 'enterprise';
  logo?: string;
  settings: {
    dataResidency: 'eu' | 'france' | 'us';
    hdsCompliant: boolean;
    maxDocuments: number;
    maxUsers: number;
    maxTokensPerMonth: number;
  };
}

interface Quotas {
  documentsUsed: number;
  documentsLimit: number;
  usersUsed: number;
  usersLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  storageUsed: number; // in MB
  storageLimit: number; // in MB
}

interface CostTracking {
  currentMonthCost: number;
  budgetLimit?: number;
  tokenCost: number;
  storageCost: number;
  embeddingCost: number;
  projectedMonthlyCost: number;
}

interface OrganizationContextType {
  // Current organization
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization) => void;
  
  // Multi-tenant isolation
  organizationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Quotas and limits
  quotas: Quotas | null;
  isQuotaExceeded: (resource: keyof Quotas) => boolean;
  getRemainingQuota: (resource: keyof Quotas) => number;
  getQuotaPercentage: (resource: keyof Quotas) => number;
  
  // Cost tracking
  costs: CostTracking | null;
  isBudgetExceeded: () => boolean;
  getBudgetPercentage: () => number;
  
  // Actions
  refreshQuotas: () => Promise<void>;
  refreshCosts: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

interface OrganizationProviderProps {
  children: ReactNode;
  initialOrgId?: string;
}

export function OrganizationProvider({ children, initialOrgId }: OrganizationProviderProps) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrgId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [costs, setCosts] = useState<CostTracking | null>(null);

  // Load organization data on mount or org change
  useEffect(() => {
    if (organizationId) {
      loadOrganizationData(organizationId);
    }
  }, [organizationId]);

  const loadOrganizationData = async (orgId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Mock API call - replace with real API
      const mockOrg: Organization = {
        id: orgId,
        name: 'Demo Organization',
        slug: 'demo-org',
        plan: 'team',
        settings: {
          dataResidency: 'eu',
          hdsCompliant: false,
          maxDocuments: 500,
          maxUsers: 5,
          maxTokensPerMonth: 200000,
        }
      };

      const mockQuotas: Quotas = {
        documentsUsed: 127,
        documentsLimit: mockOrg.settings.maxDocuments,
        usersUsed: 3,
        usersLimit: mockOrg.settings.maxUsers,
        tokensUsed: 45000,
        tokensLimit: mockOrg.settings.maxTokensPerMonth,
        storageUsed: 2400, // 2.4 GB
        storageLimit: 10000, // 10 GB
      };

      const mockCosts: CostTracking = {
        currentMonthCost: 89.50,
        budgetLimit: 300,
        tokenCost: 67.20,
        storageCost: 12.30,
        embeddingCost: 10.00,
        projectedMonthlyCost: 124.75,
      };

      setCurrentOrganization(mockOrg);
      setQuotas(mockQuotas);
      setCosts(mockCosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const isQuotaExceeded = (resource: keyof Quotas): boolean => {
    if (!quotas) return false;
    const used = quotas[`${resource.replace('Limit', 'Used')}` as keyof Quotas] as number;
    const limit = quotas[resource] as number;
    return used >= limit;
  };

  const getRemainingQuota = (resource: keyof Quotas): number => {
    if (!quotas) return 0;
    const usedKey = `${resource.replace('Limit', 'Used')}` as keyof Quotas;
    const used = quotas[usedKey] as number;
    const limit = quotas[resource] as number;
    return Math.max(0, limit - used);
  };

  const getQuotaPercentage = (resource: keyof Quotas): number => {
    if (!quotas) return 0;
    const usedKey = `${resource.replace('Limit', 'Used')}` as keyof Quotas;
    const used = quotas[usedKey] as number;
    const limit = quotas[resource] as number;
    return limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  };

  const isBudgetExceeded = (): boolean => {
    if (!costs || !costs.budgetLimit) return false;
    return costs.currentMonthCost >= costs.budgetLimit;
  };

  const getBudgetPercentage = (): number => {
    if (!costs || !costs.budgetLimit) return 0;
    return Math.min(100, (costs.currentMonthCost / costs.budgetLimit) * 100);
  };

  const refreshQuotas = async (): Promise<void> => {
    if (organizationId) {
      await loadOrganizationData(organizationId);
    }
  };

  const refreshCosts = async (): Promise<void> => {
    if (organizationId) {
      await loadOrganizationData(organizationId);
    }
  };

  const switchOrganization = async (orgId: string): Promise<void> => {
    setOrganizationId(orgId);
  };

  const value: OrganizationContextType = {
    currentOrganization,
    setCurrentOrganization,
    organizationId,
    isLoading,
    error,
    quotas,
    isQuotaExceeded,
    getRemainingQuota,
    getQuotaPercentage,
    costs,
    isBudgetExceeded,
    getBudgetPercentage,
    refreshQuotas,
    refreshCosts,
    switchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

export type { Organization, Quotas, CostTracking };