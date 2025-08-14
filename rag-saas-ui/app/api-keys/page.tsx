'use client'

import { useState, useEffect } from 'react'
import { LayoutShell } from '@/components/layout/layout-shell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MainContent } from '@/components/layout/MainContent'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiKeysAPI, type ApiKey } from '@/lib/api/apikeys'
import { useApp } from '@/contexts/app-context'
import { useToast } from '@/hooks/use-toast'
import { formatTimeAgo } from '@/lib/utils/time'
import { canAccessPage, getAccessLevel, hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { Plus, Key, Copy, Trash2, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function ApiKeysPage() {
  const { organization, userRole, orgTier } = useApp()
  const { toast } = useToast()
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [permissions, setPermissions] = useState({ can_create: false, can_delete: false })
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<{ key: string; warning: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  // Check access permissions
  const hasAccess = canAccessPage(userRole as UserRole, orgTier, 'apikeys')
  const accessLevel = getAccessLevel(userRole as UserRole, orgTier, 'apikeys')
  const canCreate = hasPermission(userRole as UserRole, 'apikeys.create')
  const canRevoke = hasPermission(userRole as UserRole, 'apikeys.revoke')

  // Early return if no access
  if (!hasAccess) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader 
            title="Clés API" 
            subtitle="Accès programmé à votre organisation"
          />
          
          <Card className="text-center py-12">
            <CardContent>
              <Key className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Accès restreint
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Cette page nécessite des permissions d'administration pour gérer les clés API.
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
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      setLoading(true)
      const response = await ApiKeysAPI.getApiKeys()
      setApiKeys(response.data)
      setPermissions(response.permissions)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de charger les clés API',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return

    try {
      setCreating(true)
      const response = await ApiKeysAPI.createApiKey({ name: newKeyName.trim() })
      
      setCreatedKey({
        key: response.key,
        warning: response.warning
      })
      setShowCreateDialog(false)
      setShowKeyDialog(true)
      setNewKeyName('')
      
      // Recharger la liste
      loadApiKeys()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la clé API',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteApiKey = async () => {
    if (!selectedApiKey) return

    try {
      setDeleting(true)
      await ApiKeysAPI.deleteApiKey(selectedApiKey.id)
      
      toast({
        title: 'Clé supprimée',
        description: `La clé "${selectedApiKey.name}" a été révoquée avec succès`
      })
      
      setShowDeleteDialog(false)
      setSelectedApiKey(null)
      loadApiKeys()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la clé API',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copié',
        description: 'Clé API copiée dans le presse-papiers'
      })
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de copier dans le presse-papiers',
        variant: 'destructive'
      })
    }
  }

  const closeKeyDialog = () => {
    setShowKeyDialog(false)
    setCreatedKey(null)
    setKeyVisible(false)
  }

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader title="Clés API" subtitle="Chargement..." />
          <div>Chargement des clés API...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
      <PageHeader 
        title="Clés API" 
        subtitle="Accès programme à votre organisation"
      >
        {canCreate && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle clé API
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle clé API</DialogTitle>
                <DialogDescription>
                  Donnez un nom descriptif à votre clé API pour l'identifier facilement
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Nom de la clé</Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Ex: Integration Production"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleCreateApiKey} 
                  disabled={!newKeyName.trim() || creating}
                >
                  {creating ? 'Création...' : 'Créer la clé'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="space-y-6">
        {/* Avertissement de sécurité */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Important - Sécurité des clés API
            </CardTitle>
          </CardHeader>
          <CardContent className="text-orange-700 space-y-2 text-sm">
            <p>• Les clés API donnent accès à votre organisation et ses données</p>
            <p>• Chaque clé n'est affichée qu'une seule fois lors de sa création</p>
            <p>• Gardez vos clés secrètes et ne les partagez jamais publiquement</p>
            <p>• Révoquez immédiatement toute clé compromise</p>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Clés actives</p>
                  <p className="text-2xl font-bold">{apiKeys.length}</p>
                </div>
                <Key className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Utilisées récemment</p>
                  <p className="text-2xl font-bold">
                    {apiKeys.filter(key => key.last_used_at).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Jamais utilisées</p>
                  <p className="text-2xl font-bold">
                    {apiKeys.filter(key => !key.last_used_at).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table des clés API */}
        <Card>
          <CardHeader>
            <CardTitle>Clés API</CardTitle>
            <CardDescription>
              Gérez les clés d'accès pour l'intégration avec des services externes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Aucune clé API
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Créez votre première clé API pour commencer l'intégration
                </p>
                {canCreate && (
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une clé API
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead>Dernière utilisation</TableHead>
                    <TableHead>Créée par</TableHead>
                    {canRevoke && <TableHead className="w-[70px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Key className="w-4 h-4 text-blue-500" />
                          <span>{apiKey.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(apiKey.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        {apiKey.last_used_at ? (
                          <Badge variant="secondary">
                            {ApiKeysAPI.formatLastUsed(apiKey.last_used_at)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Jamais utilisée</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {apiKey.created_by}
                      </TableCell>
                      {canRevoke && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedApiKey(apiKey)
                              setShowDeleteDialog(true)
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Dialog pour afficher la clé créée */}
      <Dialog open={showKeyDialog} onOpenChange={closeKeyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
              Clé API créée avec succès
            </DialogTitle>
            <DialogDescription>
              {createdKey?.warning}
            </DialogDescription>
          </DialogHeader>
          
          {createdKey && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                  <span className="font-medium text-red-800">Attention !</span>
                </div>
                <p className="text-red-700 text-sm">
                  Cette clé ne sera plus jamais affichée. Copiez-la maintenant et stockez-la en sécurité.
                </p>
              </div>

              <div>
                <Label htmlFor="created-key">Votre clé API</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 relative">
                    <Input
                      id="created-key"
                      type={keyVisible ? 'text' : 'password'}
                      value={createdKey.key}
                      readOnly
                      className="font-mono text-sm pr-20"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-8 top-0 h-full"
                      onClick={() => setKeyVisible(!keyVisible)}
                    >
                      {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(createdKey.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Utilisation :</strong> Incluez cette clé dans l'header Authorization de vos requêtes HTTP : 
                  <code className="ml-1 bg-blue-100 px-1 rounded">Authorization: Bearer {createdKey.key.slice(0, 8)}...</code>
                </p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button onClick={closeKeyDialog}>
              J'ai copié ma clé, fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer la clé API</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir révoquer la clé "{selectedApiKey?.name}" ? 
              Cette action est irréversible et cassera tous les services qui l'utilisent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteApiKey}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? 'Révocation...' : 'Révoquer la clé'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </MainContent>
    </LayoutShell>
  )
}