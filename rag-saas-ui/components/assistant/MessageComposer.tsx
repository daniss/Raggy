"use client"

import { useRef, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, Square, AlertTriangle, FileText, Zap } from "lucide-react"
import { useI18n } from "@/i18n/translations"
import type { FeatureKey } from "@/lib/features"

interface MessageComposerProps {
  message: string
  setMessage: (message: string) => void
  onSendMessage: () => void
  onStopGeneration: () => void
  isStreaming: boolean
  activeConversation: string | null
  citationsEnabled: boolean
  setCitationsEnabled: (enabled: boolean) => void
  quickMode: boolean
  setQuickMode: (enabled: boolean) => void
  citationsCount: number
  onShowCitations: () => void
  showUsageWarning: boolean
  organizationTier?: string | null
  onOpenLocked: (feature: FeatureKey) => void
}

export const MessageComposer = forwardRef<HTMLInputElement, MessageComposerProps>(({
  message,
  setMessage,
  onSendMessage,
  onStopGeneration,
  isStreaming,
  activeConversation,
  citationsEnabled,
  setCitationsEnabled,
  quickMode,
  setQuickMode,
  citationsCount,
  onShowCitations,
  showUsageWarning,
  organizationTier,
  onOpenLocked
}, ref) => {
  const t = useI18n()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) {
        onStopGeneration()
      } else {
        onSendMessage()
      }
    }
    
    // Handle Escape to blur the input
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).blur()
    }
    
    // Handle Ctrl/Cmd + Up to edit last user message (future feature)
    if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
      e.preventDefault()
      // Could implement edit last message here
    }
  }

  return (
    <div className="border-t border-border/20 bg-surface-elevated/60 backdrop-blur-xl p-4 lg:p-6">
      <div className="max-w-[820px] mx-auto">
        {/* Main Input Area */}
        <div className="relative group">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <div className="relative">
                <Input
                  ref={ref}
                  placeholder={
                    activeConversation 
                      ? t.assistant.composer_placeholder
                      : t.assistant.composer_placeholder_first
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[52px] pr-20 bg-background/95 border-border/30 rounded-xl text-sm leading-relaxed focus:border-accent/60 focus:ring-accent/20 focus:ring-2 focus:bg-background transition-all duration-200 placeholder:text-text-subtle/60 shadow-surface-low backdrop-blur-sm resize-none"
                  disabled={isStreaming}
                  aria-label="Message input area"
                  aria-describedby="composer-help"
                  autoComplete="off"
                  spellCheck="true"
                />
                
                {/* Keyboard shortcut hint */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="text-[10px] text-text-subtle/50 font-mono bg-surface-elevated/60 border border-border/20 rounded px-1.5 py-0.5 backdrop-blur-sm">
                    {t.assistant.send_shortcut}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Send/Stop Button */}
            {isStreaming ? (
              <Button 
                onClick={onStopGeneration} 
                variant="destructive"
                size="default"
                className="h-[52px] px-4 rounded-xl focus:ring-2 focus:ring-status-error/20 focus:ring-offset-2 shadow-surface-low transition-all duration-200 hover:shadow-surface-medium"
                aria-label={t.assistant.stop_generating}
              >
                <Square className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline font-medium">{t.assistant.stop}</span>
              </Button>
            ) : (
              <Button 
                onClick={onSendMessage} 
                disabled={!message.trim()}
                className="h-[52px] px-4 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 shadow-surface-low transition-all duration-200 hover:shadow-surface-medium hover:scale-[1.02] active:scale-[0.98]"
                aria-label={t.assistant.send}
              >
                <Send className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline font-medium">{t.assistant.send}</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* Status and Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <p 
              id="composer-help" 
              className="text-xs text-text-subtle leading-relaxed"
              role="status"
              aria-live="polite"
            >
              {isStreaming ? (
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  {t.assistant.generating}
                </span>
              ) : activeConversation
                ? t.assistant.continue_conversation
                : t.assistant.first_question_creates
              }
            </p>
            
            {/* Usage Warning */}
            {showUsageWarning && (
              <div className="flex items-center gap-1.5 text-xs text-status-warning bg-status-warning/10 border border-status-warning/20 rounded-lg px-2 py-1">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-medium">{t.assistant.quota_warning}</span>
              </div>
            )}
          </div>
          
          {/* Secondary Actions */}
          <div className="flex items-center gap-2">
            {/* Citations Button */}
            {citationsCount > 0 && citationsEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowCitations}
                className="h-7 text-xs bg-surface-elevated/50 border-border/40 hover:bg-surface-elevated hover:border-border/60 focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                aria-label={`View ${citationsCount} source${citationsCount > 1 ? 's' : ''}`}
              >
                <FileText className="w-3 h-3 mr-1.5" />
                <span className="hidden xs:inline">
                  {citationsCount} {citationsCount > 1 ? 'sources' : 'source'}
                </span>
                <span className="xs:hidden">{citationsCount}</span>
              </Button>
            )}
            
            {/* Quick Settings */}
            <div className="flex items-center gap-1">
              <Button
                variant={citationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setCitationsEnabled(!citationsEnabled)}
                className="h-7 px-2.5 text-xs transition-all duration-200"
                title="Toggle citations"
              >
                <FileText className="w-3 h-3" />
              </Button>
              <Button
                variant={quickMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (organizationTier === 'starter') {
                    onOpenLocked('fast_mode')
                  } else {
                    setQuickMode(!quickMode)
                  }
                }}
                className="h-7 px-2.5 text-xs transition-all duration-200"
                disabled={false}
                title="Fast mode (premium)"
              >
                <Zap className="w-3 h-3" />
                {organizationTier === 'starter' && <span className="ml-1 text-[10px]">🔒</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

MessageComposer.displayName = "MessageComposer"