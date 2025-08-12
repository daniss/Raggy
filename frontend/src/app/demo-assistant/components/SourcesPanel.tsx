'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  X,
  ChevronRight,
  ChevronDown,
  Download,
  ExternalLink,
  Search,
  BookOpen,
  Eye,
  Copy,
  Check,
  Sparkles,
  BarChart3,
  Shield
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type Source } from '@/utils/api';
import DocumentPreview from './DocumentPreview';

interface SourcesPanelProps {
  sources: Source[];
  isVisible: boolean;
  onClose: () => void;
  onToggle: () => void;
  isCollapsed?: boolean;
  onSourceSelect?: (source: Source, index: number) => void;
  currentMessageSources?: Source[];
}

interface CitationGroup {
  filename: string;
  sources: Source[];
  confidence: number;
  sections: string[];
}

export default function SourcesPanel({ 
  sources, 
  isVisible, 
  onClose, 
  onToggle,
  isCollapsed = false,
  onSourceSelect,
  currentMessageSources = []
}: SourcesPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Group sources by filename for better organization
  const groupedSources = React.useMemo(() => {
    const groups: CitationGroup[] = [];
    const fileMap = new Map<string, CitationGroup>();

    sources.forEach((source) => {
      const filename = source.metadata?.filename || 'Document inconnu';
      
      if (!fileMap.has(filename)) {
        fileMap.set(filename, {
          filename,
          sources: [],
          confidence: 0,
          sections: []
        });
      }

      const group = fileMap.get(filename)!;
      group.sources.push(source);
      
      // Calculate average confidence
      if (source.score) {
        group.confidence = (group.confidence + source.score) / 2;
      }
      
      // Collect sections
      if (source.metadata?.section && !group.sections.includes(source.metadata.section)) {
        group.sections.push(source.metadata.section);
      }
    });

    return Array.from(fileMap.values()).sort((a, b) => b.confidence - a.confidence);
  }, [sources]);

  const handleCopySource = async (source: Source, index: number) => {
    const citation = `"${source.content}"\n\nSource: ${source.metadata?.filename || 'Document'}${source.metadata?.page ? `, page ${source.metadata.page}` : ''}`;
    await navigator.clipboard.writeText(citation);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleGroup = (filename: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(filename)) {
      newExpanded.delete(filename);
    } else {
      newExpanded.add(filename);
    }
    setExpandedGroups(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Très fiable';
    if (confidence >= 0.6) return 'Fiable';
    return 'Modérément fiable';
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ 
        x: 0,
        opacity: 1,
        width: isCollapsed ? 60 : 400
      }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        "h-full border-l panel-glass flex flex-col",
        "fixed lg:relative right-0 top-0 z-50 lg:z-auto",
        "w-80 lg:flex-shrink-0 shadow-2xl lg:shadow-none",
        isCollapsed ? "lg:w-16" : "lg:w-96",
        "border-white/20 dark:border-gray-700/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b glass-subtle">
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <BookOpen className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sources & Citations</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {sources.length} référence{sources.length > 1 ? 's' : ''} trouvée{sources.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="p-1.5 h-auto text-gray-500 hover:text-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1.5 h-auto text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
        {isCollapsed && (
          <div className="flex flex-col items-center w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-2 h-auto text-gray-500 hover:text-gray-700"
            >
              <BookOpen className="w-5 h-5" />
            </Button>
            <Badge variant="secondary" className="text-xs mt-1 rotate-90 origin-center">
              {sources.length}
            </Badge>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Stats */}
          {sources.length > 0 && (
            <div className="p-3 glass-subtle border-b border-white/10 dark:border-gray-700/10">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                    {groupedSources.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Documents</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(groupedSources.reduce((acc, g) => acc + g.confidence, 0) / groupedSources.length * 100)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Fiabilité moy.</div>
                </div>
              </div>
            </div>
          )}

          {/* Sources List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <AnimatePresence>
                {groupedSources.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-gray-500"
                  >
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Aucune source trouvée</p>
                    <p className="text-xs mt-1">Les références apparaîtront ici lors de vos questions</p>
                  </motion.div>
                ) : (
                  groupedSources.map((group, groupIndex) => (
                    <motion.div
                      key={group.filename}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIndex * 0.1 }}
                    >
                      <Card className="overflow-hidden glass-card glass-hover shadow-lg">
                        <CardHeader 
                          className="p-3 cursor-pointer hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors glass-hover"
                          onClick={() => toggleGroup(group.filename)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {expandedGroups.has(group.filename) ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {group.filename}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs", getConfidenceColor(group.confidence))}
                                  >
                                    {Math.round(group.confidence * 100)}% • {getConfidenceLabel(group.confidence)}
                                  </Badge>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {group.sources.length} extrait{group.sources.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <AnimatePresence>
                          {expandedGroups.has(group.filename) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <CardContent className="p-0">
                                <div className="space-y-2 p-3 pt-0">
                                  {group.sources.map((source, sourceIndex) => {
                                    const globalIndex = sources.indexOf(source);
                                    const isCurrentMessage = currentMessageSources.includes(source);
                                    
                                    return (
                                      <motion.div
                                        key={globalIndex}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: sourceIndex * 0.05 }}
                                        className={cn(
                                          "p-3 rounded-lg border transition-all duration-200",
                                          isCurrentMessage 
                                            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 shadow-sm" 
                                            : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/40",
                                          selectedSource === globalIndex && "ring-2 ring-purple-300"
                                        )}
                                        onClick={() => {
                                          setSelectedSource(globalIndex);
                                          onSourceSelect?.(source, globalIndex);
                                        }}
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <Badge 
                                              variant={isCurrentMessage ? "default" : "secondary"}
                                              className="text-xs"
                                            >
                                              [{globalIndex + 1}]
                                            </Badge>
                                            {source.metadata?.page && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Page {source.metadata.page}
                                              </span>
                                            )}
                                            {source.score && (
                                              <Badge 
                                                variant="outline" 
                                                className={cn("text-xs", getConfidenceColor(source.score))}
                                              >
                                                {Math.round(source.score * 100)}%
                                              </Badge>
                                            )}
                                          </div>
                                          {isCurrentMessage && (
                                            <motion.div
                                              initial={{ scale: 0 }}
                                              animate={{ scale: 1 }}
                                              className="flex items-center text-purple-600"
                                            >
                                              <Sparkles className="w-3 h-3" />
                                            </motion.div>
                                          )}
                                        </div>

                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-3 line-clamp-3">
                                          {source.content}
                                        </p>

                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopySource(source, globalIndex);
                                              }}
                                              className="h-6 px-2 text-xs"
                                            >
                                              {copiedIndex === globalIndex ? (
                                                <Check className="w-3 h-3 mr-1 text-green-600" />
                                              ) : (
                                                <Copy className="w-3 h-3 mr-1" />
                                              )}
                                              {copiedIndex === globalIndex ? 'Copié' : 'Copier'}
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewSource(source);
                                                setPreviewOpen(true);
                                              }}
                                              className="h-6 px-2 text-xs"
                                            >
                                              <Eye className="w-3 h-3 mr-1" />
                                              Voir
                                            </Button>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-6 px-2 text-xs"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          {sources.length > 0 && (
            <div className="p-4 border-t glass-subtle">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Shield className="w-3 h-3" />
                  <span>Sources vérifiées et sécurisées</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Document Preview Modal */}
      {previewSource && (
        <DocumentPreview
          source={previewSource}
          isOpen={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewSource(null);
          }}
          highlightText={previewSource.content.substring(0, 50)}
          citationContext={{
            page: previewSource.metadata?.page,
            confidence: previewSource.score,
            section: previewSource.metadata?.section
          }}
        />
      )}
    </motion.div>
  );
}