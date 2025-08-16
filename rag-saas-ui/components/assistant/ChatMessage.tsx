"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, FileText, Copy, RotateCcw, Edit2, Trash2, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/translations"
import { formatRelativeTime } from "@/lib/utils/time"

interface ChatMessageProps {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: Array<{
    docId: string
    title: string
    chunks: number[]
  }>
  isStreaming?: boolean
  isLastAssistantMessage?: boolean
  onCopy?: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function ChatMessage({ 
  id,
  type, 
  content, 
  timestamp, 
  sources = [], 
  isStreaming = false,
  isLastAssistantMessage = false,
  onCopy,
  onRegenerate,
  onEdit,
  onDelete,
  className 
}: ChatMessageProps) {
  const t = useI18n()
  const [showActions, setShowActions] = useState(false)

  // Enhanced markdown rendering would go here
  // For now, we'll use basic whitespace preservation with line breaks
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div 
      className={cn("group relative", className)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn(
        "flex gap-4 mb-6",
        type === "user" ? "justify-end" : "justify-start"
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
              "px-4 py-3 rounded-xl transition-all duration-200 relative",
              type === "user" 
                ? "bg-accent text-accent-foreground shadow-sm" 
                : "bg-surface-elevated border border-border/30 shadow-sm hover:shadow-md"
            )}
            style={{
              maxWidth: type === "assistant" ? "620px" : "auto"
            }}
          >
            {/* Message Content */}
            <div className="text-sm leading-relaxed prose prose-sm max-w-none">
              {renderContent(content)}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse" />
              )}
            </div>

            {/* Sources for Assistant Messages */}
            {type === "assistant" && sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3 h-3 text-text-subtle" />
                  <span className="text-xs font-medium text-text-subtle">{t.assistant.sources}</span>
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

            {/* Message Actions */}
            {showActions && (
              <div className={cn(
                "absolute -top-2 flex items-center gap-1 bg-background border border-border/50 rounded-lg shadow-lg px-2 py-1 animate-in fade-in duration-200",
                type === "user" ? "right-0" : "left-0"
              )}>
                {onCopy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCopy}
                    className="h-6 w-6 p-0 hover:bg-accent/10"
                    title={t.assistant.copy}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
                
                {type === "assistant" && isLastAssistantMessage && onRegenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRegenerate}
                    className="h-6 w-6 p-0 hover:bg-accent/10"
                    title={t.assistant.regenerate}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}

                {type === "user" && (onEdit || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-accent/10"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      {onEdit && (
                        <DropdownMenuItem onClick={onEdit} className="text-xs">
                          <Edit2 className="w-3 h-3 mr-2" />
                          {t.assistant.edit}
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem onClick={onDelete} className="text-xs text-status-error">
                          <Trash2 className="w-3 h-3 mr-2" />
                          {t.assistant.delete}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className={cn(
            "flex items-center gap-1.5 mt-1 px-1",
            type === "user" ? "flex-row-reverse" : "flex-row"
          )}>
            <Clock className="w-3 h-3 text-text-subtle" />
            <span className="text-xs text-text-subtle">
              {formatRelativeTime(timestamp)}
            </span>
          </div>
        </div>

        {/* User Avatar */}
        {type === "user" && (
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-elevated border border-border/30 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-text-subtle" />
          </div>
        )}
      </div>
    </div>
  )
}