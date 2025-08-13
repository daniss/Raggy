'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Lock, 
  Zap, 
  ArrowUpRight, 
  Crown,
  Star,
  Users,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  feature: string;
  permission?: string;
  requiredTier?: 'pro' | 'enterprise';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradeHint?: boolean;
  className?: string;
}

interface UpgradePromptProps {
  currentTier: string;
  requiredTier: string;
  feature: string;
  className?: string;
}

export function FeatureGate({ 
  feature,
  permission,
  requiredTier,
  children, 
  fallback,
  showUpgradeHint = true,
  className
}: FeatureGateProps) {
  const { 
    organization, 
    hasPermission, 
    canAccessFeature
  } = useOrganization();

  // Check if user has access
  const hasFeatureAccess = canAccessFeature(feature);
  const hasPermissionAccess = permission ? hasPermission(permission) : true;
  const hasTierAccess = requiredTier ? 
    organization && getTierLevel(organization.tier) >= getTierLevel(requiredTier) : 
    true;

  const hasAccess = hasFeatureAccess && hasPermissionAccess && hasTierAccess;

  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  if (!showUpgradeHint) {
    return null;
  }

  return (
    <div className={className}>
      <UpgradePrompt
        currentTier={organization?.tier || 'starter'}
        requiredTier={requiredTier || 'pro'}
        feature={feature}
      />
    </div>
  );
}

function UpgradePrompt({ currentTier, requiredTier, feature, className }: UpgradePromptProps) {
  const getFeatureMessages = (feature: string, tier: string) => {
    const messages: Record<string, string> = {
      'usage': 'Analysez vos métriques d\'utilisation détaillées',
      'compliance': 'Accédez aux journaux d\'audit et preuves de purge',
      'team': 'Gérez votre équipe et les permissions',
      'api_keys': 'Créez des clés API pour vos intégrations',
      'billing': 'Consultez votre facturation et gérez vos abonnements',
      'connectors': 'Connectez vos sources de données externes',
      'environment': 'Surveillez votre environnement dédié',
      'conversations': 'Accédez à l\'historique complet des conversations',
      'analytics': 'Tableaux de bord analytiques avancés'
    };
    
    return messages[feature] || `Fonctionnalité ${tier} disponible`;
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Crown className="w-5 h-5 text-purple-600" />;
      case 'pro':
        return <Star className="w-5 h-5 text-blue-600" />;
      default:
        return <Users className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'border-purple-200 bg-purple-50';
      case 'pro':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full", className)}
    >
      <Card className={cn(
        "border-dashed border-2 transition-colors hover:shadow-md",
        getTierColor(requiredTier)
      )}>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            {/* Icon */}
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              requiredTier === 'enterprise' ? 'bg-purple-100' :
              requiredTier === 'pro' ? 'bg-blue-100' : 'bg-gray-100'
            )}>
              <Lock className={cn(
                "w-6 h-6",
                requiredTier === 'enterprise' ? 'text-purple-600' :
                requiredTier === 'pro' ? 'text-blue-600' : 'text-gray-600'
              )} />
            </div>

            {/* Tier badges */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getTierBadgeColor(currentTier)}>
                {currentTier.toUpperCase()}
              </Badge>
              <ArrowUpRight className="w-3 h-3 text-gray-400" />
              <Badge variant="outline" className={getTierBadgeColor(requiredTier)}>
                {requiredTier.toUpperCase()}
              </Badge>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {getTierIcon(requiredTier)}
                <h3 className="font-semibold text-gray-900">
                  Fonctionnalité {requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'}
                </h3>
              </div>
              
              <p className="text-sm text-gray-600 max-w-sm">
                {getFeatureMessages(feature, requiredTier)}
              </p>
            </div>

            {/* Upgrade button */}
            <Button 
              size="sm"
              className={cn(
                "gap-2",
                requiredTier === 'enterprise' 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
              onClick={() => {
                // TODO: Implement upgrade flow
                console.log(`Upgrade to ${requiredTier} for feature: ${feature}`);
              }}
            >
              <Zap className="w-4 h-4" />
              Passer à {requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Usage limit warning component
interface UsageLimitWarningProps {
  currentUsage: number;
  limit: number;
  type: 'documents' | 'tokens' | 'users' | 'storage';
  className?: string;
}

export function UsageLimitWarning({ 
  currentUsage, 
  limit, 
  type,
  className 
}: UsageLimitWarningProps) {
  const percentage = (currentUsage / limit) * 100;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  if (!isWarning) {
    return null;
  }

  const typeLabels = {
    documents: 'documents',
    tokens: 'tokens',
    users: 'utilisateurs',
    storage: 'stockage (MB)'
  };

  const getWarningColor = () => {
    if (isCritical) return 'border-red-200 bg-red-50';
    return 'border-yellow-200 bg-yellow-50';
  };

  const getIconColor = () => {
    if (isCritical) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getTextColor = () => {
    if (isCritical) return 'text-red-900';
    return 'text-yellow-900';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("w-full", className)}
    >
      <Card className={cn("border", getWarningColor())}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isCritical ? 'bg-red-100' : 'bg-yellow-100'
            )}>
              <AlertTriangle className={cn("w-4 h-4", getIconColor())} />
            </div>
            
            <div className="flex-1">
              <h4 className={cn("font-medium text-sm", getTextColor())}>
                {isCritical ? 'Limite critique atteinte' : 'Proche de la limite'}
              </h4>
              <p className={cn("text-xs", getIconColor())}>
                {currentUsage} / {limit} {typeLabels[type]} utilisés ({Math.round(percentage)}%)
              </p>
            </div>

            <Button 
              size="sm" 
              variant="outline"
              className={cn(
                "text-xs",
                isCritical 
                  ? "border-red-300 text-red-700 hover:bg-red-100"
                  : "border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              )}
              onClick={() => {
                console.log(`Upgrade prompt for ${type} limit`);
              }}
            >
              Augmenter
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Empty state component
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col items-center justify-center text-center p-8", className)}
    >
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      
      <p className="text-gray-600 mb-6 max-w-sm">
        {description}
      </p>
      
      {action && (
        <Button 
          onClick={action.onClick}
          variant={action.variant || 'default'}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

// Loading skeleton component
export function LoadingSkeleton({ 
  lines = 3, 
  className 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-gray-200 rounded animate-pulse",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// Utility functions
function getTierLevel(tier: string): number {
  const levels = {
    'starter': 1,
    'pro': 2,
    'enterprise': 3
  };
  return levels[tier as keyof typeof levels] || 1;
}

export default FeatureGate;