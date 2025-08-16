"use client"

import { useState, useEffect } from "react"
import { FileText, ExternalLink, Eye, Copy, ChevronDown, ChevronUp, Link, Calendar, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Citation } from "@/lib/api/conversations"

interface ProminentSourcesProps {
  citations?: Citation[]
  onCitationClick?: (citationId: string) => void
  activeCitation?: string | null
  className?: string
  compact?: boolean
}

interface ExtendedCitation extends Citation {
  id: string
  number: number
  confidence: number
  relevance_score?: number
  last_accessed?: string
  document_type?: string
}

export function ProminentSources({ 
  citations = [], 
  onCitationClick, 
  activeCitation = null,
  className,
  compact = false
}: ProminentSourcesProps) {
  const [expanded, setExpanded] = useState(!compact)
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (!citations || citations.length === 0) return null

  const extendedCitations: ExtendedCitation[] = citations.map((citation, index) => ({
    ...citation,
    id: `cite-${index + 1}`,
    number: index + 1,
    confidence: citation.score || 0.8,
    relevance_score: citation.relevance_score || citation.score,
    last_accessed: citation.last_accessed || new Date().toISOString(),
    document_type: citation.document_type || 'document'
  }))

  const averageConfidence = extendedCitations.reduce((acc, c) => acc + c.confidence, 0) / extendedCitations.length
  const highConfidenceSources = extendedCitations.filter(c => c.confidence >= 0.8)
  const recentSources = extendedCitations.filter(c => {
    const accessed = new Date(c.last_accessed)
    const now = new Date()
    const hoursDiff = (now.getTime() - accessed.getTime()) / (1000 * 60 * 60)
    return hoursDiff < 24
  })

  const handleCopy = async (citation: ExtendedCitation, e: React.MouseEvent) => {
    e.stopPropagation()
    const citationText = `${citation.document_title} (Page ${citation.page || 'N/A'}) - ${citation.snippet || 'Source content'}`
    await navigator.clipboard.writeText(citationText)
    setCopiedId(citation.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "border-green-200 bg-green-50 text-green-700"
    if (confidence >= 0.7) return "border-blue-200 bg-blue-50 text-blue-700"
    if (confidence >= 0.5) return "border-yellow-200 bg-yellow-50 text-yellow-700"
    return "border-red-200 bg-red-50 text-red-700"
  }

  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return <FileText className="w-3 h-3" />
      case 'web': return <Link className="w-3 h-3" />
      case 'article': return <Calendar className="w-3 h-3" />
      default: return <FileText className="w-3 h-3" />
    }
  }

  return (
    <div 
      className={cn("prominent-sources", className)}
      style={{
        '--cd-bg': '#F7F9FB',
        '--cd-surface': '#FFFFFF',
        '--cd-border': 'rgba(2, 6, 23, 0.10)',
        '--cd-text-primary': '#0B1220',
        '--cd-text-secondary': 'rgba(11, 18, 32, 0.62)',
        '--cd-accent': '#0B63E6',
      } as React.CSSProperties}
    >
      {/* Header with enhanced stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: 'var(--cd-accent)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--cd-text-primary)' }}>
              Sources ({extendedCitations.length})
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("text-xs", getConfidenceColor(averageConfidence))}
            >
              {Math.round(averageConfidence * 100)}% avg
            </Badge>
            
            {highConfidenceSources.length > 0 && (
              <Badge 
                variant="outline" 
                className="text-xs border-green-200 bg-green-50 text-green-700"
              >
                {highConfidenceSources.length} high confidence
              </Badge>
            )}
            
            {recentSources.length > 0 && (
              <Badge 
                variant="outline" 
                className="text-xs border-blue-200 bg-blue-50 text-blue-700"
              >
                {recentSources.length} recent
              </Badge>
            )}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-[var(--cd-surface-hover)]"
          onClick={() => setExpanded(!expanded)}
          style={{ color: 'var(--cd-text-secondary)' }}
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
      </div>

      {/* Enhanced Sources grid */}
      {expanded && (
        <div className="grid gap-3">
          {extendedCitations.map((citation) => (
            <div
              key={citation.id}
              className={cn(
                "source-card p-4 rounded-lg border transition-all cursor-pointer group",
                "hover:shadow-md hover:border-[var(--cd-accent)]/30",
                activeCitation === citation.id && "border-[var(--cd-accent)] bg-[var(--cd-accent)]/5 shadow-md"
              )}
              onClick={() => onCitationClick?.(citation.id)}
              onMouseEnter={() => setHoveredCitation(citation.id)}
              onMouseLeave={() => setHoveredCitation(null)}
              style={{ 
                borderColor: 'var(--cd-border)',
                backgroundColor: activeCitation === citation.id ? 'rgba(11, 99, 230, 0.05)' : 'var(--cd-surface)'
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ 
                        color: 'var(--cd-accent)',
                        backgroundColor: 'rgba(11, 99, 230, 0.1)'
                      }}
                    >
                      [{citation.number}]
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {getDocumentIcon(citation.document_type)}
                      <h4 
                        className="text-sm font-medium line-clamp-1"
                        style={{ color: 'var(--cd-text-primary)' }}
                      >
                        {citation.document_title}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--cd-text-secondary)' }}>
                    {citation.section && (
                      <>
                        <span>{citation.section}</span>
                        <span>•</span>
                      </>
                    )}
                    {citation.page && (
                      <>
                        <span>Page {citation.page}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{Math.round(citation.confidence * 100)}% relevance</span>
                    {citation.relevance_score && citation.relevance_score !== citation.confidence && (
                      <>
                        <span>•</span>
                        <span>{Math.round(citation.relevance_score * 100)}% match</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-[var(--cd-surface-hover)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCitationClick?.(citation.id)
                    }}
                    style={{ color: 'var(--cd-text-secondary)' }}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-[var(--cd-surface-hover)]"
                    onClick={(e) => handleCopy(citation, e)}
                    style={{ color: 'var(--cd-text-secondary)' }}
                  >
                    {copiedId === citation.id ? (
                      <CheckIcon className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Enhanced preview snippet */}
              {citation.snippet && (
                <div 
                  className="text-xs line-clamp-2 mb-2"
                  style={{ color: 'var(--cd-text-secondary)' }}
                >
                  "{citation.snippet}"
                </div>
              )}

              {/* Enhanced confidence visualization */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--cd-text-secondary)' }}>Confidence</span>
                  <span className="font-medium" style={{ color: 'var(--cd-text-primary)' }}>
                    {Math.round(citation.confidence * 100)}%
                  </span>
                </div>
                <div 
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--cd-surface-subtle)' }}
                >
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${citation.confidence * 100}%`,
                      backgroundColor: citation.confidence >= 0.8 ? '#166534' : 
                                     citation.confidence >= 0.6 ? '#0B63E6' : '#92400E'
                    }}
                  />
                </div>
              </div>

              {/* Document metadata */}
              <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--cd-text-muted)' }}>
                {citation.document_type && (
                  <div className="flex items-center gap-1">
                    {getDocumentIcon(citation.document_type)}
                    <span>{citation.document_type}</span>
                  </div>
                )}
                {citation.last_accessed && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(citation.last_accessed).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compact view */}
      {!expanded && (
        <div className="flex flex-wrap gap-2">
          {extendedCitations.map((citation) => (
            <Badge
              key={citation.id}
              variant="outline"
              className={cn(
                "cursor-pointer transition-all hover:bg-[var(--cd-accent)]/10",
                activeCitation === citation.id && "bg-[var(--cd-accent)]/10 border-[var(--cd-accent)]"
              )}
              onClick={() => onCitationClick?.(citation.id)}
              style={{ 
                borderColor: 'var(--cd-border)',
                color: activeCitation === citation.id ? 'var(--cd-accent)' : 'var(--cd-text-secondary)'
              }}
            >
              [{citation.number}] {citation.document_title}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// Check icon for copy feedback
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
