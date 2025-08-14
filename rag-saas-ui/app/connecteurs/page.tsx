'use client'

import { useState, useEffect } from 'react'
import { LayoutShell } from '@/components/layout/layout-shell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MainContent } from '@/components/layout/MainContent'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConnectorsAPI, type Connector, type ConnectorType } from '@/lib/api/connectors'
import { useApp } from '@/contexts/app-context'
import { useToast } from '@/hooks/use-toast'
import { formatTimeAgo } from '@/lib/utils/time'
import { canAccessPage, getAccessLevel, hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { 
  Plus, 
  Plug, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MoreHorizontal,
  History
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function ConnecteursPage() {
  const { organization, userRole, orgTier } = useApp()
  const { toast } = useToast()
  
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [availableTypes, setAvailableTypes] = useState<ConnectorType[]>([])
  const [permissions, setPermissions] = useState({ can_create: false, can_manage: false })
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRunsDialog, setShowRunsDialog] = useState(false)
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [connectorRuns, setConnectorRuns] = useState<any[]>([])
  
  // Form states
  const [newConnectorName, setNewConnectorName] = useState('')
  const [newConnectorType, setNewConnectorType] = useState('')
  const [connectorConfig, setConnectorConfig] = useState('')
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [running, setRunning] = useState<string | null>(null)

  // Check access permissions
  const hasAccess = canAccessPage(userRole as UserRole, orgTier, 'connectors')
  const accessLevel = getAccessLevel(userRole as UserRole, orgTier, 'connectors')
  const canCreate = hasPermission(userRole as UserRole, 'connectors.write')
  const canManage = hasPermission(userRole as UserRole, 'connectors.write')

  useEffect(() => {
    if (hasAccess) {
      loadConnectors()
    }
  }, [hasAccess])

  const loadConnectors = async () => {
    try {
      setLoading(true)
      const response = await ConnectorsAPI.getConnectors()
      setConnectors(response.data)
      setAvailableTypes(response.available_types)
      setPermissions(response.permissions)
    } catch (error: any) {
      if (error.message.includes('Enterprise tier required')) {
        // C'est normal pour les plans non-Enterprise
      } else {
        toast({
          title: 'Erreur',
          description: error.message || 'Impossible de charger les connecteurs',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConnector = async () => {
    if (!newConnectorName.trim() || !newConnectorType) return

    try {
      setCreating(true)
      const config = connectorConfig ? JSON.parse(connectorConfig) : undefined
      
      await ConnectorsAPI.createConnector({
        name: newConnectorName.trim(),
        type: newConnectorType,
        config
      })
      
      toast({
        title: 'Connecteur créé',
        description: `Le connecteur "${newConnectorName}" a été créé avec succès`
      })
      
      setShowCreateDialog(false)
      resetForm()
      loadConnectors()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le connecteur',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleRunConnector = async (connector: Connector) => {
    try {
      setRunning(connector.id)
      const response = await ConnectorsAPI.runConnector(connector.id)
      
      toast({
        title: 'Synchronisation démarrée',
        description: response.message
      })
      
      // Recharger après 3 secondes pour voir le changement de statut
      setTimeout(loadConnectors, 3000)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de démarrer la synchronisation',
        variant: 'destructive'
      })
    } finally {
      setRunning(null)
    }
  }

  const handleDeleteConnector = async () => {
    if (!selectedConnector) return

    try {
      setDeleting(true)
      await ConnectorsAPI.deleteConnector(selectedConnector.id)
      
      toast({
        title: 'Connecteur supprimé',
        description: `Le connecteur "${selectedConnector.name}" a été supprimé`
      })
      
      setShowDeleteDialog(false)
      setSelectedConnector(null)
      loadConnectors()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le connecteur',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleViewRuns = async (connector: Connector) => {
    try {
      setSelectedConnector(connector)
      const response = await ConnectorsAPI.getConnectorRuns(connector.id)
      setConnectorRuns(response.runs)
      setShowRunsDialog(true)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'historique des synchronisations',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setNewConnectorName('')
    setNewConnectorType('')
    setConnectorConfig('')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'idle':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getRunStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      running: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    }
    
    const labels: Record<string, string> = {
      running: 'En cours',
      success: 'Réussi',
      error: 'Échec'
    }

    return (
      <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader title="Connecteurs" subtitle="Chargement..." />
          <div>Chargement des connecteurs...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  // Si pas d'accès, afficher un message
  if (!hasAccess) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader 
          title="Connecteurs" 
          subtitle="Synchronisation de vos sources externes"
        />
        
        <Card className="text-center py-12">
          <CardContent>
            <Plug className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {organization?.tier !== 'enterprise' ? 'Fonctionnalité Enterprise' : 'Accès restreint'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {organization?.tier !== 'enterprise' ? 
                'Les connecteurs permettent de synchroniser automatiquement vos documents depuis Google Drive, SharePoint, Slack et d\'autres sources externes.' :
                'Cette page nécessite des permissions d\'administration pour gérer les connecteurs.'
              }
            </p>
            <Button variant="outline" disabled>
              {organization?.tier !== 'enterprise' ? 
                'Disponible avec le plan Enterprise' : 
                'Permissions insuffisantes'
              }
            </Button>
          </CardContent>
        </Card>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
      <PageHeader 
        title="Connecteurs" 
        subtitle="Synchronisation de vos sources externes"
      >
        {canCreate && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau connecteur
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouveau connecteur</DialogTitle>
                <DialogDescription>
                  Configurez un nouveau connecteur pour synchroniser vos documents
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="connector-name">Nom du connecteur</Label>
                  <Input
                    id="connector-name"
                    value={newConnectorName}
                    onChange={(e) => setNewConnectorName(e.target.value)}
                    placeholder="Ex: Google Drive Marketing"
                  />
                </div>
                <div>
                  <Label htmlFor="connector-type">Type</Label>
                  <Select value={newConnectorType} onValueChange={setNewConnectorType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center">
                            <span>{ConnectorsAPI.getConnectorTypeIcon(type.id)}</span>
                            <span className="ml-2">{type.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="connector-config">Configuration (JSON)</Label>
                  <Textarea
                    id="connector-config"
                    value={connectorConfig}
                    onChange={(e) => setConnectorConfig(e.target.value)}
                    placeholder='{"folder": "/documents", "filter": "*.pdf"}'
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Configuration spécifique au type de connecteur (optionnel)
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleCreateConnector} 
                  disabled={!newConnectorName.trim() || !newConnectorType || creating}
                >
                  {creating ? 'Création...' : 'Créer le connecteur'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="space-y-6">
        {/* Galerie des types de connecteurs disponibles */}
        {connectors.length === 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Connecteurs disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {availableTypes.map((type) => (
                <Card key={type.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {ConnectorsAPI.getConnectorTypeIcon(type.id)}
                      </div>
                      <div>
                        <h4 className="font-medium">{type.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Synchroniser depuis {type.name}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Liste des connecteurs configurés */}
        <Card>
          <CardHeader>
            <CardTitle>Connecteurs configurés</CardTitle>
            <CardDescription>
              Gérez vos connecteurs et leurs synchronisations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connectors.length === 0 ? (
              <div className="text-center py-12">
                <Plug className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Aucun connecteur configuré
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Configurez votre premier connecteur pour synchroniser vos documents
                </p>
                {canCreate && (
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Configurer un connecteur
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connecteur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière sync</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectors.map((connector) => (
                    <TableRow key={connector.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(connector.status)}
                          <span>{connector.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{ConnectorsAPI.getConnectorTypeIcon(connector.type)}</span>
                          <span>{availableTypes.find(t => t.id === connector.type)?.name || connector.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ConnectorsAPI.getStatusColor(connector.status)}>
                          {ConnectorsAPI.formatConnectorStatus(connector.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {connector.last_run ? 
                          formatTimeAgo(connector.last_run.started_at) : 
                          'Jamais'
                        }
                      </TableCell>
                      <TableCell>
                        {connector.last_run ? (
                          getRunStatusBadge(connector.last_run.status)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunConnector(connector)}
                            disabled={connector.status === 'running' || running === connector.id}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewRuns(connector)}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedConnector(connector)
                                    setShowConfigDialog(true)
                                  }}
                                >
                                  <Settings className="w-4 h-4 mr-2" />
                                  Configurer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedConnector(connector)
                                    setShowDeleteDialog(true)
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Dialog historique des runs */}
      <Dialog open={showRunsDialog} onOpenChange={setShowRunsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historique des synchronisations</DialogTitle>
            <DialogDescription>
              Connecteur : {selectedConnector?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {connectorRuns.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Aucune synchronisation effectuée
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectorRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-muted-foreground">
                        {formatTimeAgo(run.started_at)}
                      </TableCell>
                      <TableCell>
                        {getRunStatusBadge(run.status)}
                      </TableCell>
                      <TableCell>{run.duration}</TableCell>
                      <TableCell className="text-sm">
                        {run.stats && (
                          <div className="text-muted-foreground">
                            {JSON.stringify(run.stats)}
                          </div>
                        )}
                        {run.error_message && (
                          <div className="text-red-600">
                            {run.error_message}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowRunsDialog(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le connecteur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le connecteur "{selectedConnector?.name}" ? 
              Cette action supprimera également tout l'historique des synchronisations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConnector}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </MainContent>
    </LayoutShell>
  )
}