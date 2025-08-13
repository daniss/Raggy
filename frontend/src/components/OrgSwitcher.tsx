'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Check,
  Building2,
  Crown,
  Shield,
  Users,
  Eye,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';

interface OrgSwitcherProps {
  className?: string;
}

export default function OrgSwitcher({ className }: OrgSwitcherProps) {
  const {
    organization,
    organizations,
    switchOrganization,
    isMultiOrg,
    canSwitchOrgs,
    loading
  } = useOrganization();
  
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const handleOrgSwitch = async (orgId: string) => {
    if (orgId === organization?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitching(orgId);
      await switchOrganization(orgId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setSwitching(null);
    }
  };

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('owner')) return <Crown className="w-3 h-3 text-yellow-600" />;
    if (roles.includes('admin')) return <Shield className="w-3 h-3 text-blue-600" />;
    if (roles.includes('knowledge_manager')) return <Users className="w-3 h-3 text-green-600" />;
    if (roles.includes('billing_admin')) return <CreditCard className="w-3 h-3 text-purple-600" />;
    if (roles.includes('security_admin')) return <AlertTriangle className="w-3 h-3 text-red-600" />;
    if (roles.includes('observer')) return <Eye className="w-3 h-3 text-gray-600" />;
    return <Users className="w-3 h-3 text-gray-400" />;
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'starter':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isMultiOrg || !canSwitchOrgs) {
    // Single org mode - just show current org name
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Building2 className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-900">
          {organization?.name || 'Mon Organisation'}
        </span>
        <Badge variant="outline" className={getTierBadgeColor(organization?.tier || 'starter')}>
          {organization?.tier ? organization.tier.charAt(0).toUpperCase() + organization.tier.slice(1) : 'Starter'}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="h-auto p-2 justify-start gap-2 hover:bg-gray-50"
      >
        <Building2 className="w-4 h-4 text-gray-600" />
        <div className="flex flex-col items-start">
          <span className="font-medium text-gray-900 text-sm">
            {organization?.name || 'Sélectionner une organisation'}
          </span>
          {organization && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={cn("text-xs", getTierBadgeColor(organization.tier))}>
                {organization.tier.charAt(0).toUpperCase() + organization.tier.slice(1)}
              </Badge>
            </div>
          )}
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-gray-400 transition-transform ml-auto",
          isOpen && "rotate-180"
        )} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            >
              <div className="p-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Changer d'organisation
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {organizations.length} organisation{organizations.length > 1 ? 's' : ''} disponible{organizations.length > 1 ? 's' : ''}
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {organizations.map((org) => {
                  const isCurrent = org.id === organization?.id;
                  const isSwitching = switching === org.id;
                  
                  // Mock membership data - in real app this would come from API
                  const mockMembership = {
                    roles: ['owner'], // This should come from actual membership data
                    role_display: 'Propriétaire'
                  };

                  return (
                    <motion.button
                      key={org.id}
                      onClick={() => handleOrgSwitch(org.id)}
                      disabled={isSwitching}
                      className={cn(
                        "w-full p-3 text-left hover:bg-gray-50 transition-colors",
                        "flex items-center gap-3 border-b border-gray-50 last:border-0",
                        isCurrent && "bg-blue-50 hover:bg-blue-50"
                      )}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                    >
                      {/* Organization Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        org.branding?.primaryColor 
                          ? "text-white"
                          : "bg-gray-100 text-gray-600"
                      )} style={{
                        backgroundColor: org.branding?.primaryColor || undefined
                      }}>
                        {org.branding?.logoUrl ? (
                          <img 
                            src={org.branding.logoUrl} 
                            alt={org.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>

                      {/* Organization Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm truncate">
                            {org.name}
                          </span>
                          {isCurrent && (
                            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Tier Badge */}
                          <Badge variant="outline" className={cn("text-xs", getTierBadgeColor(org.tier))}>
                            {org.tier.charAt(0).toUpperCase() + org.tier.slice(1)}
                          </Badge>
                          
                          {/* Role */}
                          <div className="flex items-center gap-1">
                            {getRoleIcon(mockMembership.roles)}
                            <span className="text-xs text-gray-500">
                              {mockMembership.role_display}
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        {org.status !== 'active' && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              {org.status === 'trial' ? 'Essai' : 
                               org.status === 'suspended' ? 'Suspendu' : 
                               'Annulé'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Loading indicator */}
                      {isSwitching && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  Besoin d'aide ? <span className="text-blue-600 hover:text-blue-700 cursor-pointer">Contactez le support</span>
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}