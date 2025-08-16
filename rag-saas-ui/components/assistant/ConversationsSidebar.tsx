"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, Plus, Search, MoreHorizontal } from "lucide-react"
import type { Conversation } from "@/lib/api/conversations"

interface ConversationsSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  conversations: Conversation[]
  activeConversation: string | null
  onConversationSelect: (id: string) => void
  loading: boolean
}

export function ConversationsSidebar({
  collapsed,
  onToggleCollapse,
  conversations,
  activeConversation,
  onConversationSelect,
  loading
}: ConversationsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (collapsed) {
    return (
      <aside className="flex flex-col w-16 border-r bg-background">
        <div className="flex items-center justify-center p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 space-y-2">
          <Button variant="ghost" size="sm" className="p-2">
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex flex-col w-64 border-r bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Conversations</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-8 pr-4 py-2 text-sm rounded-lg border bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Button className="w-full mb-2">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onConversationSelect(conv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all cursor-pointer",
                  activeConversation === conv.id 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm">
                    {conv.title || 'Untitled'}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTimestamp(conv.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {conv.message_count} messages
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
