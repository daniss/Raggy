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
import { ConversationsAPI, type Conversation, type ConversationsResponse } from '@/lib/api/conversations'
import { useApp } from '@/contexts/app-context'
import { useToast } from '@/hooks/use-toast'
// Utiliser les utilitaires time existants
import { formatTimeAgo } from '@/lib/utils/time'
import { Plus, MessageSquare, Search, MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function ConversationsPage() {
  const { organization } = useApp()
  const { toast } = useToast()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasMore: false
  })
  
  const CONVERSATIONS_PER_PAGE = 20
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    loadConversations()
  }, [page, searchTerm])

  // Reset page when search term changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
  }, [searchTerm])

  const loadConversations = async () => {
    if (!organization?.id) return
    
    try {
      setLoading(true)
      const response = await ConversationsAPI.getConversations(organization.id, {
        page,
        limit: CONVERSATIONS_PER_PAGE,
        search: searchTerm || undefined
      })
      
      setConversations(response.conversations)
      setPagination({
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les conversations',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConversation = async () => {
    if (!organization?.id || !newTitle.trim()) return

    try {
      await ConversationsAPI.createConversation(organization.id, newTitle.trim())
      toast({
        title: 'Succès',
        description: 'Conversation créée avec succès'
      })
      setNewTitle('')
      setShowNewDialog(false)
      loadConversations()
    } catch (error) {
      toast({
        title: 'Erreur', 
        description: 'Impossible de créer la conversation',
        variant: 'destructive'
      })
    }
  }

  const handleRenameConversation = async () => {
    if (!selectedConversation || !newTitle.trim()) return

    try {
      await ConversationsAPI.updateConversation(selectedConversation.id, { title: newTitle.trim() })
      toast({
        title: 'Succès',
        description: 'Conversation renommée avec succès'
      })
      setNewTitle('')
      setShowEditDialog(false)
      setSelectedConversation(null)
      loadConversations()
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de renommer la conversation',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return

    try {
      await ConversationsAPI.deleteConversation(selectedConversation.id)
      toast({
        title: 'Succès',
        description: 'Conversation supprimée avec succès'
      })
      setShowDeleteDialog(false)
      setSelectedConversation(null)
      loadConversations()
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la conversation',
        variant: 'destructive'
      })
    }
  }

  // Pas besoin de filtrage côté client, fait côté serveur
  const displayConversations = conversations

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
        <PageHeader title="Conversations" subtitle="Chargement..." />
          <div>Chargement des conversations...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
      <PageHeader 
        title="Conversations" 
        subtitle="Historique et gestion des échanges"
      >
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle conversation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle conversation</DialogTitle>
              <DialogDescription>
                Créez une nouvelle conversation pour organiser vos échanges
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre de la conversation</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Questions sur les contrats"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateConversation} disabled={!newTitle.trim()}>
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="space-y-6">
        {/* Barre de recherche */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-1" />
              {pagination.total} conversation{pagination.total > 1 ? 's' : ''}
            </div>
            {searchTerm && (
              <div>{conversations.length} résultat{conversations.length > 1 ? 's' : ''}</div>
            )}
          </div>
          
          {/* Pagination info */}
          {pagination.totalPages > 1 && (
            <div className="text-sm text-muted-foreground">
              Page {page} sur {pagination.totalPages}
            </div>
          )}
        </div>

        {/* Table des conversations */}
        {displayConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm ? 'Aucun résultat' : 'Aucune conversation'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'Essayez de modifier votre recherche'
                : 'Créez votre première conversation pour commencer'
              }
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayConversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        <span>{conversation.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {conversation.message_count || 0} message{(conversation.message_count || 0) > 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimeAgo(conversation.updated_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(conversation.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedConversation(conversation)
                              setNewTitle(conversation.title)
                              setShowEditDialog(true)
                            }}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedConversation(conversation)
                              setShowDeleteDialog(true)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1 || loading}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages || loading}
                  >
                    Suivant
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  Conversations {Math.min((page - 1) * CONVERSATIONS_PER_PAGE + 1, pagination.total)} à{' '}
                  {Math.min(page * CONVERSATIONS_PER_PAGE, pagination.total)} sur {pagination.total}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog de renommage */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
            <DialogDescription>
              Modifiez le titre de la conversation "{selectedConversation?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Nouveau titre</Label>
              <Input
                id="edit-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRenameConversation} disabled={!newTitle.trim()}>
              Renommer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la conversation "{selectedConversation?.title}" ? 
              Cette action est irréversible et supprimera également tous les messages associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </MainContent>
    </LayoutShell>
  )
}