'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  ExternalLink,
  Copy,
  Check,
  Eye,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type Source } from '@/utils/api';

interface CitationBubbleProps {
  citation: number;
  source: Source;
  className?: string;
  onHover?: (citation: number) => void;
  onLeave?: () => void;
  onClick?: (source: Source, citation: number) => void;
  isActive?: boolean;
}

export default function CitationBubble({ 
  citation, 
  source, 
  className,
  onHover,
  onLeave,
  onClick,
  isActive = false
}: CitationBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const citationText = `"${source.content}"\n\nSource: ${source.metadata?.filename || 'Document'}${source.metadata?.page ? `, page ${source.metadata.page}` : ''}`;
    await navigator.clipboard.writeText(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (score?: number) => {
    if (!score) return 'Non évalué';
    if (score >= 0.8) return 'Très fiable';
    if (score >= 0.6) return 'Fiable';
    return 'Modérément fiable';
  };

  return (
    <span className="relative inline-block">
      <motion.button
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full transition-all duration-200",
          "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-300",
          isActive || isHovered
            ? "bg-purple-600 text-white shadow-md"
            : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/60",
          className
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          onHover?.(citation);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onLeave?.();
        }}
        onClick={() => onClick?.(source, citation)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {citation}
      </motion.button>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
          >
            <Card className="w-80 shadow-lg border-purple-200">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-purple-100 rounded">
                      <FileText className="w-3 h-3 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        Source [{citation}]
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {source.metadata?.filename || 'Document inconnu'}
                        {source.metadata?.page && ` • Page ${source.metadata.page}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {source.score && (
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getConfidenceColor(source.score))}
                      >
                        {Math.round(source.score * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content Preview */}
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Extrait du document :
                  </div>
                  <div className="p-2 bg-gray-50 rounded text-xs text-gray-700 leading-relaxed max-h-20 overflow-y-auto">
                    "{source.content}"
                  </div>
                </div>

                {/* Confidence Indicator */}
                {source.score && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Fiabilité</span>
                      <span className={getConfidenceColor(source.score)}>
                        {getConfidenceLabel(source.score)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <motion.div
                        className={cn(
                          "h-1.5 rounded-full",
                          source.score >= 0.8 ? "bg-green-500" :
                          source.score >= 0.6 ? "bg-yellow-500" : "bg-orange-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${source.score * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 px-2 text-xs"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 mr-1 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    {copied ? 'Copié' : 'Copier'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick?.(source, citation);
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Voir
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-2 h-2 bg-white border-r border-b border-purple-200 transform rotate-45 -mt-1"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Utility function to render text with inline citations
export function renderTextWithCitations(
  text: string, 
  sources: Source[],
  onCitationClick?: (source: Source, citation: number) => void,
  onCitationHover?: (citation: number) => void,
  onCitationLeave?: () => void,
  activeCitation?: number
) {
  // Find all citation patterns like [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g;
  let lastIndex = 0;
  const elements: React.ReactNode[] = [];
  let match;

  while ((match = citationPattern.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    // Add citation bubble
    const citationNumber = parseInt(match[1]);
    const source = sources[citationNumber - 1]; // 0-based index
    
    if (source) {
      elements.push(
        <CitationBubble
          key={`citation-${citationNumber}-${match.index}`}
          citation={citationNumber}
          source={source}
          onClick={onCitationClick}
          onHover={onCitationHover}
          onLeave={onCitationLeave}
          isActive={activeCitation === citationNumber}
        />
      );
    } else {
      // If source not found, render as plain text
      elements.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}