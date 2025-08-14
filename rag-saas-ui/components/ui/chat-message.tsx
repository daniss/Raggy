import type React from "react"
import { User, Bot } from "lucide-react"

export interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: string
  citations?: Array<{ title: string; page?: number }>
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, timestamp, citations }) => {
  return (
    <div className={`flex gap-3 mb-4 ${role === "user" ? "justify-end" : ""}`}>
      {role === "assistant" && (
        <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`chat-message ${role} max-w-[80%] break-words`}>
        <div className="text-sm leading-relaxed">{content}</div>
        {citations && citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="text-xs opacity-70 mb-1">Sources:</div>
            {citations.map((citation, i) => (
              <div key={i} className="text-xs opacity-80">
                {citation.title}
                {citation.page && ` (p.${citation.page})`}
              </div>
            ))}
          </div>
        )}
        {timestamp && <div className="text-xs opacity-60 mt-1">{timestamp}</div>}
      </div>
      {role === "user" && (
        <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-bg-subtle)] rounded-full flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  )
}
