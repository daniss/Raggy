"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  History,
  BarChart3,
  Shield,
  Users,
  Settings,
  Key,
  Plug,
  Server,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFeatureGating } from "@/lib/hooks/use-feature-gating"
import type { Organization, TierType } from "@/lib/supabase/database.types"
import type { NavItem } from "./layout-shell"

interface SideNavProps {
  org: Organization | null
  features: Record<string, boolean>
  permissions: string[]
}

const navItems: NavItem[] = [
  // PRINCIPAL
  {
    id: "dashboard",
    label: "Tableau de bord",
    icon: <LayoutDashboard className="w-5 h-5" />,
    route: "/dashboard",
    section: "principal",
  },
  {
    id: "documents",
    label: "Documents",
    icon: <FileText className="w-5 h-5" />,
    route: "/documents",
    section: "principal",
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: <MessageSquare className="w-5 h-5" />,
    route: "/assistant",
    section: "principal",
  },

  // PRO
  {
    id: "conversations",
    label: "Conversations",
    icon: <History className="w-5 h-5" />,
    route: "/conversations",
    featureKey: "conversations",
    section: "pro",
  },
  {
    id: "utilisation",
    label: "Utilisation",
    icon: <BarChart3 className="w-5 h-5" />,
    route: "/utilisation",
    featureKey: "usage",
    section: "pro",
  },
  {
    id: "conformite",
    label: "Conformité",
    icon: <Shield className="w-5 h-5" />,
    route: "/conformite",
    featureKey: "compliance",
    section: "pro",
  },

  // GESTION
  { id: "equipe", label: "Équipe", icon: <Users className="w-5 h-5" />, route: "/team", section: "gestion" },
  {
    id: "parametres",
    label: "Paramètres",
    icon: <Settings className="w-5 h-5" />,
    route: "/parametres",
    section: "gestion",
  },
  {
    id: "api-keys",
    label: "Clés API",
    icon: <Key className="w-5 h-5" />,
    route: "/api-keys",
    featureKey: "apiKeys",
    section: "gestion",
  },

  // ENTERPRISE
  {
    id: "connecteurs",
    label: "Connecteurs",
    icon: <Plug className="w-5 h-5" />,
    route: "/connecteurs",
    featureKey: "connectors",
    section: "enterprise",
  },
  {
    id: "environnement",
    label: "Environnement",
    icon: <Server className="w-5 h-5" />,
    route: "/environnement",
    featureKey: "environment",
    section: "enterprise",
  },
  {
    id: "facturation",
    label: "Facturation",
    icon: <CreditCard className="w-5 h-5" />,
    route: "/facturation",
    featureKey: "billing",
    section: "enterprise",
  },

  // SUPPORT
  { id: "support", label: "Support", icon: <HelpCircle className="w-5 h-5" />, route: "/support", section: "support" },
]

const sectionLabels = {
  principal: "PRINCIPAL",
  pro: "PRO",
  gestion: "GESTION",
  enterprise: "ENTERPRISE",
  support: "SUPPORT",
}

const tierLabels: Record<TierType, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

export function SideNav({ org, features, permissions }: SideNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { handleFeatureClick } = useFeatureGating()

  const getVisibleItems = () => {
    return navItems.filter((item) => {
      // Always show principal and support sections
      if (item.section === "principal" || item.section === "support") return true

      // Show gestion items (team and settings always visible)
      if (item.section === "gestion") {
        if (item.featureKey) {
          return features[item.featureKey]
        }
        return true
      }

      // For pro and enterprise sections, show up to 2 locked items as teasers
      if (item.featureKey && !features[item.featureKey]) {
        const sectionItems = navItems.filter((i) => i.section === item.section)
        const lockedItems = sectionItems.filter((i) => i.featureKey && !features[i.featureKey!])
        const currentIndex = lockedItems.findIndex((i) => i.id === item.id)
        return currentIndex < 2 // Show first 2 locked items as teasers
      }

      return !item.featureKey || features[item.featureKey]
    })
  }

  const visibleItems = getVisibleItems()
  const groupedItems = visibleItems.reduce(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = []
      acc[item.section].push(item)
      return acc
    },
    {} as Record<string, NavItem[]>,
  )

  const isLocked = (item: NavItem) => {
    return item.featureKey && !features[item.featureKey]
  }

  return (
    <nav
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-18" : "w-62",
      )}
      role="navigation"
      aria-label="Navigation principale"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary u-flex-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sidebar-foreground">{org?.name}</div>
              <Badge variant="secondary" className="text-xs">
                {org?.tier ? tierLabels[org.tier] : 'Starter'}
              </Badge>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-6 px-3 space-y-6 u-scroll-y">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section}>
            {!collapsed && (
              <div className="px-3 mb-2 text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                {sectionLabels[section as keyof typeof sectionLabels]}
              </div>
            )}
            <div className="space-y-1">
              {items.map((item) => {
                const isActive = pathname === item.route
                const locked = isLocked(item)

                if (locked && item.featureKey) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleFeatureClick(item.featureKey!, () => {})}
                      aria-disabled={true}
                      aria-label={`${item.label} (réservé au plan Pro)`}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                        "text-gray-400 cursor-not-allowed hover:bg-gray-50",
                      )}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {item.icon}
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </>
                        )}
                      </div>
                    </button>
                  )
                }

                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                      isActive 
                        ? "border-l-3 border-blue-500 bg-blue-50 text-blue-600" 
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                    )}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {item.icon}
                      {!collapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
