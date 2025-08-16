"use client"

import { useMemo } from "react"
import { ChatMessage } from "./ChatMessage"
import { Message } from "@/lib/api/conversations"
import { ChatMessage as ChatMessageType } from "@/lib/hooks/use-chat"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatTranscriptProps {
  messages: Message[]
  loading: boolean
  isStreaming: boolean
  streamingMessage: ChatMessageType | null
  activeCitation: string | null
}

export function ChatTranscript({
  messages,
  loading,
  isStreaming,
  streamingMessage,
  activeCitation
}: ChatTranscriptProps) {
  // Combine static messages with streaming message if present
  const allMessages = useMemo(() => {
    if (!streamingMessage) return messages
    
    // Replace or add the streaming message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.id === streamingMessage.id) {
      // Replace the last message with the streaming version
      return [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: streamingMessage.content,
          metadata: {
            ...lastMessage.metadata,
            citations: streamingMessage.metadata?.citations || []
          }
        }
      ]
    } else {
      // Add the streaming message as a new message
      return [...messages, streamingMessage]
    }
  }, [messages, streamingMessage])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex space-x-3">
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-muted-foreground">
              Ask anything about your documents
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {allMessages.map((message, index) => (
          <ChatMessage
            key={message.id}
            id={message.id}
            type={message.type}
            content={message.content}
            timestamp={message.timestamp}
            sources={message.metadata?.citations?.map((citation, idx) => ({
              docId: citation.document_id,
              title: citation.document_title || 'Untitled Document',
              chunks: [citation.chunk_index]
            })) || []}
            isStreaming={isStreaming && index === allMessages.length - 1 && message.type === 'assistant'}
            isLastAssistantMessage={message.type === 'assistant' && index === allMessages.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
