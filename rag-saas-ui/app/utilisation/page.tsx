'use client'

import { useState, useEffect } from 'react'
import { LayoutShell } from '@/components/layout/layout-shell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MainContent } from '@/components/layout/MainContent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UsageAPI, type UsageData } from '@/lib/api/usage'
import { useApp } from '@/contexts/app-context'
import { useToast } from '@/hooks/use-toast'
import { canAccessPage, getAccessLevel } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { Download, TrendingUp, TrendingDown, Minus, BarChart3, FileText, MessageSquare, HardDrive } from 'lucide-react'

export default function UtilisationPage() {
  const { organization, userRole, orgTier } = useApp()
  const { toast } = useToast()
  
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

  // Check access permissions
  const hasAccess = canAccessPage(userRole as UserRole, orgTier, 'usage')
  const accessLevel = getAccessLevel(userRole as UserRole, orgTier, 'usage')

  // Early return if no access
  if (!hasAccess) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader 
            title="Utilisation" 
            subtitle="Suivi de l'usage de votre organisation"
          />
          
          <Card className="text-center py-12">
            <CardContent>
              <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Accès restreint
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Cette page nécessite des permissions d'administration pour accéder aux statistiques d'utilisation.
              </p>
              <Button variant="outline" disabled>
                Permissions insuffisantes
              </Button>
            </CardContent>
          </Card>
        </MainContent>
      </LayoutShell>
    )
  }

  useEffect(() => {
    // Générer les options de mois (6 derniers mois)
    const currentDate = new Date()
    const months = []
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const monthStr = date.toISOString().slice(0, 7) // YYYY-MM
      months.push({
        value: monthStr,
        label: date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      })
    }
    
    if (months.length > 0 && !selectedMonth) {
      setSelectedMonth(months[0].value)
    }
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      loadUsageData()
    }
  }, [selectedMonth])

  const loadUsageData = async () => {
    if (!selectedMonth) return
    
    try {
      setLoading(true)
      const data = await UsageAPI.getUsageSummary(selectedMonth)
      setUsageData(data)
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données d\'utilisation',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      setExportLoading(true)
      const blob = await UsageAPI.exportUsageCSV(selectedMonth)
      const filename = `utilisation-${selectedMonth}.csv`
      UsageAPI.downloadCSV(blob, filename)
      
      toast({
        title: 'Export réussi',
        description: `Le fichier ${filename} a été téléchargé`
      })
    } catch (error) {
      toast({
        title: 'Erreur d\'export',
        description: 'Impossible d\'exporter les données',
        variant: 'destructive'
      })
    } finally {
      setExportLoading(false)
    }
  }

  const formatStorageSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb < 0.01) return '< 10 MB'
    if (gb < 1) return `${Math.round(gb * 1000)} MB`
    return `${Math.round(gb * 10) / 10} GB`
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (trend < -5) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendText = (trend: number) => {
    if (Math.abs(trend) < 1) return 'Stable'
    const sign = trend > 0 ? '+' : ''
    return `${sign}${Math.round(trend)}%`
  }

  if (loading || !usageData) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader title="Utilisation" subtitle="Chargement..." />
          <div>Chargement des données d'utilisation...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  // Générer les options de mois
  const currentDate = new Date()
  const monthOptions = []
  for (let i = 0; i < 6; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
    const monthStr = date.toISOString().slice(0, 7) // YYYY-MM
    monthOptions.push({
      value: monthStr,
      label: date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    })
  }

  return (
    <LayoutShell>
      <MainContent>
      <PageHeader 
        title="Utilisation" 
        subtitle="Suivi mensuel des tokens, documents et stockage"
      >
        <div className="flex items-center space-x-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={exportLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            {exportLoading ? 'Export...' : 'Export CSV'}
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* Métriques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tokens */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                  Tokens utilisés
                </span>
                {getTrendIcon(usageData.trends.tokens)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageData.current_usage.tokens_used.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">
                  / {usageData.limits.tokens === -1 ? 'Illimité' : usageData.limits.tokens.toLocaleString()}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getTrendText(usageData.trends.tokens)}
                </Badge>
              </div>
              {usageData.limits.tokens !== -1 && (
                <Progress value={usageData.usage_percentages.tokens} className="mt-3" />
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-green-600" />
                  Documents traités
                </span>
                {getTrendIcon(usageData.trends.documents)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageData.current_usage.documents_count}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">
                  / {usageData.limits.documents === -1 ? 'Illimité' : usageData.limits.documents}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getTrendText(usageData.trends.documents)}
                </Badge>
              </div>
              {usageData.limits.documents !== -1 && (
                <Progress value={usageData.usage_percentages.documents} className="mt-3" />
              )}
            </CardContent>
          </Card>

          {/* Stockage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center">
                  <HardDrive className="w-4 h-4 mr-2 text-orange-600" />
                  Stockage utilisé
                </span>
                {getTrendIcon(usageData.trends.storage)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatStorageSize(usageData.current_usage.storage_bytes)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">
                  / {usageData.limits.storage_gb === -1 ? 'Illimité' : `${usageData.limits.storage_gb} GB`}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getTrendText(usageData.trends.storage)}
                </Badge>
              </div>
              {usageData.limits.storage_gb !== -1 && (
                <Progress value={usageData.usage_percentages.storage} className="mt-3" />
              )}
            </CardContent>
          </Card>

          {/* Conversations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-purple-600" />
                  Conversations
                </span>
                {getTrendIcon(usageData.trends.conversations)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageData.current_usage.conversations_count}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">
                  Ce mois-ci
                </span>
                <Badge variant="outline" className="text-xs">
                  {getTrendText(usageData.trends.conversations)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan et limites */}
        <Card>
          <CardHeader>
            <CardTitle>Plan et limites</CardTitle>
            <CardDescription>
              Votre plan actuel et les limites associées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Plan {usageData.tier.charAt(0).toUpperCase() + usageData.tier.slice(1)}</div>
                <div className="text-sm text-muted-foreground">
                  Limites mensuelles configurées
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-sm">
                  Tokens: {usageData.limits.tokens === -1 ? 'Illimité' : usageData.limits.tokens.toLocaleString()}
                </div>
                <div className="text-sm">
                  Documents: {usageData.limits.documents === -1 ? 'Illimité' : usageData.limits.documents}
                </div>
                <div className="text-sm">
                  Stockage: {usageData.limits.storage_gb === -1 ? 'Illimité' : `${usageData.limits.storage_gb} GB`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Évolution historique */}
        {usageData.historical_usage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Évolution historique</CardTitle>
              <CardDescription>
                Données des 6 derniers mois
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.historical_usage.map((monthData, index) => {
                  const date = new Date(monthData.month + '-01')
                  const monthName = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
                  
                  return (
                    <div key={monthData.month} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="font-medium">{monthName}</div>
                      <div className="flex items-center space-x-6 text-sm">
                        <div>{monthData.tokens_used.toLocaleString()} tokens</div>
                        <div>{monthData.documents_count} docs</div>
                        <div>{formatStorageSize(monthData.storage_bytes)}</div>
                        <div>{monthData.conversations_count} conv.</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </MainContent>
    </LayoutShell>
  )
}