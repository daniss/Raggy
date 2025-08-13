'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  MessageCircle,
  HelpCircle,
  BarChart3,
  Shield,
  Users,
  Settings,
  Key,
  CreditCard,
  Cable,
  Server,
  Menu,
  X,
  Crown,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import OrgSwitcher from '@/components/OrgSwitcher';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tier?: string[];
  permission?: string;
  badge?: string;
  upgrade?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      {
        id: 'dashboard',
        label: 'Tableau de bord',
        href: '/dashboard',
        icon: LayoutDashboard
      },
      {
        id: 'documents',
        label: 'Documents',
        href: '/dashboard/documents',
        icon: FileText
      },
      {
        id: 'assistant',
        label: 'Assistant',
        href: '/dashboard/demo-assistant',
        icon: MessageCircle
      }
    ]
  },
  {
    title: 'Analyse',
    items: [
      {
        id: 'conversations',
        label: 'Conversations',
        href: '/dashboard/conversations',
        icon: MessageCircle,
        tier: ['pro', 'enterprise']
      },
      {
        id: 'usage',
        label: 'Utilisation',
        href: '/dashboard/usage',
        icon: BarChart3,
        tier: ['pro', 'enterprise'],
        permission: 'usage:view'
      },
      {
        id: 'compliance',
        label: 'Conformité',
        href: '/dashboard/compliance',
        icon: Shield,
        tier: ['pro', 'enterprise'],
        permission: 'compliance:view'
      }
    ]
  },
  {
    title: 'Gestion',
    items: [
      {
        id: 'team',
        label: 'Équipe',
        href: '/dashboard/team',
        icon: Users,
        permission: 'team:manage'
      },
      {
        id: 'settings',
        label: 'Paramètres',
        href: '/dashboard/settings',
        icon: Settings,
        permission: 'org:settings'
      },
      {
        id: 'api_keys',
        label: 'Clés API',
        href: '/dashboard/api-keys',
        icon: Key,
        tier: ['pro', 'enterprise'],
        permission: 'apikeys:manage'
      }
    ]
  },
  {
    title: 'Enterprise',
    items: [
      {
        id: 'billing',
        label: 'Facturation',
        href: '/dashboard/billing',
        icon: CreditCard,
        tier: ['pro', 'enterprise'],
        permission: 'billing:view'
      },
      {
        id: 'connectors',
        label: 'Connecteurs',
        href: '/dashboard/connectors',
        icon: Cable,
        tier: ['enterprise'],
        permission: 'connectors:manage'
      },
      {
        id: 'environment',
        label: 'Environnement',
        href: '/dashboard/environment',
        icon: Server,
        tier: ['enterprise']
      }
    ]
  },
  {
    title: 'Support',
    items: [
      {
        id: 'support',
        label: 'Support',
        href: '/dashboard/support',
        icon: HelpCircle
      }
    ]
  }
];

interface DashboardSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function DashboardSidebar({ collapsed = false, onToggleCollapse }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { 
    organization, 
    hasPermission, 
    canAccessFeature, 
    getVisibleNavigation,
    membership
  } = useOrganization();

  const visibleNavIds = getVisibleNavigation();
  const currentTier = organization?.tier || 'starter';
  const isStarterTier = currentTier === 'starter';

  const isNavItemVisible = (item: NavItem): boolean => {
    // Check if item is in visible navigation
    if (!visibleNavIds.includes(item.id)) {
      return false;
    }

    // Check tier requirements
    if (item.tier && organization) {
      if (!item.tier.includes(organization.tier || 'starter')) {
        return false;
      }
    }

    // Check permission requirements
    if (item.permission) {
      if (!hasPermission(item.permission)) {
        return false;
      }
    }

    return true;
  };

  const isNavItemUpgradeable = (item: NavItem): boolean => {
    if (!item.tier || !organization) return false;
    
    // Item requires higher tier than current
    const tierOrder = ['starter', 'pro', 'enterprise'];
    const currentTierIndex = tierOrder.indexOf(organization.tier || 'starter');
    const requiredTierIndex = Math.min(...item.tier.map(t => tierOrder.indexOf(t)));
    
    return requiredTierIndex > currentTierIndex;
  };

  const getUpgradeTarget = (item: NavItem): string => {
    if (!item.tier) return 'Pro';
    
    if (item.tier.includes('pro')) return 'Pro';
    if (item.tier.includes('enterprise')) return 'Enterprise';
    return 'Pro';
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
    const isVisible = isNavItemVisible(item);
    const needsUpgrade = isNavItemUpgradeable(item);
    const Icon = item.icon;

    if (!isVisible && !needsUpgrade) {
      return null;
    }

    const content = (
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
        "group relative",
        isActive && isVisible
          ? "bg-blue-50 text-blue-700 border border-blue-200" 
          : isVisible
            ? "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            : "text-gray-400 cursor-not-allowed"
      )}
    >
      <Icon className={cn(
        "w-5 h-5 flex-shrink-0 transition-colors",
        isActive && isVisible ? "text-blue-600" : 
        isVisible ? "text-gray-500 group-hover:text-gray-700" : 
        "text-gray-300"
      )} />
      
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          
          {needsUpgrade && (
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                {getUpgradeTarget(item)}
              </span>
            </div>
          )}
          
          {item.badge && isVisible && (
            <Badge variant="outline" className="text-xs">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </div>
    );

    if (needsUpgrade) {
      return (
        <div
          key={item.id}
          className="relative"
          title={`Disponible avec le plan ${getUpgradeTarget(item)}`}
        >
          {content}
        </div>
      );
    }

    return (
      <Link key={item.id} href={item.href} className="block">
        {content}
      </Link>
    );
  };

  return (
    <motion.div
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col h-full bg-white border-r border-gray-200 relative"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        {/* Logo and Collapse Toggle */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className={cn(
            "font-bold text-blue-600 transition-all duration-300",
            collapsed ? "text-lg" : "text-xl"
          )}>
            {collapsed ? 'R' : 'Raggy'}
          </Link>
          
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="w-8 h-8 p-0"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Organization Switcher */}
        {!collapsed && (
          <OrgSwitcher className="mb-4" />
        )}

        {/* User info */}
        {!collapsed && profile && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {profile.full_name || user?.email}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user?.email}
                </div>
              </div>
              {membership?.is_admin && (
                <Crown className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              )}
            </div>
            
            {organization && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "text-xs",
                  organization.tier === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  organization.tier === 'pro' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-gray-50 text-gray-700 border-gray-200'
                )}>
                  {organization.tier ? organization.tier.charAt(0).toUpperCase() + organization.tier.slice(1) : 'Starter'}
                </Badge>
                <span className="text-xs text-gray-500">
                  {membership?.role_display}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Collapsed user avatar */}
        {collapsed && (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium text-sm">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-6">
          {navigationSections.map((section) => {
            // For Starter tier, filter out most locked sections and show only essentials + one preview
            let visibleItems = section.items.filter(item => 
              isNavItemVisible(item) || isNavItemUpgradeable(item)
            );

            // For Starter users, hide most locked features except 1-2 key ones
            if (isStarterTier) {
              if (section.title === 'Analyse') {
                // Show only one locked feature as preview
                const lockedItems = visibleItems.filter(item => isNavItemUpgradeable(item));
                const unlockedItems = visibleItems.filter(item => !isNavItemUpgradeable(item));
                visibleItems = [...unlockedItems, ...lockedItems.slice(0, 1)]; // Show only first locked item
              } else if (section.title === 'Enterprise') {
                // Hide entire Enterprise section for Starter
                visibleItems = [];
              } else if (section.title === 'Gestion') {
                // Show only available items, hide locked ones
                visibleItems = visibleItems.filter(item => !isNavItemUpgradeable(item));
              }
            }
            
            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={section.title}>
                {!collapsed && (
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {section.title}
                  </h3>
                )}
                <ul className="space-y-1">
                  {visibleItems.map(renderNavItem)}
                </ul>
              </div>
            );
          })}
          
          {/* Upgrade prompt for Starter users */}
          {!collapsed && isStarterTier && (
            <div className="pt-4 border-t border-gray-200">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 text-center">
                <Crown className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-900 mb-1">
                  Débloquer plus de fonctionnalités
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs h-7 border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={() => window.location.href = '/dashboard/billing'}
                >
                  Comparer les plans
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed ? (
          <div className="text-xs text-gray-500 text-center">
            Raggy v2.0 - Assistant IA
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-gray-500 text-xs">R</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}