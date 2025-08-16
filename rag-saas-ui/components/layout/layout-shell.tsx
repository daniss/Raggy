"use client"

import type { ReactNode } from "react"
import { SideNav } from "./side-nav"
import { TopBar } from "./top-bar"
import { UpgradeModal } from "@/components/ui/upgrade-modal"
import { OrganizationSetupLoading } from "@/components/ui/organization-setup-loading"
import { useApp } from "@/contexts/app-context"
import { hasFeature } from "@/lib/features"
import type { FeatureKey, TierType } from "@/lib/features"

// Mapping des features vers leur tier minimum requis
const featureToTierMap: Record<FeatureKey, TierType> = {
  usage: "pro",
  conversations: "pro",
  compliance: "pro",
  apiKeys: "pro",
  billing: "pro",
  connectors: "enterprise",
  environment: "enterprise",
  fast_mode: "pro",
  custom_prompts: "pro"
}

// Noms lisibles des features
const featureNames: Record<FeatureKey, string> = {
  usage: "Analytics d'utilisation",
  conversations: "Historique des conversations",
  compliance: "Conformité et audit",
  apiKeys: "Clés API",
  billing: "Facturation avancée",
  connectors: "Connecteurs de données",
  environment: "Environnement dédié",
  fast_mode: "Mode rapide IA",
  custom_prompts: "Prompts personnalisés"
}

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
  route: string
  featureKey?: FeatureKey
  permission?: string
  locked?: boolean
  section: "principal" | "pro" | "gestion" | "enterprise" | "support"
}

interface LayoutShellProps {
  children: ReactNode
}

export function LayoutShell({ children }: LayoutShellProps) {
  const { organization, userRole, isSettingUpOrg, lockedFeatureModal, closeLockedFeatureModal } = useApp()
  
  // Show setup loading if organization is being created
  if (isSettingUpOrg) {
    return <OrganizationSetupLoading />
  }
  
  // Generate features based on org tier
  const features = organization ? 
    Object.fromEntries(
      ['usage', 'conversations', 'compliance', 'connectors', 'environment', 'apiKeys'].map(
        feature => [feature, hasFeature(organization.tier as any, feature as FeatureKey)]
      )
    ) : {}
  
  // Mock permissions based on user role
  const permissions = userRole ? [userRole] : ['viewer']

  const handleUpgrade = () => {
    closeLockedFeatureModal()
    // TODO: Navigate to upgrade page or open billing modal
    console.log("Navigate to upgrade")
  }

  return (
    <div className="flex h-screen bg-background">
      <SideNav org={organization} features={features} permissions={permissions} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main id="main-content" className="flex-1 u-scroll-y">
          {children}
        </main>
      </div>
      
      {/* Global Modals */}
      {lockedFeatureModal.featureKey && (
        <UpgradeModal
          isOpen={lockedFeatureModal.open}
          onClose={closeLockedFeatureModal}
          currentTier={(organization?.tier as TierType) || "starter"}
          requiredTier={featureToTierMap[lockedFeatureModal.featureKey]}
          featureName={featureNames[lockedFeatureModal.featureKey]}
        />
      )}
    </div>
  )
}
