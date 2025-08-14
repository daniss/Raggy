"use client"

import type { ReactNode } from "react"
import { useApp } from "@/contexts/app-context"
import { hasFeature } from "@/lib/features"
import type { FeatureKey, TierType } from "@/lib/features"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FeatureGateProps {
  feature: FeatureKey
  children: ReactNode
  fallback?: ReactNode
  onLocked?: () => void
}

export function FeatureGate({ feature, children, fallback, onLocked }: FeatureGateProps) {
  const { orgTier } = useApp()
  const isFeatureAvailable = hasFeature(orgTier as TierType, feature)

  if (isFeatureAvailable) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <div className="flex items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted u-flex-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Fonctionnalité Pro</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Cette fonctionnalité est disponible dans les plans Pro et Enterprise.
        </p>
        <Button onClick={onLocked} variant="default">
          Mettre à niveau
        </Button>
      </div>
    </div>
  )
}
