import React from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SourceItemProps {
  title: string
  score: number
  chunkIndex: number
  page?: number
  section?: string
  isHighlighted?: boolean
  onClick?: () => void
  className?: string
}

export function SourceItem({
  title,
  score,
  chunkIndex,
  page,
  section,
  isHighlighted = false,
  onClick,
  className
}: SourceItemProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all duration-200 cursor-pointer",
        isHighlighted
          ? "bg-accent/10 border-accent/30"
          : "bg-surface border-border/30 hover:border-border/60 hover:shadow-sm",
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 text-text-subtle flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">
            {title}
          </h4>
        </div>
        <div className="text-xs font-semibold text-text-subtle">
          {Math.round(score * 100)}%
        </div>
      </div>

      {/* Relevance Bar */}
      <div className="mb-2">
        <div className="h-1 bg-border/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 text-xs text-text-subtle">
        <span className="bg-surface-elevated px-1.5 py-0.5 rounded">
          §{chunkIndex}
        </span>
        {page && (
          <span className="bg-surface-elevated px-1.5 py-0.5 rounded">
            p.{page}
          </span>
        )}
        {section && section !== 'main' && (
          <span className="bg-surface-elevated px-1.5 py-0.5 rounded truncate max-w-[100px]">
            {section}
          </span>
        )}
      </div>
    </div>
  )
}
