'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSpreadsheet,
  File
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type Source } from '@/utils/api';

interface SourceCardProps {
  source: Source;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getFileIcon = (filename?: string) => {
    if (!filename) return File;
    if (filename.endsWith('.pdf')) return FileText;
    if (filename.endsWith('.csv') || filename.endsWith('.xlsx')) return FileSpreadsheet;
    return File;
  };

  const getRelevanceColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score > 0.8) return 'text-green-600';
    if (score > 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getRelevanceLabel = (score?: number) => {
    if (!score) return 'Pertinence inconnue';
    if (score > 0.8) return 'Très pertinent';
    if (score > 0.6) return 'Pertinent';
    return 'Peu pertinent';
  };

  const Icon = getFileIcon(source.metadata?.filename);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                Source {index + 1}
              </span>
              {source.metadata?.filename && (
                <span className="text-sm text-gray-600">
                  • {source.metadata.filename}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              {source.metadata?.page && (
                <span className="text-xs text-gray-500">
                  Page {source.metadata.page}
                </span>
              )}
              {source.score !== undefined && (
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", getRelevanceColor(source.score))}
                >
                  {Math.round(source.score * 100)}% - {getRelevanceLabel(source.score)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t">
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Extrait du document :</h4>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {source.content}
                </p>
              </div>
              
              {source.metadata && Object.keys(source.metadata).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Métadonnées :</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(source.metadata).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="font-medium text-gray-600">{key}:</span>{' '}
                        <span className="text-gray-500">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}