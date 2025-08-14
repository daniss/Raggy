"use client"

import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { SummaryBar } from "@/components/ui/SummaryBar"
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist"
import { RecentActivity } from "@/components/ui/recent-activity"
import { UsageBar } from "@/components/ui/usage-bar"
import { UpgradeBanner } from "@/components/ui/upgrade-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLimits, shouldShowUpgradeBanner } from "@/lib/hooks/use-limits"
import { useOnboarding } from "@/lib/hooks/use-onboarding"
import { DashboardAPI, type DashboardData } from "@/lib/api/dashboard"
import { useEffect, useState } from "react"
import { useApp } from "@/contexts/app-context"

function DashboardContent() {
  const limits = useLimits()
  const onboarding = useOnboarding()
  const { organization } = useApp()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!organization) return
      
      try {
        const data = await DashboardAPI.getDashboardData()
        setDashboardData(data)
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [organization])

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader title="Tableau de bord" subtitle="Chargement..." />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </MainContent>
      </LayoutShell>
    )
  }

  const showOnboarding = dashboardData?.docsReady === 0 && !onboarding.dismissed
  const showUpgrade = shouldShowUpgradeBanner(limits)

  const summaryItems = dashboardData ? [
    { label: "Documents prêts", value: dashboardData.docsReady },
    ...(dashboardData.processing > 0 ? [{ label: "En cours", value: dashboardData.processing, tone: "warning" as const }] : []),
    { label: "Stockage", value: `${(dashboardData.storageBytes / 1024 / 1024 / 1024).toFixed(1)} GB` }
  ] : []

  return (
    <LayoutShell>
      <MainContent>
        <PageHeader 
          title="Tableau de bord"
          subtitle={`Vue d'ensemble • Dernière mise à jour: ${dashboardData?.lastUpdated || "il y a 2 minutes"}`}
        />

        {/* Upgrade Banner */}
        {showUpgrade && (
          <UpgradeBanner
            type="docs"
            current={limits.docsUsed}
            limit={limits.docsLimit}
            className="mb-6"
          />
        )}

        {/* Summary Bar - only show when not onboarding */}
        {dashboardData && !showOnboarding && (
          <SummaryBar 
            items={summaryItems}
            lastUpdated={dashboardData.lastUpdated}
            className="mb-6"
          />
        )}

        <div className="stack-md">
          {/* Onboarding Checklist */}
          {showOnboarding && dashboardData && (
            <OnboardingChecklist
              items={dashboardData.onboardingItems}
              onDismiss={onboarding.dismiss}
            />
          )}

          {/* Welcome Card for new users */}
          {showOnboarding && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-medium mb-4">Bienvenue dans votre assistant IA privé</h2>
                <p className="text-muted">
                  Importez vos premiers documents pour poser des questions contextualisées.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Main Content Grid */}
          {!showOnboarding && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Usage Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Utilisation ce mois</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <UsageBar
                    label="Conversations"
                    current={dashboardData?.usage.conversations_count || 0}
                    limit={50} // Assume 50 conversations limit for starter
                    unit="conversations"
                  />
                  <UsageBar
                    label="Documents"
                    current={dashboardData?.docsReady || 0}
                    limit={limits.docsLimit}
                  />
                  <UsageBar
                    label="Stockage"
                    current={dashboardData?.storageBytes || 0}
                    limit={limits.storageLimit}
                    unit="bytes"
                  />
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activité récente</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentActivity limit={5} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </MainContent>
    </LayoutShell>
  )
}

export default function DashboardPage() {
  return <DashboardContent />
}
