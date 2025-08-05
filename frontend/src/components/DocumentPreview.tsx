'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Download, 
  Calendar, 
  FileType, 
  Hash,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { documentApi } from '@/utils/api';

interface DocumentPreviewProps {
  document: any;
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentContent {
  id: string;
  filename: string;
  content: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  metadata: any;
  chunks?: Array<{
    id: string;
    content: string;
    chunk_index: number;
  }>;
}

export default function DocumentPreview({ document, isOpen, onClose }: DocumentPreviewProps) {
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<'content' | 'chunks'>('content');

  useEffect(() => {
    if (isOpen && document) {
      loadDocumentContent();
    }
  }, [isOpen, document]);

  const loadDocumentContent = async () => {
    if (!document?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Get document details and content
      const [docResponse, chunksResponse] = await Promise.all([
        documentApi.getDocument(document.id),
        documentApi.getDocumentChunks(document.id)
      ]);

      setDocumentContent({
        ...docResponse,
        chunks: chunksResponse
      });
    } catch (err) {
      console.error('Failed to load document content:', err);
      setError('Impossible de charger le contenu du document');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = async () => {
    if (!documentContent) return;

    try {
      const response = await documentApi.downloadDocument(documentContent.id);
      const blob = new Blob([response], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentContent.filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download document:', err);
    }
  };

  const nextChunk = () => {
    if (documentContent?.chunks && currentChunk < documentContent.chunks.length - 1) {
      setCurrentChunk(currentChunk + 1);
    }
  };

  const prevChunk = () => {
    if (currentChunk > 0) {
      setCurrentChunk(currentChunk - 1);
    }
  };

  const adjustZoom = (delta: number) => {
    setZoom(Math.max(50, Math.min(200, zoom + delta)));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {document?.filename || 'Document'}
                </h2>
                {documentContent && (
                  <p className="text-sm text-gray-500">
                    {formatFileSize(documentContent.file_size)} • {documentContent.file_type.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-md overflow-hidden border">
                <Button
                  variant={viewMode === 'content' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('content')}
                  className="rounded-none"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Contenu
                </Button>
                <Button
                  variant={viewMode === 'chunks' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('chunks')}
                  className="rounded-none"
                >
                  <Hash className="w-4 h-4 mr-1" />
                  Segments
                </Button>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => adjustZoom(-10)}
                  disabled={zoom <= 50}
                  className="rounded-none"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="px-2 text-sm font-medium">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => adjustZoom(10)}
                  disabled={zoom >= 200}
                  className="rounded-none"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              {/* Download button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!documentContent}
              >
                <Download className="w-4 h-4 mr-1" />
                Télécharger
              </Button>

              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar with metadata */}
            <div className="w-80 border-r bg-gray-50 p-4 flex flex-col">
              <div className="space-y-4">
                {/* Document Info */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Informations</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {documentContent ? formatDate(documentContent.upload_date) : 'Chargement...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileType className="w-4 h-4 text-gray-400" />
                      <Badge variant="secondary">
                        {documentContent?.file_type?.toUpperCase() || document?.file_type?.toUpperCase() || 'PDF'}
                      </Badge>
                    </div>
                    {documentContent?.chunks && (
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {documentContent.chunks.length} segments
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chunk navigation for chunks view */}
                {viewMode === 'chunks' && documentContent?.chunks && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Navigation</h3>
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prevChunk}
                        disabled={currentChunk === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        {currentChunk + 1} / {documentContent.chunks.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextChunk}
                        disabled={currentChunk === documentContent.chunks.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Segment {documentContent.chunks[currentChunk]?.chunk_index + 1}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {documentContent?.metadata && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Métadonnées</h3>
                    <div className="space-y-1 text-xs">
                      {Object.entries(documentContent.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500 capitalize">{key}:</span>
                          <span className="text-gray-700 font-mono">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="mt-4 text-gray-600">Chargement du document...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-red-600">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDocumentContent}
                      className="mt-4"
                    >
                      <RotateCw className="w-4 h-4 mr-1" />
                      Réessayer
                    </Button>
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div 
                    className="p-6"
                    style={{ fontSize: `${zoom}%` }}
                  >
                    {viewMode === 'content' ? (
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                          {documentContent?.content || 'Aucun contenu disponible'}
                        </pre>
                      </div>
                    ) : (
                      documentContent?.chunks && documentContent.chunks.length > 0 ? (
                        <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Hash className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-900">
                                Segment {documentContent.chunks[currentChunk]?.chunk_index + 1}
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                              {documentContent.chunks[currentChunk]?.content}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Aucun segment disponible</p>
                        </div>
                      )
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}