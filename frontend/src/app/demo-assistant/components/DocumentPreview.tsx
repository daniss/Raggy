'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  Search,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  File,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Maximize2,
  Minimize2,
  BookOpen,
  Highlighter,
  Copy,
  ExternalLink,
  Settings,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type Source } from '@/utils/api';

// PDF Viewer Component with Authentication
interface PDFViewerProps {
  filename: string;
  citationContext?: {
    page?: number;
    confidence?: number;
    section?: string;
  };
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
}

function PDFViewer({ filename, citationContext, onLoadStart, onLoadComplete }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        onLoadStart?.();
        
        // Get demo session from localStorage
        const storedSession = localStorage.getItem('demoSession');
        if (!storedSession) {
          throw new Error('Session de démo non trouvée');
        }
        
        const session = JSON.parse(storedSession);
        
        // Fetch PDF with authentication
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/demo/document/${encodeURIComponent(filename)}`,
          {
            headers: {
              'X-Demo-Session': session.token
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        // Create blob URL for the PDF
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        onLoadComplete?.();
        
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
        onLoadComplete?.();
      }
    };

    loadPDF();

    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [filename]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Erreur de chargement</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return null; // Loading handled by parent
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        src={pdfUrl}
        className="w-full h-full border-0"
        title={`PDF Viewer - ${filename}`}
        style={{ minHeight: '500px' }}
      />
      
      {/* PDF Controls Overlay */}
      {citationContext?.page && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border dark:border-gray-600 rounded-lg p-2 shadow-lg z-10">
          <Badge variant="default" className="bg-red-600 text-white">
            Page {citationContext.page}
          </Badge>
        </div>
      )}
    </div>
  );
}

interface DocumentPreviewProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  highlightText?: string;
  citationContext?: {
    page?: number;
    confidence?: number;
    section?: string;
  };
}

interface DocumentInfo {
  filename: string;
  type: 'pdf' | 'excel' | 'word' | 'text' | 'unknown';
  size?: string;
  pages?: number;
  lastModified?: string;
}

export default function DocumentPreview({ 
  source, 
  isOpen, 
  onClose, 
  highlightText,
  citationContext 
}: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<'content' | 'metadata'>('content');
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Extract document info from source
  const documentInfo: DocumentInfo = {
    filename: source.metadata?.filename || 'Document inconnu',
    type: getDocumentType(source.metadata?.filename),
    size: source.metadata?.size || 'Taille inconnue',
    pages: source.metadata?.pages || 1,
    lastModified: source.metadata?.lastModified || 'Date inconnue'
  };

  // Initialize highlights when component opens
  useEffect(() => {
    if (isOpen && highlightText) {
      setHighlights([highlightText]);
      // setSearchQuery(highlightText); // Removed search functionality
    }
  }, [isOpen, highlightText]);

  // Navigate to specific page if provided in citation context
  useEffect(() => {
    if (citationContext?.page) {
      setCurrentPage(citationContext.page);
    }
  }, [citationContext]);

  function getDocumentType(filename?: string): DocumentInfo['type'] {
    if (!filename) return 'unknown';
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'xlsx': case 'xls': case 'csv': return 'excel';
      case 'docx': case 'doc': return 'word';
      case 'txt': case 'md': return 'text';
      default: return 'unknown';
    }
  }

  const getDocumentIcon = (type: DocumentInfo['type']) => {
    switch (type) {
      case 'pdf': return FileText;
      case 'excel': return FileSpreadsheet;
      case 'word': return FileText;
      case 'text': return File;
      default: return File;
    }
  };

  const getTypeColor = (type: DocumentInfo['type']) => {
    switch (type) {
      case 'pdf': return 'text-red-600 bg-red-50';
      case 'excel': return 'text-green-600 bg-green-50';
      case 'word': return 'text-blue-600 bg-blue-50';
      case 'text': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };


  const handleCopyText = () => {
    navigator.clipboard.writeText(source.content);
  };

  const handleDownload = () => {
    // In demo mode, show message about full version
    alert('Fonctionnalité de téléchargement disponible dans la version complète');
  };

  const renderDocumentContent = () => {
    switch (documentInfo.type) {
      case 'pdf':
        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg overflow-hidden">
            <PDFViewer 
              filename={documentInfo.filename}
              citationContext={citationContext}
              onLoadStart={() => setIsLoading(true)}
              onLoadComplete={() => setIsLoading(false)}
            />
            
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto animate-pulse">
                    <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Chargement du PDF...</h3>
                    {citationContext?.page && (
                      <Badge variant="outline" className="mt-2">
                        Page {citationContext.page}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'excel':
        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg overflow-hidden">
            {/* Excel Viewer Simulation */}
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Aperçu Excel</h3>
                  <div className="mt-4 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg p-4 max-w-md">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="font-medium border-b dark:border-gray-600 pb-1 text-gray-900 dark:text-gray-100">Colonne A</div>
                      <div className="font-medium border-b dark:border-gray-600 pb-1 text-gray-900 dark:text-gray-100">Colonne B</div>
                      <div className="font-medium border-b dark:border-gray-600 pb-1 text-gray-900 dark:text-gray-100">Colonne C</div>
                      <div className="py-1 text-gray-700 dark:text-gray-300">{source.content.split(' ')[0] || 'Donnée'}</div>
                      <div className="py-1 text-gray-700 dark:text-gray-300">{source.content.split(' ')[1] || 'Valeur'}</div>
                      <div className="py-1 text-gray-700 dark:text-gray-300">{source.content.split(' ')[2] || 'Info'}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                  <p>Version démo: Aperçu simplifié des données Excel.</p>
                  <p>La version complète inclut un tableur interactif avec toutes les fonctionnalités.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'word':
        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg overflow-auto">
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Document Word</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Extrait du contenu</p>
                  </div>
                </div>
                
                <div className="prose prose-sm max-w-none">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-3 mb-4">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <strong>Texte mis en évidence :</strong> "{highlightText || source.content.substring(0, 50)}..."
                    </p>
                  </div>
                  
                  <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {source.content.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-3">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-600 pt-4">
                  <p>Version démo: Contenu textuel extrait du document Word.</p>
                  <p>La version complète préserve la mise en forme originale et les éléments visuels.</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <div className="text-center space-y-4">
              <File className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Type de fichier non supporté</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Contenu disponible en mode texte uniquement
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderMetadataPanel = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Informations du document</h4>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Nom:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{documentInfo.filename}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Type:</span>
            <Badge variant="outline" className={getTypeColor(documentInfo.type)}>
              {documentInfo.type.toUpperCase()}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Taille:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{documentInfo.size}</span>
          </div>
          {documentInfo.pages && documentInfo.pages > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Pages:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{documentInfo.pages}</span>
            </div>
          )}
        </div>
      </div>

      {citationContext && (
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Contexte de citation</h4>
          <div className="space-y-3">
            {citationContext.page && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Page référencée:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">Page {citationContext.page}</span>
              </div>
            )}
            {citationContext.confidence && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fiabilité:</span>
                <Badge 
                  variant="outline" 
                  className={citationContext.confidence > 0.8 ? 'text-green-600' : 'text-orange-600'}
                >
                  {Math.round(citationContext.confidence * 100)}%
                </Badge>
              </div>
            )}
            {citationContext.section && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Section:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{citationContext.section}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Extrait référencé</h4>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            "{source.content}"
          </p>
        </div>
      </div>
    </div>
  );

  const renderSearchPanel = () => (
    <div className="space-y-4">
      <div className="text-center py-8">
        <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h4 className="font-medium text-gray-900 mb-2">Recherche dans le document</h4>
        <p className="text-sm text-gray-500 mb-4">
          Disponible dans la version complète
        </p>
        <div className="text-xs text-gray-400 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 mb-1">Version démo</p>
              <p className="text-blue-700">
                La recherche complète dans les documents avec navigation, 
                surlignage avancé et export des résultats est disponible 
                dans la version complète.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  const Icon = getDocumentIcon(documentInfo.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "transition-all duration-300 p-0",
          isFullscreen 
            ? "max-w-[95vw] max-h-[95vh] w-full h-full" 
            : "max-w-6xl max-h-[85vh] w-full"
        )}
      >
        <DialogHeader className="border-b dark:border-gray-600 pb-4 px-6 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", getTypeColor(documentInfo.type))}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {documentInfo.filename}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={getTypeColor(documentInfo.type)}>
                    {documentInfo.type.toUpperCase()}
                  </Badge>
                  {citationContext?.confidence && (
                    <Badge variant="outline" className="text-xs">
                      Fiabilité: {Math.round(citationContext.confidence * 100)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" /> : <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "flex h-full",
          isFullscreen ? "min-h-[calc(95vh-140px)]" : "min-h-[500px]"
        )}>
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
              <div className="flex items-center gap-2">
                {/* Document type indicator */}
                <div className={cn("px-2 py-1 rounded text-xs font-medium", getTypeColor(documentInfo.type))}>
                  {documentInfo.type.toUpperCase()}
                </div>
              </div>

              {documentInfo.pages && documentInfo.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {currentPage} / {documentInfo.pages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(documentInfo.pages!, prev + 1))}
                    disabled={currentPage >= documentInfo.pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyText}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Document Content */}
            <div 
              ref={previewRef}
              className="flex-1 overflow-auto"
            >
              {renderDocumentContent()}
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 border-l bg-gray-50 dark:bg-gray-800 dark:border-gray-600 flex flex-col">
            {/* Side Panel Tabs */}
            <div className="flex border-b dark:border-gray-600">
              {[
                { id: 'content', label: 'Contenu', icon: Eye },
                { id: 'metadata', label: 'Infos', icon: Info }
              ].map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  onClick={() => setPreviewMode(id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 text-sm transition-colors",
                    previewMode === id
                      ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  <TabIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Side Panel Content */}
            <div className="flex-1 overflow-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewMode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {previewMode === 'metadata' && renderMetadataPanel()}
                  {previewMode === 'content' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Extrait cité</h4>
                        <div className="p-3 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            "{source.content}"
                          </p>
                        </div>
                      </div>
                      
                      {highlightText && (
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Texte mis en évidence</h5>
                          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              "{highlightText}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}