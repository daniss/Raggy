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
import { useLimits } from "@/lib/hooks/use-limits"
import { useFeatureGating } from "@/lib/hooks/use-feature-gating"
import { useApp } from "@/contexts/app-context"
import { ConversationsAPI, type Conversation, type Message } from "@/lib/api/conversations"
import { useChat, type ChatOptions } from "@/lib/hooks/use-chat"
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/utils/time"
import { Send, Bot, User, Plus, Clock, Zap, FileText, AlertTriangle, Loader2, Square, RotateCcw, MoreHorizontal, Edit2, Trash2, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

function AssistantContent() {
  const [message, setMessage] = useState("")
  const [quickMode, setQuickMode] = useState(false)
  const [citationsEnabled, setCitationsEnabled] = useState(true)
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [showCitationsPanel, setShowCitationsPanel] = useState(false)
  const [showCitationsSidePanel, setShowCitationsSidePanel] = useState(false)
  const [lastUserMessage, setLastUserMessage] = useState("")
  
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
      loadMessages()
    } else if (!activeConversation) {
      setMessages([])
      setLoadedConversationId(null)
    }
  }, [activeConversation])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chat.streamingContent])

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

  // Citations Panel
  const citationsPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Sources et Citations</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCitationsSidePanel(false)}
          className="h-6 w-6 p-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {chat.citations.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Aucune source disponible</p>
            <p className="text-xs mt-1">Les sources apparaîtront après une réponse avec citations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chat.citations.map((citation, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm line-clamp-2">{citation.title}</h4>
                  <Badge variant="outline" className="text-xs ml-2 shrink-0">
                    {Math.round(citation.score * 100)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  {citation.spans.slice(0, 2).map((span, spanIdx) => (
                    <div key={spanIdx} className="bg-blue-50 rounded p-2 text-xs">
                      <p className="text-gray-700 leading-relaxed">"{span.snippet}"</p>
                      <p className="text-gray-500 mt-1 text-[10px]">
                        Position: {span.from}-{span.to}
                      </p>
                    </div>
                  ))}
                  {citation.spans.length > 2 && (
                    <p className="text-xs text-gray-500">
                      +{citation.spans.length - 2} autres extraits
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {chat.citations.length} source{chat.citations.length > 1 ? 's' : ''} trouvée{chat.citations.length > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )

  // Left Pane: Conversations List
  const leftPane = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <Button size="sm" onClick={handleCreateConversation} disabled={loadingConversations}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <p>Aucune conversation</p>
                <p className="text-xs mt-1">Créez votre première conversation</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item cursor-pointer relative group ${conv.id === activeConversation ? 'active' : ''}`}
                  onClick={() => setActiveConversation(conv.id)}
                  role="button"
                  aria-pressed={conv.id === activeConversation}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-medium text-sm truncate">{conv.title}</h4>
                      <p className="text-[11px] text-muted mt-1">{formatRelativeTime(conv.updated_at)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {conv.message_count}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedConversation(conv)
                              setRenameTitle(conv.title)
                              setShowRenameDialog(true)
                            }}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedConversation(conv)
                              setShowDeleteDialog(true)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
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

  // Right Pane: Chat Interface  
  const rightPane = (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !activeConversation ? (
            <div className="flex items-center justify-center h-full text-center text-muted">
              <div>
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Sélectionnez une conversation pour commencer</p>
                <p className="text-xs mt-1">ou créez une nouvelle conversation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4" role="log" aria-label="Messages de la conversation">
            {messages.length === 0 && !chat.isStreaming && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[70%]">
                  <div className="rounded-lg p-3 bg-gray-100 text-gray-900">
                    <p className="text-sm">Bonjour ! Je suis votre assistant IA privé. Comment puis-je vous aider aujourd'hui ?</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-muted">Maintenant</span>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((msg, index) => {
              const isLastAssistantMessage = msg.type === 'assistant' && 
                index === messages.findLastIndex(m => m.type === 'assistant')
              
              return (
                <div key={msg.id} className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.type === "assistant" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[70%] ${msg.type === "user" ? "order-first" : ""}`}>
                    <div
                      className={`rounded-lg p-3 ${
                        msg.type === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.citations && msg.metadata.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Sources:</p>
                          <div className="space-y-1">
                            {msg.metadata.citations.slice(0, 2).map((citation, idx) => (
                              <div key={idx} className="text-xs bg-gray-50 rounded px-2 py-1">
                                <span className="font-medium">{citation.title}</span>
                                <span className="text-gray-400 ml-1">({Math.round(citation.score * 100)}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span 
                          className="text-[11px] text-muted cursor-help"
                          title={formatAbsoluteTime(msg.timestamp)}
                        >
                          {formatRelativeTime(msg.timestamp)}
                        </span>
                      </div>
                      {isLastAssistantMessage && !chat.isStreaming && lastUserMessage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRegenerate}
                          className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Regénérer
                        </Button>
                      )}
                    </div>
                  </div>
                  {msg.type === "user" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })}
            
            {/* Streaming message */}
            {chat.isStreaming && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[70%]">
                  <div className="rounded-lg p-3 bg-gray-100 text-gray-900">
                    {chat.streamingContent ? (
                      <p className="text-sm whitespace-pre-wrap">{chat.streamingContent}<span className="animate-pulse">|</span></p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-gray-500">Assistant réfléchit...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1" role="progressbar" aria-label="Réponse en cours">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-muted">En cours...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t pt-4 px-4">
        <div className="flex gap-2">
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
            className="flex-1"
            disabled={false}
            aria-label="Zone de saisie question"
          />
          {chat.isStreaming ? (
            <Button 
              onClick={chat.stop} 
              variant="destructive"
              aria-label="Arrêter la génération"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSendMessage} 
              disabled={!message.trim()}
              aria-label="Envoyer le message"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted">
            {chat.isStreaming 
              ? "Assistant génère sa réponse..." 
              : activeConversation
                ? "Continuez votre conversation ou créez-en une nouvelle"
                : "Votre première question créera automatiquement une nouvelle conversation"
            }
          </p>
          {chat.citations.length > 0 && citationsEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCitationsPanel(true)}
              className="h-6 text-xs"
            >
              <FileText className="w-3 h-3 mr-1" />
              {chat.citations.length} source{chat.citations.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <LayoutShell>
      <MainContent className="h-[calc(100vh-8rem)]">
        <PageHeader 
          title="Assistant IA Privé"
          subtitle={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                En ligne • Analyse de vos documents
              </span>
              {showUsageWarning && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Quota atteint
                </Badge>
              )}
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-100 rounded-md p-1">
              <Button
                variant={citationsEnabled ? "default" : "ghost"}
                size="sm"
                onClick={() => setCitationsEnabled(!citationsEnabled)}
                className="h-7 px-2 text-xs"
              >
                <FileText className="w-3 h-3 mr-1" />
                Citations
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
                className="h-7 px-2 text-xs"
                disabled={false}
              >
                <Zap className="w-3 h-3 mr-1" />
                Mode Rapide
                {organization?.tier === 'starter' && <span className="ml-1">🔒</span>}
              </Button>
            </div>
            {chat.citations.length > 0 && citationsEnabled && (
              <Button
                variant={showCitationsSidePanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCitationsSidePanel(!showCitationsSidePanel)}
                className="h-7 px-3 text-xs"
              >
                <FileText className="w-3 h-3 mr-1" />
                Panel Sources ({chat.citations.length})
              </Button>
            )}
          </div>
        </PageHeader>

        {showCitationsSidePanel && chat.citations.length > 0 ? (
          <div className="flex flex-1 gap-4">
            <div style={{ width: 280 }}>{leftPane}</div>
            <div className="flex-1">{rightPane}</div>
            <div style={{ width: 320 }} className="border-l border-gray-200 pl-4">
              {citationsPanel}
            </div>
          </div>
        ) : (
          <TwoPane 
            leftWidth={280}
            leftPane={leftPane}
            rightPane={rightPane}
            className="flex-1"
          />
        )}

        {/* Citations Panel */}
        <Dialog open={showCitationsPanel} onOpenChange={setShowCitationsPanel}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Sources et Citations</DialogTitle>
              <DialogDescription>
                Documents utilisés pour générer la réponse
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {chat.citations.map((citation, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{citation.title}</h4>
                    <Badge variant="outline">
                      {Math.round(citation.score * 100)}% pertinence
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {citation.spans.map((span, spanIdx) => (
                      <div key={spanIdx} className="bg-gray-50 rounded p-2 text-sm">
                        <p className="text-gray-700">"{span.snippet}"</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Position: {span.from}-{span.to}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renommer la conversation</DialogTitle>
              <DialogDescription>
                Donnez un nouveau nom à cette conversation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="Nouveau titre..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameConversation()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleRenameConversation}
                disabled={!renameTitle.trim()}
              >
                Renommer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la conversation</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer la conversation "{selectedConversation?.title}" ? 
                Cette action est irréversible et supprimera tous les messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConversation}
                className="bg-red-600 hover:bg-red-700"
              >
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