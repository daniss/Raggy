'use client';

import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  File, 
  Search,
  Upload,
  FolderOpen,
  ChevronRight,
  Clock,
  Loader2,
  Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { uploadApi, handleApiError } from '@/utils/api';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  chunks_count: number;
  upload_date: string;
}

interface DocumentSidebarProps {
  onDocumentSelect?: (doc: Document) => void;
  onDocumentPreview?: (doc: Document) => void;
  selectedDocumentId?: string;
  className?: string;
}

export default function DocumentSidebar({ 
  onDocumentSelect, 
  onDocumentPreview,
  selectedDocumentId,
  className 
}: DocumentSidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await uploadApi.listDocuments({
        page: 1,
        page_size: 100,
        status: 'completed'
      });
      setDocuments(response.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) return FileText;
    if (contentType.includes('sheet') || contentType.includes('csv')) return FileSpreadsheet;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Il y a moins d\'une heure';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffHours < 48) return 'Hier';
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric',
      month: 'short'
    });
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div className={cn("bg-white border-r border-gray-200 w-16 flex flex-col", className)}>
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="transform -rotate-90 whitespace-nowrap text-sm text-gray-500">
            {documents.length} documents
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border-r border-gray-200 w-80 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Documents</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(true)}
              className="w-8 h-8"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/admin/documents'}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Document List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              variant="link"
              size="sm"
              onClick={loadDocuments}
              className="mt-2"
            >
              Réessayer
            </Button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-4 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {searchTerm ? 'Aucun document trouvé' : 'Aucun document'}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => window.location.href = '/admin/documents'}
              className="mt-2"
            >
              Ajouter des documents
            </Button>
          </div>
        ) : (
          <div className="py-2">
            {filteredDocuments.map((doc) => {
              const Icon = getFileIcon(doc.content_type);
              const isSelected = selectedDocumentId === doc.id;
              
              return (
                <div
                  key={doc.id}
                  className={cn(
                    "group px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 transition-colors",
                    isSelected && "bg-blue-50 hover:bg-blue-50"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected ? "bg-blue-100" : "bg-gray-100"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isSelected ? "text-blue-600" : "text-gray-600"
                    )} />
                  </div>
                  
                  <button
                    onClick={() => onDocumentSelect?.(doc)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isSelected ? "text-blue-900" : "text-gray-900"
                    )}>
                      {doc.filename}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatFileSize(doc.size_bytes)}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {doc.chunks_count} chunks
                      </span>
                    </div>
                    <div className="flex items-center mt-1">
                      <Clock className="w-3 h-3 text-gray-400 mr-1" />
                      <span className="text-xs text-gray-500">
                        {formatDate(doc.upload_date)}
                      </span>
                    </div>
                  </button>
                  
                  {/* Preview button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDocumentPreview?.(doc)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-8 w-8"
                    title="Prévisualiser le document"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {documents.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{documents.length} documents</span>
            <span>{formatFileSize(documents.reduce((acc, doc) => acc + doc.size_bytes, 0))} total</span>
          </div>
        </div>
      )}
    </div>
  );
}