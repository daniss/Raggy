'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export type UserRole = 'user' | 'knowledge_manager' | 'admin';
export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface UserRoleData {
  role: UserRole;
  tier: PlanTier;
  permissions: {
    // Core permissions
    canUploadDocuments: boolean;
    canDeleteDocuments: boolean;
    canUseAssistant: boolean;
    
    // Advanced features
    canViewAnalytics: boolean;
    canViewUsageMetrics: boolean;
    canViewLatencyMetrics: boolean;
    canViewTokenMetrics: boolean;
    
    // Admin features
    canManageUsers: boolean;
    canConfigureSettings: boolean;
    canViewAuditLogs: boolean;
    canManageIntegrations: boolean;
    
    // Enterprise features
    canConfigureSSO: boolean;
    canManageEnvironment: boolean;
    canViewCompliance: boolean;
  };
  limits: {
    maxDocuments: number;
    maxTokensPerMonth: number;
    maxUsers: number;
    showUpgradePrompts: boolean;
  };
}

export function useUserRole(): UserRoleData {
  const { user, profile } = useAuth();
  const [roleData, setRoleData] = useState<UserRoleData>({
    role: 'user',
    tier: 'starter',
    permissions: {
      canUploadDocuments: true,
      canDeleteDocuments: false,
      canUseAssistant: true,
      canViewAnalytics: false,
      canViewUsageMetrics: false,
      canViewLatencyMetrics: false,
      canViewTokenMetrics: false,
      canManageUsers: false,
      canConfigureSettings: false,
      canViewAuditLogs: false,
      canManageIntegrations: false,
      canConfigureSSO: false,
      canManageEnvironment: false,
      canViewCompliance: false,
    },
    limits: {
      maxDocuments: 100,
      maxTokensPerMonth: 50000,
      maxUsers: 1,
      showUpgradePrompts: true,
    },
  });

  useEffect(() => {
    if (!user) return;

    // In single-client mode, determine role based on user metadata or default to admin
    // For demo/MVP, all authenticated users get admin-level access
    const userRole: UserRole = user.user_metadata?.role || 'admin';
    const planTier: PlanTier = getClientPlanTier();

    const newRoleData: UserRoleData = {
      role: userRole,
      tier: planTier,
      permissions: getPermissionsForRole(userRole, planTier),
      limits: getLimitsForTier(planTier),
    };

    setRoleData(newRoleData);
  }, [user, profile]);

  return roleData;
}

function getClientPlanTier(): PlanTier {
  // In single-client deployments, read from environment or config
  const envTier = process.env.NEXT_PUBLIC_PLAN_TIER as PlanTier;
  
  // For demo purposes, start with 'starter' but can be upgraded
  return envTier || 'starter';
}

function getPermissionsForRole(role: UserRole, tier: PlanTier) {
  const basePermissions = {
    // Basic permissions for all users
    canUploadDocuments: true,
    canDeleteDocuments: false,
    canUseAssistant: true,
    
    // Advanced features - tier dependent
    canViewAnalytics: false,
    canViewUsageMetrics: false,
    canViewLatencyMetrics: false,
    canViewTokenMetrics: false,
    
    // Admin features
    canManageUsers: false,
    canConfigureSettings: false,
    canViewAuditLogs: false,
    canManageIntegrations: false,
    
    // Enterprise features
    canConfigureSSO: false,
    canManageEnvironment: false,
    canViewCompliance: false,
  };

  // Role-based permissions
  if (role === 'knowledge_manager' || role === 'admin') {
    basePermissions.canDeleteDocuments = true;
    basePermissions.canConfigureSettings = true;
  }

  if (role === 'admin') {
    basePermissions.canManageUsers = true;
    basePermissions.canViewAuditLogs = true;
    basePermissions.canManageIntegrations = true;
  }

  // Tier-based permissions
  if (tier === 'pro' || tier === 'enterprise') {
    basePermissions.canViewAnalytics = true;
    basePermissions.canViewUsageMetrics = true;
    basePermissions.canViewTokenMetrics = true;
  }

  if (tier === 'enterprise') {
    basePermissions.canViewLatencyMetrics = true;
    basePermissions.canConfigureSSO = true;
    basePermissions.canManageEnvironment = true;
    basePermissions.canViewCompliance = true;
  }

  return basePermissions;
}

function getLimitsForTier(tier: PlanTier) {
  switch (tier) {
    case 'starter':
      return {
        maxDocuments: 100,
        maxTokensPerMonth: 50000,
        maxUsers: 1,
        showUpgradePrompts: true,
      };
    case 'pro':
      return {
        maxDocuments: 1000,
        maxTokensPerMonth: 500000,
        maxUsers: 10,
        showUpgradePrompts: true,
      };
    case 'enterprise':
      return {
        maxDocuments: 10000,
        maxTokensPerMonth: 5000000,
        maxUsers: 100,
        showUpgradePrompts: false,
      };
    default:
      return {
        maxDocuments: 100,
        maxTokensPerMonth: 50000,
        maxUsers: 1,
        showUpgradePrompts: true,
      };
  }
}

// Utility function to check if user needs upgrade for a feature
export function useFeatureAccess(feature: keyof UserRoleData['permissions']) {
  const { permissions, tier } = useUserRole();
  
  return {
    hasAccess: permissions[feature],
    tier,
    needsUpgrade: !permissions[feature] && tier !== 'enterprise',
    upgradeMessage: getUpgradeMessage(feature, tier),
  };
}

function getUpgradeMessage(feature: keyof UserRoleData['permissions'], currentTier: PlanTier): string {
  const featureMessages: Record<keyof UserRoleData['permissions'], string> = {
    canUploadDocuments: '',
    canDeleteDocuments: 'Gestion avancée des documents disponible en Pro',
    canUseAssistant: '',
    canViewAnalytics: 'Tableaux de bord analytiques disponibles en Pro',
    canViewUsageMetrics: 'Métriques d\'utilisation détaillées disponibles en Pro',
    canViewLatencyMetrics: 'Monitoring de performance disponible en Enterprise',
    canViewTokenMetrics: 'Suivi des tokens disponible en Pro',
    canManageUsers: 'Gestion d\'équipe disponible en Pro',
    canConfigureSettings: 'Configuration avancée disponible en Pro',
    canViewAuditLogs: 'Journaux d\'audit disponibles en Pro',
    canManageIntegrations: 'Connecteurs avancés disponibles en Enterprise',
    canConfigureSSO: 'Authentification SSO disponible en Enterprise',
    canManageEnvironment: 'Gestion d\'environnement disponible en Enterprise',
    canViewCompliance: 'Outils de conformité disponibles en Pro',
  };

  return featureMessages[feature] || '';
}

// Hook for checking usage limits
export function useUsageLimits() {
  const { limits } = useUserRole();
  
  return {
    ...limits,
    isNearDocumentLimit: (currentCount: number) => currentCount >= limits.maxDocuments * 0.8,
    isNearTokenLimit: (currentUsage: number) => currentUsage >= limits.maxTokensPerMonth * 0.8,
    isNearUserLimit: (currentUsers: number) => currentUsers >= limits.maxUsers * 0.8,
  };
}