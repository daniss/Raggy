"use client"

import { useState, useEffect, useRef } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Menu, FileText, Edit2, Trash2 } from "lucide-react"
import { useLimits } from "@/lib/hooks/use-limits"
import { useFeatureGating } from "@/lib/hooks/use-feature-gating"
import { useApp } from "@/contexts/app-context"
import { ConversationsAPI, type Conversation, type Message } from "@/lib/api/conversations"
import { useChat, type ChatOptions } from "@/lib/hooks/use-chat"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/i18n/translations"

// Import new components
import {
  AssistantHeader,
  ConversationsSidebar,
  ChatTranscript,
  MessageComposer,
  CitationsPanel
} from "@/components/assistant"

function AssistantContent() {
  // State management
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
  
  // Modal states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [showCitationsPanel, setShowCitationsPanel] = useState(false)
  const [showCitationsSidePanel, setShowCitationsSidePanel] = useState(false)
  const [showMobileConversations, setShowMobileConversations] = useState(false)
  
  // Conversation management
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  
  // Hooks
  const limits = useLimits()
  const { openLocked } = useFeatureGating()
  const { organization } = useApp()
  const { toast } = useToast()
  const t = useI18n()

  const chat = useChat({
    orgId: organization?.id || '',
    onError: (error) => {
      toast({
        title: t.assistant.error,
        description: error,
        variant: 'destructive'
      })
    },
    onSuccess: (assistantContent?: string) => {
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
      loadConversations()
    }
  })

  // Load conversations
  const loadConversations = async () => {
    if (!organization?.id) return
    
    try {
      setLoadingConversations(true)
      const response = await ConversationsAPI.getConversations(organization.id)
      setConversations(response.conversations)
      
      if (response.conversations.length > 0 && !activeConversation) {
        setActiveConversation(response.conversations[0].id)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast({
        title: t.assistant.error,
        description: t.assistant.failed_load_conversations,
        variant: 'destructive'
      })
    } finally {
      setLoadingConversations(false)
    }
  }

  // Load messages
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
        title: t.assistant.error,
        description: t.assistant.failed_load_messages,
        variant: 'destructive'
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  // Filter conversations
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

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [organization?.id])

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversation && activeConversation !== loadedConversationId) {
      setShouldAutoScroll(false)
      loadMessages()
    } else if (!activeConversation) {
      setMessages([])
      setLoadedConversationId(null)
      setShouldAutoScroll(false)
    }
  }, [activeConversation])

  // Handlers
  const handleCreateConversation = () => {
    if (chat.isStreaming) {
      chat.stop()
    }
    setActiveConversation(null)
    setMessages([])
    setLoadedConversationId(null)
    setLastUserMessage("")
  }

  const handleSendMessage = async () => {
    if (!message.trim() || chat.isStreaming || !organization?.id) return

    const messageContent = message.trim()
    setMessage("")
    setLastUserMessage(messageContent)
    setShouldAutoScroll(true)
    
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
        setActiveConversation(newConversationId)
        setLoadedConversationId(newConversationId)
        loadConversations()
      }
      
      if (citationsEnabled && chat.citations.length > 0) {
        setShowCitationsSidePanel(true)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    }
  }

  const handleRegenerate = async () => {
    if (!lastUserMessage || chat.isStreaming || !organization?.id) return
    
    const options: ChatOptions = {
      citations: citationsEnabled,
      fast_mode: quickMode
    }
    
    await chat.regenerate(lastUserMessage, options, activeConversation)
  }

  const handleRenameConversation = async () => {
    if (!selectedConversation || !renameTitle.trim()) return
    
    try {
      await ConversationsAPI.updateConversation(selectedConversation.id, {
        title: renameTitle.trim()
      })
      
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
        title: t.assistant.conversation_renamed,
        description: t.assistant.conversation_renamed_sub
      })
    } catch (error) {
      console.error('Failed to rename conversation:', error)
      toast({
        title: t.assistant.error,
        description: t.assistant.failed_rename,
        variant: 'destructive'
      })
    }
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return
    
    try {
      await ConversationsAPI.deleteConversation(selectedConversation.id)
      
      setConversations(prev => prev.filter(conv => conv.id !== selectedConversation.id))
      
      if (activeConversation === selectedConversation.id) {
        setActiveConversation(null)
        setMessages([])
      }
      
      setShowDeleteDialog(false)
      setSelectedConversation(null)
      
      toast({
        title: t.assistant.conversation_deleted,
        description: t.assistant.conversation_deleted_sub
      })
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast({
        title: t.assistant.error,
        description: t.assistant.failed_delete,
        variant: 'destructive'
      })
    }
  }

  const tokensRatio = limits.tokensUsed / limits.tokensLimit
  const showUsageWarning = tokensRatio >= 0.8

  return (
    <LayoutShell>
      <MainContent className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Modern Header */}
        <AssistantHeader
          citationsEnabled={citationsEnabled}
          setCitationsEnabled={setCitationsEnabled}
          quickMode={quickMode}
          setQuickMode={setQuickMode}
          citationsCount={chat.citations.length}
          showCitationsSidePanel={showCitationsSidePanel}
          setShowCitationsSidePanel={setShowCitationsSidePanel}
          showUsageWarning={showUsageWarning}
          organizationTier={organization?.tier}
          onOpenLocked={openLocked}
        />

        {/* Main Layout */}
        <div className="flex-1 flex bg-background overflow-hidden relative">
          
          {/* Mobile Overlay */}
          {showMobileConversations && (
            <div 
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowMobileConversations(false)}
            />
          )}

          {/* Left Sidebar: Conversations */}
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
              width: '320px',
              boxShadow: showMobileConversations ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)' : 'none'
            }}
            role="complementary"
            aria-label="Conversations list"
          >
            <ConversationsSidebar
              conversations={conversations}
              filteredConversations={filteredConversations}
              activeConversation={activeConversation}
              conversationSearch={conversationSearch}
              setConversationSearch={setConversationSearch}
              setActiveConversation={setActiveConversation}
              onCreateConversation={handleCreateConversation}
              onRenameConversation={(conv) => {
                setSelectedConversation(conv)
                setRenameTitle(conv.title)
                setShowRenameDialog(true)
              }}
              onDeleteConversation={(conv) => {
                setSelectedConversation(conv)
                setShowDeleteDialog(true)
              }}
              loadingConversations={loadingConversations}
            />
          </aside>

          {/* Center: Chat Area */}
          <main 
            className="flex-1 flex flex-col min-w-0 bg-background"
            role="main"
            aria-label="Main conversation area"
          >
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border/40 bg-card/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobileConversations(!showMobileConversations)}
                className="h-8 px-3 border-border/60 bg-background/50"
              >
                <Menu className="w-4 h-4 mr-2" />
                <span className="text-sm">{t.nav.conversations}</span>
              </Button>
              
              {activeConversation && (
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-medium truncate text-foreground">
                    {conversations.find(c => c.id === activeConversation)?.title || 'Conversation'}
                  </h1>
                </div>
              )}
            </div>

            {/* Chat Transcript */}
            <ChatTranscript
              messages={messages}
              streamingContent={chat.streamingContent}
              isStreaming={chat.isStreaming}
              activeConversation={activeConversation}
              loadingMessages={loadingMessages}
              onCreateConversation={handleCreateConversation}
              onRegenerateResponse={handleRegenerate}
            />

            {/* Message Composer */}
            <MessageComposer
              message={message}
              setMessage={setMessage}
              onSendMessage={handleSendMessage}
              onStopGeneration={chat.stop}
              isStreaming={chat.isStreaming}
              activeConversation={activeConversation}
              citationsEnabled={citationsEnabled}
              setCitationsEnabled={setCitationsEnabled}
              quickMode={quickMode}
              setQuickMode={setQuickMode}
              citationsCount={chat.citations.length}
              onShowCitations={() => setShowCitationsPanel(true)}
              showUsageWarning={showUsageWarning}
              organizationTier={organization?.tier}
              onOpenLocked={openLocked}
            />
          </main>

          {/* Right Sidebar: Citations */}
          {showCitationsSidePanel && chat.citations.length > 0 && (
            <aside 
              className="
                flex-shrink-0 bg-card border-l border-border/40
                hidden lg:flex
                transition-all duration-300 ease-out
              "
              style={{ 
                width: '280px',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
              }}
              role="complementary"
              aria-label="Sources and citations"
            >
              <CitationsPanel
                citations={chat.citations}
                onClose={() => setShowCitationsSidePanel(false)}
                onShowDetails={() => setShowCitationsPanel(true)}
              />
            </aside>
          )}

          {/* Mobile Citations Sheet */}
          <Sheet open={showCitationsPanel} onOpenChange={setShowCitationsPanel}>
            <SheetContent side="right" className="w-[90vw] sm:w-[400px] lg:hidden">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  {t.assistant.sources} ({chat.citations.length})
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <CitationsPanel
                  citations={chat.citations}
                  onClose={() => setShowCitationsPanel(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="max-w-md bg-surface-elevated/95 backdrop-blur-xl border-border/50">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Edit2 className="w-5 h-5 text-accent" />
                {t.assistant.rename_conversation}
              </DialogTitle>
              <DialogDescription className="text-sm text-text-subtle">
                {t.assistant.rename_conversation_sub}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder={t.assistant.new_title_placeholder}
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
                {t.assistant.cancel}
              </Button>
              <Button 
                onClick={handleRenameConversation}
                disabled={!renameTitle.trim()}
                className="h-9 px-4 bg-accent hover:bg-accent/90 disabled:opacity-40"
              >
                {t.assistant.rename}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="max-w-md bg-surface-elevated/95 backdrop-blur-xl border-border/50">
            <AlertDialogHeader className="pb-4">
              <AlertDialogTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="w-5 h-5 text-status-error" />
                {t.assistant.delete_conversation}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-text-subtle leading-relaxed">
                {t.assistant.delete_conversation_sub.replace('{title}', selectedConversation?.title || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-4 border-t border-border/30">
              <AlertDialogCancel className="h-9 px-4 border-border/40 hover:border-border/60">
                {t.assistant.cancel}
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConversation}
                className="h-9 px-4 bg-status-error hover:bg-status-error/90 text-white"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                {t.assistant.delete}
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