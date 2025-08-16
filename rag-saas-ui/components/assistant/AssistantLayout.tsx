"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/contexts/app-context"
import { ConversationsAPI, type Conversation, type Message } from "@/lib/api/conversations"
import { useChat } from "@/lib/hooks/use-chat"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ConversationsSidebar } from "./ConversationsSidebar"
import { ChatTranscript } from "./ChatTranscript"
import { MessageComposer } from "./MessageComposer"
import { CitationsPanel } from "./CitationsPanel"
import { AssistantHeader } from "./AssistantHeader"
import { KeyboardShortcuts } from "./KeyboardShortcuts"

interface AssistantLayoutProps {
  className?: string
}

export function AssistantLayout({ className }: AssistantLayoutProps) {
  // Core state
  const [message, setMessage] = useState("")
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeCitation, setActiveCitation] = useState<string | null>(null)
  
  // UI state
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  
  // Loading states
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  // Hooks
  const { organization } = useApp()
  const { toast } = useToast()

  const chat = useChat({
    orgId: organization?.id || '',
    onError: (error) => {
      toast({
        title: "Error",
        description: error,
        variant: 'destructive'
      })
    },
    onSuccess: (assistantContent?: string) => {
      if (assistantContent) {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.type === 'assistant') {
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, content: assistantContent }
                : msg
            )
          } else {
            const assistantMessage: Message = {
              id: `assistant-${Date.now()}`,
              type: 'assistant',
              content: assistantContent,
              timestamp: new Date().toISOString()
            }
            return [...prev, assistantMessage]
          }
        })
      }
      loadConversations()
    }
  })

  // Load conversations
  const loadConversations = useCallback(async () => {
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
    } finally {
      setLoadingConversations(false)
    }
  }, [organization?.id, activeConversation])

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!activeConversation) return
    
    try {
      setLoadingMessages(true)
      const msgs = await ConversationsAPI.getMessages(activeConversation)
      setMessages(msgs)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }, [activeConversation])

  // Handle send message
  const handleSendMessage = async () => {
    if (!message.trim() || chat.isStreaming || !organization?.id) return

    const messageContent = message.trim()
    setMessage("")
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    
    const options = {
      citations: true,
      fast_mode: false
    }
    
    try {
      const newConversationId = await chat.send(messageContent, options, activeConversation)
      
      if (newConversationId && !activeConversation) {
        setActiveConversation(newConversationId)
        loadConversations()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    }
  }

  const handleCitationClick = (citationId: string) => {
    setActiveCitation(citationId)
    if (!inspectorOpen) {
      setInspectorOpen(true)
    }
  }

  const handleStopGeneration = () => {
    chat.stop()
  }

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (activeConversation) {
      loadMessages()
    } else {
      setMessages([])
    }
  }, [activeConversation, loadMessages])

  // Get current citations from the last assistant message
  const currentCitations = messages
    .filter(m => m.type === 'assistant')
    .pop()?.metadata?.citations || []

  return (
    <div className={cn("flex h-screen bg-background", className)}>
      <KeyboardShortcuts 
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
        onFocusComposer={() => {
          // Will be implemented with ref forwarding
        }}
      />
      
      <ConversationsSidebar
        collapsed={leftRailCollapsed}
        onToggleCollapse={() => setLeftRailCollapsed(!leftRailCollapsed)}
        conversations={conversations}
        activeConversation={activeConversation}
        onConversationSelect={setActiveConversation}
        loading={loadingConversations}
      />
      
      <div className="flex-1 flex flex-col">
        <AssistantHeader
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
        />
        
        <ChatTranscript
          messages={messages}
          loading={loadingMessages}
          isStreaming={chat.isStreaming}
          streamingMessage={chat.streamingMessage}
          activeCitation={activeCitation}
        />
        
        <MessageComposer
          message={message}
          setMessage={setMessage}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          isStreaming={chat.isStreaming}
          activeConversation={activeConversation}
          citationsEnabled={true}
          setCitationsEnabled={() => {}}
          quickMode={false}
          setQuickMode={() => {}}
          citationsCount={currentCitations.length}
          onShowCitations={() => setInspectorOpen(true)}
          showUsageWarning={false}
          organizationTier={null}
          onOpenLocked={() => {}}
        />
      </div>
      
      {inspectorOpen && (
        <div className="w-80 border-l bg-background">
          <CitationsPanel
            citations={currentCitations}
            onClose={() => setInspectorOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
