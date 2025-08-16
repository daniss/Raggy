import React from 'react'
import { Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatBubbleProps {
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: Array<{
    docId: string
    title: string
    chunks: number[]
  }>
  isStreaming?: boolean
  className?: string
}

export function ChatBubble({ 
  type, 
  content, 
  timestamp, 
  sources = [], 
  isStreaming = false,
  className 
}: ChatBubbleProps) {
  return (
    <div className={cn(
      "flex gap-4 mb-6",
      type === "user" ? "justify-end" : "justify-start",
      className
    )}>
      {/* Assistant Avatar */}
      {type === "assistant" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
          <div className="w-4 h-4 rounded bg-accent opacity-80" />
        </div>
      )}

      <div className={cn(
        "max-w-[min(85%,640px)] flex flex-col",
        type === "user" && "items-end"
      )}>
        {/* Message Bubble */}
        <div
          className={cn(
            "px-4 py-3 rounded-xl transition-all duration-200",
            type === "user" 
              ? "bg-accent text-accent-foreground shadow-sm" 
              : "bg-surface-elevated border border-border/30 shadow-sm"
          )}
          style={{
            maxWidth: type === "assistant" ? "620px" : "auto"
          }}
        >
          {/* Message Content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse" />
            )}
          </div>

          {/* Sources for Assistant Messages */}
          {type === "assistant" && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3 h-3 text-text-subtle" />
                <span className="text-xs font-medium text-text-subtle">Sources</span>
              </div>
              <div className="space-y-1">
                {sources.slice(0, 2).map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-border/30 hover:border-border/60 transition-all duration-200"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {source.title}
                    </span>
                    {source.chunks.length > 0 && (
                      <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        §{source.chunks[0]}
                      </span>
                    )}
                  </div>
                ))}
                {sources.length > 2 && (
                  <div className="text-xs text-text-subtle pl-2">
                    +{sources.length - 2} more sources
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className={cn(
          "flex items-center gap-1.5 mt-1 px-1",
          type === "user" ? "flex-row-reverse" : "flex-row"
        )}>
          <Clock className="w-3 h-3 text-text-subtle" />
          <span className="text-xs text-text-subtle">{timestamp}</span>
        </div>
      </div>

      {/* User Avatar */}
      {type === "user" && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-elevated border border-border/30 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-text-subtle" />
        </div>
      )}
    </div>
  )
}
