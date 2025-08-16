/**
 * Citation parsing utilities
 * Handles extraction and formatting of citations from RAG responses
 */

export interface ParsedCitation {
  docId: string
  chunkIndex: number
  originalText: string
}

export interface DocumentSource {
  docId: string
  title: string
  chunks: number[]
}

/**
 * Parse inline citations from text like [doc:f570a35a chunk:6]
 */
export function parseInlineCitations(text: string): ParsedCitation[] {
  const citationRegex = /\[doc:([a-f0-9-]+)\s+chunk:(\d+)\]/g
  const citations: ParsedCitation[] = []
  let match

  while ((match = citationRegex.exec(text)) !== null) {
    citations.push({
      docId: match[1],
      chunkIndex: parseInt(match[2]),
      originalText: match[0]
    })
  }

  return citations
}

/**
 * Remove inline citations from text for clean display
 */
export function removeInlineCitations(text: string): string {
  const citationRegex = /\[doc:[a-f0-9-]+\s+chunk:\d+\]/g
  return text.replace(citationRegex, '').trim()
}

/**
 * Group citations by document for source display
 */
export function groupCitationsByDocument(citations: ParsedCitation[]): DocumentSource[] {
  const grouped = new Map<string, Set<number>>()

  citations.forEach(citation => {
    if (!grouped.has(citation.docId)) {
      grouped.set(citation.docId, new Set())
    }
    grouped.get(citation.docId)!.add(citation.chunkIndex)
  })

  return Array.from(grouped.entries()).map(([docId, chunks]) => ({
    docId,
    title: `Document ${docId.slice(0, 8)}...`, // Placeholder - should be fetched from API
    chunks: Array.from(chunks).sort((a, b) => a - b)
  }))
}

/**
 * Format document source for display
 */
export function formatDocumentSource(source: DocumentSource): string {
  const chunkText = source.chunks.length === 1 
    ? `section ${source.chunks[0]}` 
    : `sections ${source.chunks.join(', ')}`
  
  return `${source.title} (${chunkText})`
}
