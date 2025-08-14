"use client"

import { useState, useEffect } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { SettingsAPI, type OrganizationSettings } from "@/lib/api/settings"
import { useApp } from "@/contexts/app-context"
import { Settings, Bot, Bell, Shield, CreditCard, Save, Loader2, AlertTriangle, Zap } from "lucide-react"

export default function SettingsPage() {
  const { organization, userRole } = useApp()
  const [settings, setSettings] = useState<OrganizationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<{
    orgName: string
    aiModel: string
    maxTokens: number
    temperature: number
    enableCitations: boolean
    enableStreaming: boolean
    notificationEmail: boolean
    notificationPush: boolean
    notificationWeekly: boolean
  }>({
    orgName: '',
    aiModel: 'gpt-3.5-turbo',
    maxTokens: 2000,
    temperature: 0.7,
    enableCitations: true,
    enableStreaming: true,
    notificationEmail: true,
    notificationPush: false,
    notificationWeekly: true,
  })

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!organization?.id) return
      
      try {
        setLoading(true)
        const data = await SettingsAPI.getSettings(organization.id)
        setSettings(data)
        
        // Update form data
        setFormData({
          orgName: data.organization.name,
          aiModel: data.settings.ai_model || 'gpt-3.5-turbo',
          maxTokens: data.settings.max_tokens || 2000,
          temperature: data.settings.temperature || 0.7,
          enableCitations: data.settings.enable_citations ?? true,
          enableStreaming: data.settings.enable_streaming ?? true,
          notificationEmail: data.settings.notification_email ?? true,
          notificationPush: data.settings.notification_push ?? false,
          notificationWeekly: data.settings.notification_weekly ?? true,
        })
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [organization?.id])

  // Save settings
  const handleSave = async () => {
    if (!organization?.id) return
    
    try {
      setSaving(true)
      
      await SettingsAPI.updateSettings(
        organization.id,
        {
          name: formData.orgName,
        },
        {
          ai_model: formData.aiModel,
          max_tokens: formData.maxTokens,
          temperature: formData.temperature,
          enable_citations: formData.enableCitations,
          enable_streaming: formData.enableStreaming,
          notification_email: formData.notificationEmail,
          notification_push: formData.notificationPush,
          notification_weekly: formData.notificationWeekly,
        }
      )

      // Refresh settings
      const data = await SettingsAPI.getSettings(organization.id)
      setSettings(data)
      
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const canEdit = userRole && ['owner', 'admin'].includes(userRole)
  const isProTier = settings?.organization.tier === 'pro'
  const isEnterpriseTier = settings?.organization.tier === 'enterprise'

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader title="Paramètres" subtitle="Chargement..." />
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
        <PageHeader 
          title="Paramètres"
          subtitle="Configurez votre organisation et vos préférences"
        >
          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          )}
        </PageHeader>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Général
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              IA
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Facturation
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations de l'organisation</CardTitle>
                <CardDescription>Gérez les informations de base de votre organisation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nom de l'organisation</Label>
                  <Input
                    id="orgName"
                    value={formData.orgName}
                    onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Plan actuel</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={isEnterpriseTier ? "default" : isProTier ? "secondary" : "outline"}>
                      {settings?.organization.tier === 'enterprise' ? 'Enterprise' : 
                       settings?.organization.tier === 'pro' ? 'Pro' : 'Starter'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Créé le {new Date(settings?.organization.created_at || '').toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Votre rôle</Label>
                  <Badge variant="outline">
                    {userRole === 'owner' ? 'Propriétaire' : 
                     userRole === 'admin' ? 'Administrateur' : 
                     userRole === 'editor' ? 'Éditeur' : 'Utilisateur'}
                  </Badge>
                </div>

                {!canEdit && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800">
                        Seuls les propriétaires et administrateurs peuvent modifier ces paramètres.
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration IA</CardTitle>
                <CardDescription>Personnalisez le comportement de votre assistant IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="aiModel">Modèle IA</Label>
                  <Select
                    value={formData.aiModel}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, aiModel: value }))}
                    disabled={!canEdit || !isProTier}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="gpt-4" disabled={!isProTier}>GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo" disabled={!isEnterpriseTier}>GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isProTier && (
                    <p className="text-xs text-muted-foreground">
                      Modèles avancés disponibles avec le plan Pro
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxTokens">Tokens maximum</Label>
                      <Badge variant="outline">{formData.maxTokens}</Badge>
                    </div>
                    <Slider
                      id="maxTokens"
                      min={100}
                      max={4000}
                      step={100}
                      value={[formData.maxTokens]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, maxTokens: value }))}
                      disabled={!canEdit}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="temperature">Créativité (Temperature)</Label>
                      <Badge variant="outline">{formData.temperature}</Badge>
                    </div>
                    <Slider
                      id="temperature"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[formData.temperature]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
                      disabled={!canEdit}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = Précis et factuel • 1 = Créatif et varié
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Citations automatiques</Label>
                      <p className="text-sm text-muted-foreground">Afficher les sources des réponses</p>
                    </div>
                    <Switch
                      checked={formData.enableCitations}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableCitations: checked }))}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center gap-2">
                        Réponses en temps réel
                        {!isProTier && <Zap className="w-3 h-3 text-yellow-500" />}
                      </Label>
                      <p className="text-sm text-muted-foreground">Stream des réponses pendant la génération</p>
                    </div>
                    <Switch
                      checked={formData.enableStreaming}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableStreaming: checked }))}
                      disabled={!canEdit || !isProTier}
                    />
                  </div>
                  {!isProTier && (
                    <p className="text-xs text-muted-foreground">
                      Fonctionnalité Pro requise
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Préférences de notification</CardTitle>
                <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notifications par email</Label>
                    <p className="text-sm text-muted-foreground">Recevez des notifications importantes par email</p>
                  </div>
                  <Switch
                    checked={formData.notificationEmail}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notificationEmail: checked }))}
                    disabled={!canEdit}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notifications push</Label>
                    <p className="text-sm text-muted-foreground">Notifications dans le navigateur</p>
                  </div>
                  <Switch
                    checked={formData.notificationPush}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notificationPush: checked }))}
                    disabled={!canEdit}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rapport hebdomadaire</Label>
                    <p className="text-sm text-muted-foreground">Résumé de votre activité chaque semaine</p>
                  </div>
                  <Switch
                    checked={formData.notificationWeekly}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notificationWeekly: checked }))}
                    disabled={!canEdit}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plan et facturation</CardTitle>
                <CardDescription>Gérez votre abonnement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        Plan {settings?.organization.tier === 'enterprise' ? 'Enterprise' : 
                             settings?.organization.tier === 'pro' ? 'Pro' : 'Starter'}
                      </h3>
                      <Badge>Actuel</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {settings?.organization.tier === 'starter' ? 'Gratuit' :
                       settings?.organization.tier === 'pro' ? '29€/mois' : 'Sur mesure'}
                    </p>
                  </div>
                  <Button variant="outline">
                    {settings?.organization.tier === 'starter' ? 'Mettre à niveau' : 'Gérer l\'abonnement'}
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900">Fonctionnalités de votre plan</h4>
                  <ul className="mt-2 space-y-1 text-sm text-blue-800">
                    {settings?.organization.tier === 'starter' && (
                      <>
                        <li>• Documents limités (100)</li>
                        <li>• Modèle GPT-3.5 uniquement</li>
                        <li>• Support par email</li>
                      </>
                    )}
                    {settings?.organization.tier === 'pro' && (
                      <>
                        <li>• Documents illimités</li>
                        <li>• Accès GPT-4</li>
                        <li>• Réponses en temps réel</li>
                        <li>• Support prioritaire</li>
                      </>
                    )}
                    {settings?.organization.tier === 'enterprise' && (
                      <>
                        <li>• Tout du plan Pro</li>
                        <li>• Modèles GPT-4 Turbo</li>
                        <li>• Support 24/7</li>
                        <li>• Intégrations personnalisées</li>
                      </>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </MainContent>
    </LayoutShell>
  )
}