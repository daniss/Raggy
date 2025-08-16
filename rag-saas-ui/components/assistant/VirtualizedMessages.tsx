"use client"

import { useMemo } from "react"
import { ChatMessage } from "./ChatMessage"

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

interface VirtualizedMessagesProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  onCopyMessage?: (messageId: string) => void
  onRegenerateResponse?: () => void
  onEditMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  className?: string
}

// Simple virtualization - only render visible messages when there are many
export function VirtualizedMessages({
  messages,
  streamingContent,
  isStreaming,
  onCopyMessage,
  onRegenerateResponse,
  onEditMessage,
  onDeleteMessage,
  className
}: VirtualizedMessagesProps) {
  // Convert citations for sources
  const convertCitationsToSources = useMemo(() => (citations?: any[]) => {
    if (!citations) return []
    return citations.map(citation => ({
      docId: citation.document_id,
      title: citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 8)}...`,
      chunks: [citation.chunk_index]
    }))
  }, [])

  // For now, simple implementation - virtualization can be added later if needed
  // Threshold of 100 messages before we consider virtualization
  const shouldVirtualize = messages.length > 100
  
  // For large message lists, we could implement windowing here
  // For now, we'll render all messages but add a performance note
  const messagesToRender = shouldVirtualize ? messages.slice(-50) : messages
  
  return (
    <div className={`space-y-6 ${className}`} role="log" aria-label="Conversation messages" aria-live="polite">
      {/* Show loading indicator for large lists */}
      {shouldVirtualize && (
        <div className="text-center py-4 text-text-subtle text-xs">
          Showing recent messages • {messages.length} total
        </div>
      )}
      
      {/* Messages */}
      {messagesToRender.map((msg, index) => {
        const isLastAssistantMessage = msg.type === 'assistant' && 
          index === messagesToRender.findLastIndex(m => m.type === 'assistant')
        
        const sources = convertCitationsToSources(msg.metadata?.citations)
        
        return (
          <div 
            key={msg.id} 
            className="animate-in fade-in slide-in-from-bottom-2 duration-400"
            style={{ animationDelay: `${index * 50}ms` }}
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
    </div>
  )
}