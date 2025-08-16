"use client"

import { useState, useEffect, useRef } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { TwoPane } from "@/components/layout/TwoPane"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChatBubble } from "@/components/chat/ChatBubble"
import { SourceItem } from "@/components/chat/SourceItem"
import { useLimits } from "@/lib/hooks/use-limits"
import { useFeatureGating } from "@/lib/hooks/use-feature-gating"
import { useApp } from "@/contexts/app-context"
import { ConversationsAPI, type Conversation, type Message } from "@/lib/api/conversations"
import { useChat, type ChatOptions } from "@/lib/hooks/use-chat"
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/utils/time"
import { parseInlineCitations, removeInlineCitations, groupCitationsByDocument, formatDocumentSource } from "@/lib/utils/citations"
import { Send, Bot, User, Plus, Clock, Zap, FileText, AlertTriangle, Loader2, Square, RotateCcw, MoreHorizontal, Edit2, Trash2, X, Search, Menu, MessageCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"

function AssistantContent() {
  const [message, setMessage] = useState("")
  const [quickMode, setQuickMode] = useState(false)
  const [citationsEnabled, setCitationsEnabled] = useState(true)
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [conversationSearch, setConversationSearch] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [showCitationsPanel, setShowCitationsPanel] = useState(false)
  const [showCitationsSidePanel, setShowCitationsSidePanel] = useState(false)
  const [showMobileConversations, setShowMobileConversations] = useState(false)
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  
  const limits = useLimits()
  const { openLocked } = useFeatureGating()
  const { organization } = useApp()
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chat = useChat({
    orgId: organization?.id || '',
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error,
        variant: 'destructive'
      })
    },
    onSuccess: (assistantContent?: string) => {
      // Add assistant message to local state instead of reloading
      if (assistantContent) {
        const assistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          type: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
          metadata: chat.citations.length > 0 ? { citations: chat.citations } : undefined
        }
        setMessages(prev => [...prev, assistantMessage])
      }
      
      // Only update conversations list to show updated message count/timestamp
      loadConversations()
    }
  })

  // Load conversations function  
  const loadConversations = async () => {
    if (!organization?.id) return
    
    try {
      setLoadingConversations(true)
      const response = await ConversationsAPI.getConversations(organization.id)
      setConversations(response.conversations)
      
      // Auto-select first conversation if none selected
      if (response.conversations.length > 0 && !activeConversation) {
        setActiveConversation(response.conversations[0].id)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les conversations',
        variant: 'destructive'
      })
    } finally {
      setLoadingConversations(false)
    }
  }

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [organization?.id])

  // Filter conversations based on search
  useEffect(() => {
    if (!conversationSearch.trim()) {
      setFilteredConversations(conversations)
    } else {
      const filtered = conversations.filter(conv => 
        conv.title.toLowerCase().includes(conversationSearch.toLowerCase())
      )
      setFilteredConversations(filtered)
    }
  }, [conversations, conversationSearch])

  // Load messages function
  const loadMessages = async () => {
    if (!activeConversation) return
    
    try {
      setLoadingMessages(true)
      const msgs = await ConversationsAPI.getMessages(activeConversation)
      setMessages(msgs)
      setLoadedConversationId(activeConversation)
    } catch (error) {
      console.error('Failed to load messages:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les messages',
        variant: 'destructive'
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  // Load messages when conversation changes to a different one
  useEffect(() => {
    if (activeConversation && activeConversation !== loadedConversationId) {
      setShouldAutoScroll(false) // Don't auto-scroll when loading existing conversation
      loadMessages()
    } else if (!activeConversation) {
      setMessages([])
      setLoadedConversationId(null)
      setShouldAutoScroll(false) // Don't auto-scroll for empty state
    }
  }, [activeConversation])

  // Auto-scroll to bottom when new messages arrive - more conservative approach
  useEffect(() => {
    // Only auto-scroll when actively streaming or when new messages arrive in current conversation
    if ((chat.isStreaming || shouldAutoScroll) && messagesEndRef.current) {
      const scrollOptions = chat.isStreaming ? { behavior: 'smooth' as const } : { behavior: 'auto' as const }
      messagesEndRef.current.scrollIntoView(scrollOptions)
    }
  }, [messages.length, chat.streamingContent, shouldAutoScroll, chat.isStreaming])

  // Create new conversation (will be created automatically on first message)
  const handleCreateConversation = () => {
    // Stop any ongoing streaming
    if (chat.isStreaming) {
      chat.stop()
    }
    setActiveConversation(null)
    setMessages([])
    setLoadedConversationId(null)
    setLastUserMessage("")
  }

  // Send message using streaming
  const handleSendMessage = async () => {
    if (!message.trim() || chat.isStreaming || !organization?.id) return

    const messageContent = message.trim()
    setMessage("")
    setLastUserMessage(messageContent)
    setShouldAutoScroll(true) // Enable auto-scroll for new messages
    
    // Optimistically add user message to UI immediately
    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      type: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    
    const options: ChatOptions = {
      citations: citationsEnabled,
      fast_mode: quickMode
    }
    
    try {
      const newConversationId = await chat.send(messageContent, options, activeConversation)
      
      if (newConversationId && !activeConversation) {
        // New conversation was created
        setActiveConversation(newConversationId)
        setLoadedConversationId(newConversationId)
        // Update conversations list without full reload
        loadConversations()
      }
      
      // Show citations panel if citations are enabled and received
      if (citationsEnabled && chat.citations.length > 0) {
        setShowCitationsSidePanel(true)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    }
  }

  // Regenerate last response
  const handleRegenerate = async () => {
    if (!lastUserMessage || chat.isStreaming || !organization?.id) return
    
    const options: ChatOptions = {
      citations: citationsEnabled,
      fast_mode: quickMode
    }
    
    await chat.regenerate(lastUserMessage, options, activeConversation)
  }

  // Rename conversation
  const handleRenameConversation = async () => {
    if (!selectedConversation || !renameTitle.trim()) return
    
    try {
      await ConversationsAPI.updateConversation(selectedConversation.id, {
        title: renameTitle.trim()
      })
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, title: renameTitle.trim() }
            : conv
        )
      )
      
      setShowRenameDialog(false)
      setRenameTitle("")
      setSelectedConversation(null)
      
      toast({
        title: 'Conversation renommée',
        description: 'Le titre de la conversation a été mis à jour'
      })
    } catch (error) {
      console.error('Failed to rename conversation:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de renommer la conversation',
        variant: 'destructive'
      })
    }
  }

  // Delete conversation
  const handleDeleteConversation = async () => {
    if (!selectedConversation) return
    
    try {
      await ConversationsAPI.deleteConversation(selectedConversation.id)
      
      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== selectedConversation.id))
      
      // If deleted conversation was active, clear selection
      if (activeConversation === selectedConversation.id) {
        setActiveConversation(null)
        setMessages([])
      }
      
      setShowDeleteDialog(false)
      setSelectedConversation(null)
      
      toast({
        title: 'Conversation supprimée',
        description: 'La conversation a été supprimée avec succès'
      })
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la conversation',
        variant: 'destructive'
      })
    }
  }

  const tokensRatio = limits.tokensUsed / limits.tokensLimit
  const showUsageWarning = tokensRatio >= 0.8

  // Citations Panel ultra-compact premium
  const citationsPanel = (
    <div className="flex flex-col h-full bg-surface-elevated/40 backdrop-blur-sm">
      {/* Header minimaliste */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-accent" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">Sources</h3>
          <div className="w-5 h-5 rounded-full bg-surface-elevated/80 border border-border/40 flex items-center justify-center">
            <span className="text-[10px] font-medium text-text-subtle">
              {chat.citations.length}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCitationsSidePanel(false)}
          className="h-6 w-6 p-0 text-text-subtle hover:text-foreground hover:bg-surface-elevated/60 rounded-lg transition-colors"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-3">
        {chat.citations.length === 0 ? (
          <div className="text-center py-12 px-2">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-elevated/60 border border-border/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-text-subtle" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucune source</p>
            <p className="text-xs text-text-subtle leading-relaxed max-w-[140px] mx-auto">
              Les sources apparaîtront avec les réponses
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {chat.citations.map((citation, idx) => (
              <div 
                key={idx} 
                className="group relative animate-in fade-in duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Carte source ultra-compacte */}
                <div className="border border-border/40 rounded-xl p-3 bg-background/60 hover:bg-surface-elevated/60 hover:border-border/60 transition-all duration-250 hover:shadow-surface-low backdrop-blur-sm">
                  <div className="flex items-start gap-2.5">
                    {/* Indicateur numérique */}
                    <div className="flex-shrink-0 w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center mt-0.5">
                      <span className="text-[10px] font-bold text-accent tabular-nums">
                        {idx + 1}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Titre compact */}
                      <h4 className="font-medium text-[13px] text-foreground line-clamp-2 leading-tight mb-2">
                        {citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 8)}...`}
                      </h4>
                      
                      {/* Score visuel minimaliste */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1 bg-surface-elevated/80 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700 ease-out"
                            style={{ 
                              width: `${citation.score * 100}%`,
                              animationDelay: `${idx * 150}ms`
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-text-subtle tabular-nums">
                          {Math.round(citation.score * 100)}%
                        </span>
                      </div>
                      
                      {/* Métadonnées ultra-compactes */}
                      <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                        <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md">
                          §{citation.chunk_index}
                        </span>
                        {citation.page && (
                          <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md">
                            p.{citation.page}
                          </span>
                        )}
                        {citation.section && citation.section !== 'main' && (
                          <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md truncate max-w-[60px]">
                            {citation.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Footer informatif compact */}
      {chat.citations.length > 0 && (
        <div className="mt-2 pt-3 border-t border-border/20 px-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-subtle leading-tight">
              {chat.citations.length} source{chat.citations.length > 1 ? 's' : ''} analysée{chat.citations.length > 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm" 
              onClick={() => setShowCitationsPanel(true)}
              className="h-6 px-2 text-[10px] text-text-subtle hover:text-foreground hover:bg-surface-elevated/60 rounded-lg"
            >
              Détails
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // === LEFT PANE: CONVERSATIONS PREMIUM ===
  const leftPane = (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-sm">
      {/* En-tête conversations ultra-épuré */}
      <div 
        className="flex items-center justify-between px-4 py-4 border-b border-border/30 flex-shrink-0"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          Conversations
        </h2>
        <Button 
          size="sm" 
          onClick={handleCreateConversation} 
          disabled={loadingConversations}
          className="
            h-7 w-7 p-0 bg-accent-100 hover:bg-accent-200 border-0
            text-accent-700 hover:text-accent-800
            transition-all duration-200
          "
          style={{ borderRadius: 'var(--radius-xs)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="sr-only">Nouvelle conversation</span>
        </Button>
      </div>

      {/* Recherche locale minimaliste */}
      <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            className="
              pl-9 h-8 text-xs bg-background/40 border-border/40
              focus:border-accent-300 focus:ring-1 focus:ring-accent-200
              placeholder:text-muted-foreground/50
              transition-all duration-200
            "
            style={{ borderRadius: 'var(--radius-xs)' }}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {loadingConversations ? (
          <div className="space-y-2 pr-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div 
                key={i} 
                className="flex items-center space-x-3 p-3 animate-in fade-in duration-500 border border-border/20 rounded-xl bg-surface-elevated/30"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="w-2 h-2 bg-accent/40 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surface-elevated/60 rounded-lg animate-pulse" />
                  <div className="h-2.5 bg-surface-elevated/40 rounded-lg animate-pulse w-2/3" />
                </div>
                <div className="w-1.5 h-1.5 bg-surface-elevated/50 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5 pr-2">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {conversationSearch ? (
                  <div className="space-y-1">
                    <p className="text-sm">Aucune conversation trouvée</p>
                    <p className="text-xs">Essayez un autre terme</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-8 h-8 bg-accent/20 rounded-full mx-auto flex items-center justify-center animate-in zoom-in duration-400">
                      <Bot className="w-4 h-4 text-accent animate-pulse" />
                    </div>
                    <div className="space-y-1 animate-in slide-in-from-bottom-2 duration-400 delay-200">
                      <p className="text-sm font-medium">Aucune conversation</p>
                      <p className="text-xs text-text-subtle leading-relaxed">Posez votre première question</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCreateConversation}
                      className="mt-3 h-7 px-3 text-xs bg-accent hover:bg-accent/90 text-accent-foreground animate-in slide-in-from-bottom-1 duration-400 delay-400"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Commencer
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredConversations.map((conv, index) => (
                <div
                  key={conv.id}
                  className={`conversation-item cursor-pointer relative group transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in fade-in slide-in-from-left-2 ${
                    conv.id === activeConversation 
                      ? 'bg-surface-elevated/80 border-l-[3px] border-l-accent shadow-surface-low' 
                      : 'hover:bg-surface-elevated/50'
                  }`}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    borderRadius: 'var(--radius-md)'
                  }}
                  onClick={() => setActiveConversation(conv.id)}
                  role="button"
                  aria-pressed={conv.id === activeConversation}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveConversation(conv.id)
                    }
                  }}
                >
                  {/* Barre d'accent fine sur sélection */}
                  {conv.id === activeConversation && (
                    <div className="absolute inset-y-0 left-0 w-0.5 bg-accent rounded-r-full animate-in slide-in-from-left duration-300" />
                  )}
                  
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex-1 min-w-0 pr-3">
                      {/* Titre sur une ligne, ellipsé proprement */}
                      <h4 className="font-medium text-sm text-foreground leading-tight mb-1 truncate transition-colors duration-200 group-hover:text-accent">
                        {conv.title}
                      </h4>
                      
                      {/* Méta en teinte subtile */}
                      <div className="flex items-center gap-1.5 text-[11px] text-text-subtle">
                        <span className="tabular-nums">
                          {formatRelativeTime(conv.updated_at)}
                        </span>
                        <span className="w-1 h-1 bg-text-subtle/40 rounded-full" />
                        <span className="tabular-nums">
                          {conv.message_count} msg{conv.message_count > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions compactes */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Badge de statut ultra-minimaliste */}
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        conv.id === activeConversation 
                          ? 'bg-accent shadow-glow-accent' 
                          : 'bg-text-subtle/30 group-hover:bg-accent/60'
                      }`} />
                      
                      {/* Menu d'actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 hover:bg-surface-elevated/80 hover:scale-105"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-3 h-3 text-text-subtle hover:text-foreground transition-colors" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 border-border/50 bg-surface-elevated shadow-surface-medium">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedConversation(conv)
                              setRenameTitle(conv.title)
                              setShowRenameDialog(true)
                            }}
                            className="text-xs hover:bg-surface-elevated/80"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-2 text-text-subtle" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedConversation(conv)
                              setShowDeleteDialog(true)
                            }}
                            className="text-xs text-status-error hover:bg-status-error/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  // Right Pane: Premium Chat Interface  
  const rightPane = (
    <div className="flex flex-col h-full">
      {/* Chat Messages - Premium Layout */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
          {loadingMessages ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div 
                  key={i} 
                  className="animate-in fade-in duration-500"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <ChatBubble
                    type={i % 2 === 0 ? 'assistant' : 'user'}
                    content=""
                    timestamp={new Date().toISOString()}
                    sources={[]}
                    isStreaming={false}
                  />
                </div>
              ))}
            </div>
          ) : !activeConversation ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-surface-elevated/60 border border-border/30 rounded-2xl mx-auto flex items-center justify-center animate-in zoom-in duration-500 delay-200">
                  <Bot className="w-8 h-8 text-accent/80 animate-pulse" />
                </div>
                <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-400">
                  <p className="text-base font-medium text-foreground">Sélectionnez une conversation pour commencer</p>
                  <p className="text-sm text-text-subtle max-w-xs mx-auto leading-relaxed">
                    Ou créez une nouvelle conversation en posant votre première question
                  </p>
                </div>
                <Button
                  onClick={handleCreateConversation}
                  className="animate-in slide-in-from-bottom-2 duration-500 delay-600 bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle conversation
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6" role="log" aria-label="Messages de la conversation" aria-live="polite">
            {/* Message de bienvenue premium */}
            {messages.length === 0 && !chat.isStreaming && (
              <div className="animate-in fade-in duration-500" role="article">
                <ChatBubble
                  type="assistant"
                  content="Bonjour ! Je suis votre assistant IA privé. Comment puis-je vous aider aujourd'hui ?"
                  timestamp={new Date().toISOString()}
                  sources={[]}
                  isStreaming={false}
                />
              </div>
            )}
            
            {/* Messages de conversation */}
            {messages.map((msg, index) => {
              const isLastAssistantMessage = msg.type === 'assistant' && 
                index === messages.findLastIndex(m => m.type === 'assistant')
              
              // Convertir les citations pour les sources
              const sources = msg.type === 'assistant' && msg.metadata?.citations ? 
                msg.metadata.citations.map(citation => ({
                  docId: citation.document_id,
                  title: citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 8)}...`,
                  chunks: [citation.chunk_index]
                })) : []
              
              return (
                <div 
                  key={msg.id} 
                  className="animate-in fade-in slide-in-from-bottom-2 duration-400"
                  style={{ animationDelay: `${index * 100}ms` }}
                  role="article"
                >
                  <ChatBubble
                    type={msg.type}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    sources={sources}
                    isStreaming={false}
                  />
                </div>
              )
            })}
            
            {/* Message en cours de génération */}
            {chat.isStreaming && (
              <div className="animate-in fade-in duration-300">
                <ChatBubble
                  type="assistant"
                  content={chat.streamingContent || ''}
                  timestamp={new Date().toISOString()}
                  sources={[]}
                  isStreaming={true}
                />
              </div>
            )}
            
            <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Compositeur premium avec design épuré */}
      <div className="border-t border-border/20 bg-surface-elevated/60 backdrop-blur-xl p-4 lg:p-6">
        <div className="max-w-[820px] mx-auto">
          {/* Zone de saisie principale */}
          <div className="relative group">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                {/* Input premium avec focus sophistiqué */}
                <div className="relative">
                  <Input
                    placeholder={activeConversation ? "Posez votre question..." : "Posez votre première question pour commencer..."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        if (chat.isStreaming) {
                          chat.stop()
                        } else {
                          handleSendMessage()
                        }
                      }
                    }}
                    className="
                      min-h-[52px] pr-20 
                      bg-background/95 border-border/30 
                      rounded-xl text-sm leading-relaxed
                      focus:border-accent/60 focus:ring-accent/20 focus:ring-2 focus:bg-background 
                      transition-all duration-200
                      placeholder:text-text-subtle/60 
                      shadow-surface-low backdrop-blur-sm 
                      resize-none
                    "
                    disabled={chat.isStreaming}
                    aria-label="Zone de saisie pour votre question"
                    aria-describedby="composer-help"
                    autoComplete="off"
                    spellCheck="true"
                  />
                  
                  {/* Raccourci clavier moderne */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className="text-[10px] text-text-subtle/50 font-mono bg-surface-elevated/60 border border-border/20 rounded px-1.5 py-0.5 backdrop-blur-sm">
                      ⏎ Envoyer
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bouton d'action principal */}
              {chat.isStreaming ? (
                <Button 
                  onClick={chat.stop} 
                  variant="destructive"
                  size="default"
                  className="
                    h-[52px] px-4 rounded-xl 
                    focus:ring-2 focus:ring-status-error/20 focus:ring-offset-2 
                    shadow-surface-low transition-all duration-200 
                    hover:shadow-surface-medium
                  "
                  aria-label="Arrêter la génération de la réponse"
                >
                  <Square className="w-4 h-4" />
                  <span className="ml-2 hidden sm:inline font-medium">Arrêter</span>
                </Button>
              ) : (
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!message.trim()}
                  className="
                    h-[52px] px-4 rounded-xl 
                    bg-accent hover:bg-accent/90 text-accent-foreground
                    disabled:opacity-40 disabled:cursor-not-allowed
                    focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 
                    shadow-surface-low transition-all duration-200 
                    hover:shadow-surface-medium hover:scale-[1.02]
                    active:scale-[0.98]
                  "
                  aria-label="Envoyer le message"
                >
                  <Send className="w-4 h-4" />
                  <span className="ml-2 hidden sm:inline font-medium">Envoyer</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Barre d'informations et actions secondaires */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            {/* Status et aide */}
            <div className="flex items-center gap-3">
              <p 
                id="composer-help" 
                className="text-xs text-text-subtle leading-relaxed"
                role="status"
                aria-live="polite"
              >
                {chat.isStreaming 
                  ? (
                    <span className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                      Assistant génère sa réponse...
                    </span>
                  ) : activeConversation
                    ? "Continuez votre conversation ou créez-en une nouvelle"
                    : "Votre première question créera automatiquement une nouvelle conversation"
                }
              </p>
              
              {/* Indicateur de tokens si usage élevé */}
              {limits.tokensUsed / limits.tokensLimit >= 0.8 && (
                <div className="flex items-center gap-1.5 text-xs text-status-warning bg-status-warning/10 border border-status-warning/20 rounded-lg px-2 py-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-medium">Quota bientôt atteint</span>
                </div>
              )}
            </div>
            
            {/* Actions secondaires */}
            <div className="flex items-center gap-2">
              {/* Bouton citations si disponibles */}
              {chat.citations.length > 0 && citationsEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCitationsPanel(true)}
                  className="h-7 text-xs bg-surface-elevated/50 border-border/40 hover:bg-surface-elevated hover:border-border/60 focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                  aria-label={`Voir les ${chat.citations.length} source${chat.citations.length > 1 ? 's' : ''} utilisée${chat.citations.length > 1 ? 's' : ''}`}
                >
                  <FileText className="w-3 h-3 mr-1.5" />
                  <span className="hidden xs:inline">
                    {chat.citations.length} source{chat.citations.length > 1 ? 's' : ''}
                  </span>
                  <span className="xs:hidden">{chat.citations.length}</span>
                </Button>
              )}
              
              {/* Toggle rapide pour les paramètres */}
              <div className="flex items-center gap-1">
                <Button
                  variant={citationsEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCitationsEnabled(!citationsEnabled)}
                  className="h-7 px-2.5 text-xs transition-all duration-200"
                  title="Activer/désactiver les citations"
                >
                  <FileText className="w-3 h-3" />
                </Button>
                <Button
                  variant={quickMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (organization?.tier === 'starter') {
                      openLocked('fast_mode')
                    } else {
                      setQuickMode(!quickMode)
                    }
                  }}
                  className="h-7 px-2.5 text-xs transition-all duration-200"
                  disabled={false}
                  title="Mode rapide (premium)"
                >
                  <Zap className="w-3 h-3" />
                  {organization?.tier === 'starter' && <span className="ml-1 text-[10px]">🔒</span>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <LayoutShell>
      <MainContent className="h-[calc(100vh-8rem)] flex flex-col">
        {/* === EN-TÊTE PREMIUM MINIMALISTE === */}
        <header 
          className="
            border-b border-border/40 bg-card/50 backdrop-blur-md
            px-6 py-3 flex-shrink-0
            transition-all duration-200
          "
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
            
            {/* PARTIE GAUCHE: Titre + Statut discret */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-foreground tracking-tight">
                  Assistant IA
                </h1>
                {/* Statut ultra-discret */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div 
                    className="w-1.5 h-1.5 rounded-full bg-green-500"
                    style={{ boxShadow: '0 0 4px rgb(34 197 94 / 0.4)' }}
                  />
                  <span className="font-medium">En ligne</span>
                  <span className="hidden sm:inline">• Analyse de vos documents</span>
                  {showUsageWarning && (
                    <Badge 
                      variant="outline" 
                      className="
                        text-xs border-warning-500/20 text-warning-600 bg-warning-50/50
                        px-2 py-0.5 h-5 font-medium
                      "
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Quota atteint
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* PARTIE CENTRE: Recherche globale (optionnelle pour futur) */}
            <div className="hidden lg:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les conversations..."
                  className="
                    pl-10 h-9 bg-background/60 border-border/50
                    focus:border-accent-400 focus:ring-2 focus:ring-accent-200
                    text-sm placeholder:text-muted-foreground/70
                    transition-all duration-200
                  "
                  style={{ 
                    borderRadius: 'var(--radius-sm)',
                    backdropFilter: 'blur(8px)'
                  }}
                />
              </div>
            </div>

            {/* PARTIE DROITE: Actions compactes premium */}
            <div className="flex items-center gap-3">
              
              {/* Groupe d'options principales */}
              <div 
                className="flex items-center bg-muted/50 rounded-lg p-1 gap-1"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <Button
                  variant={citationsEnabled ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCitationsEnabled(!citationsEnabled)}
                  className="
                    h-7 px-3 text-xs font-medium
                    transition-all duration-200
                    data-[state=on]:bg-accent-500 data-[state=on]:text-white
                  "
                  style={{ borderRadius: 'var(--radius-xs)' }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1.5">Citations</span>
                </Button>
                
                <Button
                  variant={quickMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (organization?.tier === 'starter') {
                      openLocked('fast_mode')
                    } else {
                      setQuickMode(!quickMode)
                    }
                  }}
                  className="
                    h-7 px-3 text-xs font-medium
                    transition-all duration-200
                    data-[state=on]:bg-accent-500 data-[state=on]:text-white
                  "
                  style={{ borderRadius: 'var(--radius-xs)' }}
                  disabled={false}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1.5">Rapide</span>
                  {organization?.tier === 'starter' && (
                    <span className="ml-1 text-xs opacity-60">🔒</span>
                  )}
                </Button>
              </div>

              {/* Action secondaire: Sources */}
              {chat.citations.length > 0 && citationsEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCitationsSidePanel(!showCitationsSidePanel)}
                  className="
                    h-8 px-3 text-xs font-medium border-border/60
                    bg-background/50 hover:bg-accent-50
                    transition-all duration-200
                  "
                  style={{ borderRadius: 'var(--radius-xs)' }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sources</span>
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-4 px-1.5 text-xs bg-accent-100 text-accent-700"
                    style={{ borderRadius: 'var(--radius-xs)' }}
                  >
                    {chat.citations.length}
                  </Badge>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* === GRILLE PREMIUM TRI-COLONNE === */}
        <div className="flex-1 flex bg-background overflow-hidden relative">
          
          {/* Mobile Overlay pour conversations */}
          {showMobileConversations && (
            <div 
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowMobileConversations(false)}
            />
          )}

          {/* COLONNE GAUCHE: CONVERSATIONS */}
          <aside 
            className={`
              flex-shrink-0 bg-card border-r border-border/40 
              transition-all duration-300 ease-out z-50
              ${showCitationsSidePanel 
                ? 'hidden xl:flex' 
                : 'hidden lg:flex'
              }
              ${showMobileConversations 
                ? 'fixed inset-y-0 left-0 flex lg:relative lg:inset-auto' 
                : ''
              }
            `}
            style={{ 
              width: 'var(--sidebar-width-conversations)',
              boxShadow: showMobileConversations ? 'var(--shadow-xl)' : 'none'
            }}
            role="complementary"
            aria-label="Liste des conversations"
          >
            {leftPane}
          </aside>

          {/* COLONNE CENTRE: MESSAGES (HÉROS) */}
          <main 
            className="flex-1 flex flex-col min-w-0 bg-background"
            role="main"
            aria-label="Zone de conversation principale"
          >
            {/* Bouton mobile pour conversations */}
            <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border/40 bg-card/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobileConversations(!showMobileConversations)}
                className="h-8 px-3 border-border/60 bg-background/50"
              >
                <Menu className="w-4 h-4 mr-2" />
                <span className="text-sm">Conversations</span>
              </Button>
              
              {/* Titre conversation active sur mobile */}
              {activeConversation && (
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-medium truncate text-foreground">
                    {conversations.find(c => c.id === activeConversation)?.title || 'Conversation'}
                  </h1>
                </div>
              )}
            </div>

            {/* Container de largeur de lecture optimale - JAMAIS PLEIN ÉCRAN */}
            <div 
              className="flex-1 flex flex-col mx-auto w-full px-4 lg:px-6"
              style={{ 
                maxWidth: 'var(--content-width-reading)',
                // Padding intelligent selon la présence des sidebars
                paddingLeft: showCitationsSidePanel ? 'var(--space-4)' : 'var(--space-6)',
                paddingRight: showCitationsSidePanel ? 'var(--space-4)' : 'var(--space-6)'
              }}
            >
              {rightPane}
            </div>
          </main>

          {/* COLONNE DROITE: SOURCES/CITATIONS */}
          {showCitationsSidePanel && chat.citations.length > 0 && (
            <aside 
              className="
                flex-shrink-0 bg-card border-l border-border/40
                hidden lg:flex
                transition-all duration-300 ease-out
              "
              style={{ 
                width: 'var(--sidebar-width-sources)',
                boxShadow: 'var(--shadow-sm)'
              }}
              role="complementary"
              aria-label="Sources et citations"
            >
              {citationsPanel}
            </aside>
          )}

          {/* Sources mobile - Modal drawer */}
          <Sheet open={showCitationsPanel} onOpenChange={setShowCitationsPanel}>
            <SheetContent side="right" className="w-[90vw] sm:w-[400px] lg:hidden">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Sources ({chat.citations.length})
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                {citationsPanel}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Modal Citations modernisée et premium */}
        <Dialog open={showCitationsPanel} onOpenChange={setShowCitationsPanel}>
          <DialogContent className="max-w-4xl max-h-[85vh] bg-surface-elevated/95 backdrop-blur-xl border-border/50">
            <DialogHeader className="pb-4 border-b border-border/30">
              <DialogTitle className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-accent" />
                </div>
                <span className="text-lg font-semibold">Sources et Citations</span>
                <div className="w-6 h-6 rounded-full bg-surface-elevated border border-border/40 flex items-center justify-center ml-2">
                  <span className="text-xs font-bold text-text-subtle">
                    {chat.citations.length}
                  </span>
                </div>
              </DialogTitle>
              <DialogDescription className="text-sm text-text-subtle leading-relaxed">
                Documents utilisés pour générer la réponse avec scores de pertinence détaillés
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="grid gap-4">
                {chat.citations.map((citation, idx) => (
                  <div 
                    key={idx} 
                    className="border border-border/40 rounded-xl p-5 bg-background/60 hover:bg-surface-elevated/60 transition-all duration-300 hover:shadow-surface-medium backdrop-blur-sm animate-in fade-in duration-300"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Numéro et indicateur */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-2">
                          <span className="text-sm font-bold text-accent">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-surface-elevated/80 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-1000"
                            style={{ width: `${citation.score * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* En-tête avec titre et score */}
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-semibold text-base text-foreground leading-tight pr-4">
                            {citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 12)}...`}
                          </h4>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-2xl font-bold text-accent tabular-nums">
                              {Math.round(citation.score * 100)}%
                            </div>
                            <div className="text-xs text-text-subtle mt-1">
                              Score de pertinence
                            </div>
                          </div>
                        </div>
                        
                        {/* Métadonnées enrichies en grille */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                          <div className="bg-surface-elevated/60 rounded-lg p-3 border border-border/30">
                            <p className="text-xs font-medium text-text-subtle mb-1.5">Localisation</p>
                            <div className="flex items-center gap-1.5 text-sm text-foreground">
                              <span className="font-medium">Section {citation.chunk_index}</span>
                              {citation.page && (
                                <>
                                  <span className="text-text-subtle">•</span>
                                  <span>Page {citation.page}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {citation.section && citation.section !== 'main' && (
                            <div className="bg-surface-elevated/60 rounded-lg p-3 border border-border/30">
                              <p className="text-xs font-medium text-text-subtle mb-1.5">Section</p>
                              <p className="text-sm text-foreground font-medium truncate">
                                {citation.section}
                              </p>
                            </div>
                          )}
                          
                          <div className="bg-surface-elevated/60 rounded-lg p-3 border border-border/30">
                            <p className="text-xs font-medium text-text-subtle mb-1.5">Qualité</p>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                citation.score >= 0.8 ? 'bg-status-success' :
                                citation.score >= 0.6 ? 'bg-status-warning' : 
                                'bg-status-error'
                              }`} />
                              <span className="text-sm font-medium">
                                {citation.score >= 0.8 ? 'Excellente' :
                                 citation.score >= 0.6 ? 'Bonne' : 'Modérée'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* ID technique (repliable) */}
                        <details className="group">
                          <summary className="text-xs text-text-subtle cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                            <span>Informations techniques</span>
                            <div className="w-3 h-3 text-text-subtle/60 group-open:rotate-90 transition-transform">▶</div>
                          </summary>
                          <div className="mt-2 p-3 bg-surface-elevated/50 rounded-lg border border-border/20">
                            <div className="text-xs font-mono text-text-subtle break-all">
                              <span className="text-foreground font-medium">ID:</span> {citation.document_id}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <p className="text-sm text-text-subtle">
                Sources classées par pertinence décroissante
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCitationsSidePanel(true)}
                  className="h-8 px-3 text-xs border-border/40 hover:border-border/60"
                >
                  Épingler le panel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowCitationsPanel(false)}
                  className="h-8 px-3 text-xs"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog modernisé */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="max-w-md bg-surface-elevated/95 backdrop-blur-xl border-border/50">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Edit2 className="w-5 h-5 text-accent" />
                Renommer la conversation
              </DialogTitle>
              <DialogDescription className="text-sm text-text-subtle">
                Donnez un nouveau nom à cette conversation pour mieux la retrouver
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="Nouveau titre..."
                className="bg-background/80 border-border/50 focus:border-accent/60 focus:ring-accent/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameConversation()
                  }
                  if (e.key === "Escape") {
                    setShowRenameDialog(false)
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter className="pt-4 border-t border-border/30">
              <Button 
                variant="outline" 
                onClick={() => setShowRenameDialog(false)}
                className="h-9 px-4 border-border/40 hover:border-border/60"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleRenameConversation}
                disabled={!renameTitle.trim()}
                className="h-9 px-4 bg-accent hover:bg-accent/90 disabled:opacity-40"
              >
                Renommer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation modernisé */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="max-w-md bg-surface-elevated/95 backdrop-blur-xl border-border/50">
            <AlertDialogHeader className="pb-4">
              <AlertDialogTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="w-5 h-5 text-status-error" />
                Supprimer la conversation
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-text-subtle leading-relaxed">
                Êtes-vous sûr de vouloir supprimer la conversation <strong>"{selectedConversation?.title}"</strong> ?
                <br />
                <br />
                Cette action est irréversible et supprimera tous les messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-4 border-t border-border/30">
              <AlertDialogCancel className="h-9 px-4 border-border/40 hover:border-border/60">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConversation}
                className="h-9 px-4 bg-status-error hover:bg-status-error/90 text-white"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainContent>
    </LayoutShell>
  )
}

export default function AssistantPage() {
  return <AssistantContent />
}