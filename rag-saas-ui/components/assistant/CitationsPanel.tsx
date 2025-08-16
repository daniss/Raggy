"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, X } from "lucide-react"
import { useI18n } from "@/i18n/translations"

interface Citation {
  document_id: string
  chunk_index: number
  score: number
  section: string | null
  page: number | null
  document_title?: string
  document_filename?: string
}

interface CitationsPanelProps {
  citations: Citation[]
  onClose: () => void
  onShowDetails?: () => void
}

export function CitationsPanel({
  citations,
  onClose,
  onShowDetails
}: CitationsPanelProps) {
  const t = useI18n()

  return (
    <div className="flex flex-col h-full bg-surface-elevated/40 glass-subtle">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center shadow-sm">
            <FileText className="w-3.5 h-3.5 text-accent" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">{t.assistant.sources}</h3>
          <div className="w-5 h-5 rounded-full bg-surface-elevated/80 border border-border/40 flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-medium text-text-subtle">
              {citations.length}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-text-subtle hover:text-foreground hover:bg-surface-elevated/60 rounded-lg transition-fast"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-3">
        {citations.length === 0 ? (
          <div className="text-center py-12 px-2">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-elevated/60 border border-border/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-text-subtle" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{t.assistant.no_sources}</p>
            <p className="text-xs text-text-subtle leading-relaxed max-w-[140px] mx-auto">
              {t.assistant.no_sources_sub}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {citations.map((citation, idx) => (
              <div 
                key={idx} 
                className="group relative animate-in fade-in duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Citation Card */}
                <div className="citation-card p-3 hover:scale-[1.01] transition-smooth">
                  <div className="flex items-start gap-2.5">
                    {/* Number Badge */}
                    <div className="flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-accent/30 to-accent/20 flex items-center justify-center mt-0.5 shadow-sm">
                      <span className="text-[10px] font-bold text-accent tabular-nums">
                        {idx + 1}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h4 className="font-medium text-[13px] text-foreground line-clamp-2 leading-tight mb-2">
                        {citation.document_title || citation.document_filename || `Document ${citation.document_id.slice(0, 8)}...`}
                      </h4>
                      
                      {/* Score Bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1 bg-surface-elevated/80 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700 ease-out"
                            style={{ 
                              width: `${citation.score * 100}%`,
                              animationDelay: `${idx * 150}ms`
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-text-subtle tabular-nums">
                          {Math.round(citation.score * 100)}%
                        </span>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                        <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md">
                          §{citation.chunk_index}
                        </span>
                        {citation.page && (
                          <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md">
                            p.{citation.page}
                          </span>
                        )}
                        {citation.section && citation.section !== 'main' && (
                          <span className="bg-surface-elevated/60 px-1.5 py-0.5 rounded-md truncate max-w-[60px]">
                            {citation.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Footer */}
      {citations.length > 0 && (
        <div className="mt-2 pt-3 border-t border-border/20 px-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-subtle leading-tight">
              {citations.length} source{citations.length > 1 ? 's' : ''} analyzed
            </span>
            {onShowDetails && (
              <Button
                variant="ghost"
                size="sm" 
                onClick={onShowDetails}
                className="h-6 px-2 text-[10px] text-text-subtle hover:text-foreground hover:bg-surface-elevated/60 rounded-lg"
              >
                {t.assistant.details}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}