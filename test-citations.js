// Simple test to verify citation parsing
import { parseInlineCitations, removeInlineCitations, groupCitationsByDocument } from '../lib/utils/citations'

// Test text similar to what you're seeing
const testText = `
Le plan de repas de Danis Cindrak est composé de 20 pages, comme indiqué dans le sommaire [doc:f570a35a chunk:6]. Le plan est créé par Pierre Dupont et est daté du 26 juillet 2025 [doc:f570a35a chunk:11].

Un exemple de repas est présenté page 10 [doc:f570a35a chunk:34]. Il s'agit d'une salade de pois chiches et de légumes grillés.
`

console.log('=== Citation Parsing Test ===')

// Test parsing
const citations = parseInlineCitations(testText)
console.log('Parsed citations:', citations)

// Test removing citations
const cleanText = removeInlineCitations(testText)
console.log('Clean text:', cleanText)

// Test grouping
const sources = groupCitationsByDocument(citations)
console.log('Grouped sources:', sources)
