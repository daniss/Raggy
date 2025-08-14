'use client'

import { useState, useEffect } from 'react'
import { LayoutShell } from '@/components/layout/layout-shell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MainContent } from '@/components/layout/MainContent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuditAPI, type AuditLog } from '@/lib/api/audit'
import { useApp } from '@/contexts/app-context'
import { useToast } from '@/hooks/use-toast'
import { formatTimeAgo } from '@/lib/utils/time'
import { canAccessPage, getAccessLevel, hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { Shield, Search, Filter, Download, Calendar, User, Archive, AlertTriangle } from 'lucide-react'

interface PurgeProof {
  id: string
  document_id: string | null
  stats_before: any
  stats_after: any
  proof_hash: string
  created_at: string
  requested_by: string
}

export default function ConformitePage() {
  const { organization, userRole, orgTier } = useApp()
  const { toast } = useToast()
  
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [purgeProofs, setPurgeProofs] = useState<PurgeProof[]>([])
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [retentionDays, setRetentionDays] = useState(30)
  const [retentionLoading, setRetentionLoading] = useState(false)
  
  // Filtres pour les audits
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [eventType, setEventType] = useState('')
  const [userId, setUserId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([])

  // Check access permissions
  const hasAccess = canAccessPage(userRole as UserRole, orgTier, 'compliance')
  const accessLevel = getAccessLevel(userRole as UserRole, orgTier, 'compliance')
  const canWriteRetention = hasPermission(userRole as UserRole, 'compliance.write_retention')

  // Early return if no access
  if (!hasAccess) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader 
            title="Conformité" 
            subtitle="Journaux d'activité et rétention"
          />
          
          <Card className="text-center py-12">
            <CardContent>
              <Shield className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Accès restreint
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Cette page nécessite des permissions d'administration sécurité pour accéder aux journaux de conformité.
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
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadAuditLogs(),
        loadPurgeProofs(),
        loadRetentionSettings()
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true)
      const filters = {
        from: dateFrom,
        to: dateTo,
        type: eventType,
        user: userId,
        limit: 50
      }
      
      const response = await AuditAPI.getAuditLogs(filters)
      setAuditLogs(response.data)
      setAvailableEventTypes(response.available_event_types)
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les journaux d\'audit',
        variant: 'destructive'
      })
    } finally {
      setAuditLoading(false)
    }
  }

  const loadPurgeProofs = async () => {
    try {
      // Mock pour l'instant - serait remplacé par l'API réelle
      const response = await fetch('/api/compliance/purge-proofs')
      if (response.ok) {
        const data = await response.json()
        setPurgeProofs(data.data || [])
      }
    } catch (error) {
      console.log('Purge proofs not available yet')
      setPurgeProofs([])
    }
  }

  const loadRetentionSettings = async () => {
    try {
      const response = await fetch('/api/compliance/retention')
      if (response.ok) {
        const data = await response.json()
        setRetentionDays(data.retention_days)
      } else {
        // Fallback par défaut
        setRetentionDays(30)
      }
    } catch (error) {
      console.log('Retention settings not available yet')
      setRetentionDays(30)
    }
  }

  const handleUpdateRetention = async () => {
    if (!canWriteRetention) {
      toast({
        title: 'Accès restreint',
        description: 'La modification de la rétention nécessite des permissions d\'administration sécurité et un plan Enterprise',
        variant: 'destructive'
      })
      return
    }

    try {
      setRetentionLoading(true)
      const response = await fetch('/api/compliance/retention', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ retention_days: retentionDays })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update retention')
      }
      
      toast({
        title: 'Paramètres mis à jour',
        description: `Rétention configurée à ${retentionDays} jours`
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de mettre à jour la rétention',
        variant: 'destructive'
      })
    } finally {
      setRetentionLoading(false)
    }
  }

  const applyFilters = () => {
    loadAuditLogs()
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setEventType('')
    setUserId('')
    setSearchTerm('')
    // Recharger sans filtres
    setTimeout(loadAuditLogs, 100)
  }

  const filteredAuditLogs = auditLogs.filter(log => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return log.action.toLowerCase().includes(searchLower) ||
             log.user_name.toLowerCase().includes(searchLower) ||
             (log.resource_type && log.resource_type.toLowerCase().includes(searchLower))
    }
    return true
  })

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader title="Conformité" subtitle="Chargement..." />
          <div>Chargement des données de conformité...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
      <PageHeader 
        title="Conformité" 
        subtitle="Journaux d'activité et rétention"
      >
        <Shield className="w-5 h-5 text-blue-600" />
      </PageHeader>

      <Tabs defaultValue="audit" className="space-y-6">
        <TabsList>
          <TabsTrigger value="audit">Journaux d'audit</TabsTrigger>
          <TabsTrigger value="retention">Rétention</TabsTrigger>
          <TabsTrigger value="purge">Preuves de purge</TabsTrigger>
        </TabsList>

        {/* Onglet Journaux d'audit */}
        <TabsContent value="audit" className="space-y-6">
          {/* Filtres */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                Filtres de recherche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="date-from">Date début</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="date-to">Date fin</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="event-type">Type d'événement</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous les types</SelectItem>
                      {availableEventTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {AuditAPI.formatEventType(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="search">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="search"
                      placeholder="Action, utilisateur..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  {filteredAuditLogs.length} événement{filteredAuditLogs.length > 1 ? 's' : ''} trouvé{filteredAuditLogs.length > 1 ? 's' : ''}
                </div>
                <div className="space-x-2">
                  <Button variant="outline" onClick={clearFilters}>
                    Effacer les filtres
                  </Button>
                  <Button onClick={applyFilters} disabled={auditLoading}>
                    {auditLoading ? 'Recherche...' : 'Appliquer'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table des journaux d'audit */}
          <Card>
            <CardHeader>
              <CardTitle>Événements d'audit</CardTitle>
              <CardDescription>
                Historique des actions importantes dans votre organisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAuditLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Aucun événement trouvé
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Essayez de modifier vos filtres de recherche
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Ressource</TableHead>
                      <TableHead>Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatTimeAgo(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={AuditAPI.formatActionColor(log.action)}>
                            {AuditAPI.formatEventType(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            {log.user_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.resource_type ? (
                            <div>
                              <div className="font-medium">{log.resource_type}</div>
                              {log.resource_id && (
                                <div className="text-muted-foreground text-xs">
                                  {log.resource_id.slice(0, 8)}...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <div className="text-muted-foreground max-w-xs truncate">
                              {JSON.stringify(log.details)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Rétention */}
        <TabsContent value="retention" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Politique de rétention</CardTitle>
              <CardDescription>
                Configurez la durée de conservation des données dans votre organisation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Rétention des données</div>
                  <div className="text-sm text-muted-foreground">
                    Durée de conservation des journaux d'audit et documents
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Select 
                    value={retentionDays.toString()} 
                    onValueChange={(value) => setRetentionDays(parseInt(value))}
                    disabled={!canWriteRetention}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 jours</SelectItem>
                      <SelectItem value="30">30 jours</SelectItem>
                      <SelectItem value="90">90 jours</SelectItem>
                      <SelectItem value="365">1 an</SelectItem>
                      <SelectItem value="1095">3 ans</SelectItem>
                      <SelectItem value="2555">7 ans</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleUpdateRetention}
                    disabled={retentionLoading || !canWriteRetention}
                  >
                    {retentionLoading ? 'Mise à jour...' : 'Sauvegarder'}
                  </Button>
                </div>
              </div>

              {!canWriteRetention && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                    <div className="text-sm text-yellow-800">
                      La modification des paramètres de rétention nécessite des permissions d'administration sécurité et un plan Enterprise
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{auditLogs.length}</div>
                  <div className="text-sm text-muted-foreground">Événements actuels</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{retentionDays}</div>
                  <div className="text-sm text-muted-foreground">Jours de rétention</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">0</div>
                  <div className="text-sm text-muted-foreground">Purgés automatiquement</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Preuves de purge */}
        <TabsContent value="purge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preuves de purge</CardTitle>
              <CardDescription>
                Enregistrements cryptographiques des suppressions de documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purgeProofs.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Aucune preuve de purge
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Les preuves de purge sont générées automatiquement lors de la suppression de documents
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Hash de preuve</TableHead>
                      <TableHead>Demandé par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purgeProofs.map((proof) => (
                      <TableRow key={proof.id}>
                        <TableCell className="text-muted-foreground">
                          {formatTimeAgo(proof.created_at)}
                        </TableCell>
                        <TableCell>
                          {proof.document_id ? (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {proof.document_id.slice(0, 8)}...
                            </code>
                          ) : (
                            <span className="text-muted-foreground">Document supprimé</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {proof.proof_hash.slice(0, 16)}...
                          </code>
                        </TableCell>
                        <TableCell>{proof.requested_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </MainContent>
    </LayoutShell>
  )
}