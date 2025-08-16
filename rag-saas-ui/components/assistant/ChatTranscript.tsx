"use client"

import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Bot, Plus } from "lucide-react"
import { ChatMessage } from "./ChatMessage"
import { useI18n } from "@/i18n/translations"

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    citations?: any[]
    usage?: any
    model?: string
  }
}

interface ChatTranscriptProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  activeConversation: string | null
  loadingMessages: boolean
  onCreateConversation: () => void
  onCopyMessage?: (messageId: string) => void
  onRegenerateResponse?: () => void
  onEditMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
}

export function ChatTranscript({
  messages,
  streamingContent,
  isStreaming,
  activeConversation,
  loadingMessages,
  onCreateConversation,
  onCopyMessage,
  onRegenerateResponse,
  onEditMessage,
  onDeleteMessage
}: ChatTranscriptProps) {
  const t = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or streaming
  useEffect(() => {
    if (messagesEndRef.current && (isStreaming || messages.length > 0)) {
      const scrollOptions = isStreaming 
        ? { behavior: 'smooth' as const } 
        : { behavior: 'auto' as const }
      messagesEndRef.current.scrollIntoView(scrollOptions)
    }
  }, [messages.length, streamingContent, isStreaming])

  // Convert citations for sources
  const convertCitationsToSources = (citations?: any[]) => {
    if (!citations) return []
    return citations.map(citation => ({
      docId: citation.document_id,
      title: citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 8)}...`,
      chunks: [citation.chunk_index]
    }))
  }

  if (loadingMessages) {
    return (
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i} 
                className="animate-in fade-in duration-500"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="flex gap-4 mb-6">
                  {i % 2 === 0 && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 animate-pulse" />
                  )}
                  <div className="flex-1 max-w-[620px]">
                    <div className="px-4 py-3 rounded-xl bg-surface-elevated border border-border/30">
                      <div className="space-y-2">
                        <div className="h-4 bg-surface-elevated/60 rounded animate-pulse" />
                        <div className="h-4 bg-surface-elevated/40 rounded animate-pulse w-3/4" />
                        <div className="h-4 bg-surface-elevated/40 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  </div>
                  {i % 2 === 1 && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-elevated border border-border/30 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    )
  }

  if (!activeConversation) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div className="space-y-6 animate-in fade-in duration-700">
          <div className="w-20 h-20 bg-surface-elevated/60 border border-border/30 rounded-2xl mx-auto flex items-center justify-center animate-in zoom-in duration-500 delay-200">
            <Bot className="w-8 h-8 text-accent/80 animate-pulse" />
          </div>
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-400">
            <p className="text-base font-medium text-foreground">{t.assistant.select_conversation}</p>
            <p className="text-sm text-text-subtle max-w-xs mx-auto leading-relaxed">
              {t.assistant.select_conversation_sub}
            </p>
          </div>
          <Button
            onClick={onCreateConversation}
            className="animate-in slide-in-from-bottom-2 duration-500 delay-600 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.actions.newConversation}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-6" role="log" aria-label="Conversation messages" aria-live="polite">
          {/* Welcome message */}
          {messages.length === 0 && !isStreaming && (
            <div className="animate-in fade-in duration-500" role="article">
              <ChatMessage
                id="welcome"
                type="assistant"
                content={t.assistant.welcome_message}
                timestamp={new Date().toISOString()}
                sources={[]}
                isStreaming={false}
              />
            </div>
          )}
          
          {/* Conversation messages */}
          {messages.map((msg, index) => {
            const isLastAssistantMessage = msg.type === 'assistant' && 
              index === messages.findLastIndex(m => m.type === 'assistant')
            
            const sources = convertCitationsToSources(msg.metadata?.citations)
            
            return (
              <div 
                key={msg.id} 
                className="animate-in fade-in slide-in-from-bottom-2 duration-400"
                style={{ animationDelay: `${index * 100}ms` }}
                role="article"
              >
                <ChatMessage
                  id={msg.id}
                  type={msg.type}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  sources={sources}
                  isStreaming={false}
                  isLastAssistantMessage={isLastAssistantMessage}
                  onCopy={() => onCopyMessage?.(msg.id)}
                  onRegenerate={isLastAssistantMessage ? onRegenerateResponse : undefined}
                  onEdit={msg.type === 'user' ? () => onEditMessage?.(msg.id) : undefined}
                  onDelete={msg.type === 'user' ? () => onDeleteMessage?.(msg.id) : undefined}
                />
              </div>
            )
          })}
          
          {/* Streaming message */}
          {isStreaming && (
            <div className="animate-in fade-in duration-300">
              <ChatMessage
                id="streaming"
                type="assistant"
                content={streamingContent || ''}
                timestamp={new Date().toISOString()}
                sources={[]}
                isStreaming={true}
              />
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  )
}