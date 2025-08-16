"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Bot, MoreHorizontal, Edit2, Trash2 } from "lucide-react"
import { useI18n } from "@/i18n/translations"
import { formatRelativeTime } from "@/lib/utils/time"
import type { Conversation } from "@/lib/api/conversations"

interface ConversationsSidebarProps {
  conversations: Conversation[]
  filteredConversations: Conversation[]
  activeConversation: string | null
  conversationSearch: string
  setConversationSearch: (search: string) => void
  setActiveConversation: (id: string | null) => void
  onCreateConversation: () => void
  onRenameConversation: (conversation: Conversation) => void
  onDeleteConversation: (conversation: Conversation) => void
  loadingConversations: boolean
}

export function ConversationsSidebar({
  conversations,
  filteredConversations,
  activeConversation,
  conversationSearch,
  setConversationSearch,
  setActiveConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  loadingConversations
}: ConversationsSidebarProps) {
  const t = useI18n()

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/30 flex-shrink-0 backdrop-blur-[8px]">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {t.nav.conversations}
        </h2>
        <Button 
          size="sm" 
          onClick={onCreateConversation} 
          disabled={loadingConversations}
          className="h-7 w-7 p-0 bg-accent-100 hover:bg-accent-200 border-0 text-accent-700 hover:text-accent-800 transition-all duration-200 rounded-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="sr-only">{t.actions.newConversation}</span>
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder={t.assistant.search_placeholder}
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-background/40 border-border/40 focus:border-accent-300 focus:ring-1 focus:ring-accent-200 placeholder:text-muted-foreground/50 transition-all duration-200 rounded-xs"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 min-h-0">
        {loadingConversations ? (
          <div className="space-y-2 pr-2 px-4">
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
          <div className="space-y-0.5 pr-2 px-4">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {conversationSearch ? (
                  <div className="space-y-1">
                    <p className="text-sm">No conversations found</p>
                    <p className="text-xs">Try another search term</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-8 h-8 bg-accent/20 rounded-full mx-auto flex items-center justify-center animate-in zoom-in duration-400">
                      <Bot className="w-4 h-4 text-accent animate-pulse" />
                    </div>
                    <div className="space-y-1 animate-in slide-in-from-bottom-2 duration-400 delay-200">
                      <p className="text-sm font-medium">{t.assistant.no_conversations}</p>
                      <p className="text-xs text-text-subtle leading-relaxed">{t.assistant.no_conversations_sub}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={onCreateConversation}
                      className="mt-3 h-7 px-3 text-xs bg-accent hover:bg-accent/90 text-accent-foreground animate-in slide-in-from-bottom-1 duration-400 delay-400"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      {t.assistant.start_button}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredConversations.map((conv, index) => (
                <div
                  key={conv.id}
                  className={`conversation-item cursor-pointer relative group transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in fade-in slide-in-from-left-2 rounded-md ${
                    conv.id === activeConversation 
                      ? 'bg-surface-elevated/80 border-l-[3px] border-l-accent shadow-surface-low' 
                      : 'hover:bg-surface-elevated/50'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
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
                  {/* Active indicator */}
                  {conv.id === activeConversation && (
                    <div className="absolute inset-y-0 left-0 w-0.5 bg-accent rounded-r-full animate-in slide-in-from-left duration-300" />
                  )}
                  
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="font-medium text-sm text-foreground leading-tight mb-1 truncate transition-colors duration-200 group-hover:text-accent">
                        {conv.title}
                      </h4>
                      
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
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        conv.id === activeConversation 
                          ? 'bg-accent shadow-glow-accent' 
                          : 'bg-text-subtle/30 group-hover:bg-accent/60'
                      }`} />
                      
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
                              onRenameConversation(conv)
                            }}
                            className="text-xs hover:bg-surface-elevated/80"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-2 text-text-subtle" />
                            {t.assistant.rename}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteConversation(conv)
                            }}
                            className="text-xs text-status-error hover:bg-status-error/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            {t.assistant.delete}
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
}