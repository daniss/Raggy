'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  File, 
  Trash2, 
  Eye, 
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadApi } from '@/utils/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useRetry } from '@/hooks/useRetry';

interface DocumentInfo {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  chunks_count: number;
  status: 'processing' | 'completed' | 'error';
  upload_date: string;
  error_message?: string;
}


export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  
  const [optimisticUploads, setOptimisticUploads] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use retry hook for document fetching
  const { retry: retryFetchDocuments, isRetrying } = useRetry();
  
  // Polling for processing documents
  useEffect(() => {
    const processingDocs = documents.filter(doc => doc.status === 'processing');
    if (processingDocs.length === 0) return;
    
    // Poll every 5 seconds for processing documents
    const pollInterval = setInterval(() => {
      pollDocuments();
    }, 5000);
    
    return () => clearInterval(pollInterval);
  }, [documents]);
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch documents from API
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await uploadApi.listDocuments({
        page: currentPage,
        page_size: pageSize,
        search: debouncedSearchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      
      if (response.documents) {
        setDocuments(response.documents);
        setTotalPages(response.pagination.total_pages);
        setTotalCount(response.pagination.total_count);
      } else {
        // Fallback for old API response format
        setDocuments(response || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Polling function that doesn't affect loading state
  const pollDocuments = async () => {
    try {
      const response = await uploadApi.listDocuments({
        page: currentPage,
        page_size: pageSize,
        search: debouncedSearchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      
      if (response.documents) {
        setDocuments(response.documents);
        setTotalPages(response.pagination.total_pages);
        setTotalCount(response.pagination.total_count);
      } else {
        // Fallback for old API response format
        setDocuments(response || []);
      }
    } catch (err) {
      // Silent error handling for polling - don't disrupt user experience
      console.error('Polling failed (silent):', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [currentPage, debouncedSearchTerm, statusFilter, pageSize]);

  // File upload handling
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const validTypes = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB max
    });

    if (validFiles.length !== fileArray.length) {
      alert('Certains fichiers ont été ignorés (format non supporté ou taille > 10MB)');
    }

    validFiles.forEach(file => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create optimistic document entry
      const optimisticDoc: DocumentInfo = {
        id: tempId,
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
        chunks_count: 0,
        status: 'processing',
        upload_date: new Date().toISOString(),
      };
      
      // Add directly to documents list
      setDocuments(prev => [optimisticDoc, ...prev]);
      setOptimisticUploads(prev => new Set(prev).add(tempId));
      
      uploadFile(file, optimisticDoc);
    });
  }, []);

  const uploadFile = async (file: File, optimisticDoc: DocumentInfo) => {
    try {
      setUploadError(null);
      
      // Upload using real API (returns immediately with background job queued)
      const result = await uploadApi.uploadDocuments([file]);
      
      // Update the optimistic entry with processing status (already set)
      // The real document will appear when fetchDocuments() is called via polling
      // Remove the optimistic flag after successful upload
      setOptimisticUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(optimisticDoc.id);
        return newSet;
      });
      
      // Start polling for the real document to replace the optimistic one
      setTimeout(() => {
        fetchDocuments().then(() => {
          // Remove optimistic document after real one is loaded
          setDocuments(prev => prev.filter(doc => doc.id !== optimisticDoc.id));
        });
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      
      // Update the optimistic document to show error
      setDocuments(prev => prev.map(doc => 
        doc.id === optimisticDoc.id ? {
          ...doc,
          status: 'error',
          error_message: errorMessage
        } : doc
      ));
      
      // Remove from optimistic set
      setOptimisticUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(optimisticDoc.id);
        return newSet;
      });
    }
  };


  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Utility functions
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      processing: 'secondary', 
      error: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status === 'completed' ? 'Terminé' : 
         status === 'processing' ? 'En cours' : 
         status === 'error' ? 'Erreur' : status}
      </Badge>
    );
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await uploadApi.deleteDocument(id);
        // Clear selected documents immediately
        setSelectedDocuments(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        // Refresh documents list from server to ensure consistency
        await fetchDocuments();
        setError(null);
      } catch (error) {
        console.error('Failed to delete document:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
        setError(errorMessage);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;
    
    const count = selectedDocuments.size;
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${count} document${count > 1 ? 's' : ''} ?`)) {
      const deletePromises = Array.from(selectedDocuments).map(id => 
        uploadApi.deleteDocument(id).catch(err => ({ id, error: err }))
      );
      
      try {
        const results = await Promise.allSettled(deletePromises);
        const failedDeletes = results
          .filter((result, index) => result.status === 'rejected')
          .map((_, index) => Array.from(selectedDocuments)[index]);
        
        if (failedDeletes.length > 0) {
          setError(`Échec de suppression de ${failedDeletes.length} document(s)`);
        }
        
        // Clear selection first
        setSelectedDocuments(new Set(failedDeletes));
        
        // Refresh documents list from server to ensure consistency
        await fetchDocuments();
        
        if (failedDeletes.length === 0) {
          setError(null);
        }
      } catch (error) {
        console.error('Bulk delete failed:', error);
        setError('Erreur lors de la suppression en masse');
      }
    }
  };

  const handleSelectDocument = (id: string, checked: boolean) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
    } else {
      setSelectedDocuments(new Set());
    }
    setIsSelectAll(checked);
  };

  // Update select all state when selection changes
  React.useEffect(() => {
    const visibleIds = new Set(filteredDocuments.map(doc => doc.id));
    const selectedVisibleIds = Array.from(selectedDocuments).filter(id => visibleIds.has(id));
    setIsSelectAll(selectedVisibleIds.length === filteredDocuments.length && filteredDocuments.length > 0);
  }, [selectedDocuments, filteredDocuments]);
  
  const handleRetryFetch = () => {
    retryFetchDocuments(fetchDocuments);
  };

  return (
    <div className="space-y-6 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">
            Gérez vos documents et alimentez la base de connaissances
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleRetryFetch}
            disabled={loading || isRetrying}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(loading || isRetrying) ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Ajouter Documents
          </Button>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <ErrorAlert 
          title="Erreur de chargement"
          message={error}
          onDismiss={() => setError(null)}
          action={{
            label: "Réessayer",
            onClick: handleRetryFetch
          }}
        />
      )}
      
      {/* Upload Error Alert */}
      {uploadError && (
        <ErrorAlert 
          title="Erreur de téléchargement"
          message={uploadError}
          onDismiss={() => setUploadError(null)}
        />
      )}

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-accent bg-accent/10' 
                : 'border-gray-300 hover:border-accent/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">
              Glissez-déposez vos fichiers ici
            </h3>
            <p className="text-gray-500 mb-4">
              ou cliquez pour sélectionner des fichiers
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              Sélectionner Fichiers
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              Formats: PDF, DOC, DOCX, TXT, MD, CSV • Taille max: 10MB
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.csv"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </CardContent>
      </Card>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold">{totalCount || documents.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chunks Total</p>
                <p className="text-2xl font-bold">
                  {documents.reduce((sum, doc) => sum + doc.chunks_count, 0)}
                </p>
              </div>
              <File className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taille Totale</p>
                <p className="text-2xl font-bold">
                  {formatFileSize(documents.reduce((sum, doc) => sum + doc.size_bytes, 0))}
                </p>
              </div>
              <Download className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Traitement</p>
                <p className="text-2xl font-bold">
                  {documents.filter(doc => doc.status === 'processing').length}
                </p>
              </div>
              <RefreshCw className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher des documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="completed">Terminés</SelectItem>
                <SelectItem value="processing">En cours</SelectItem>
                <SelectItem value="error">Erreurs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Documents</CardTitle>
            {selectedDocuments.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''} sélectionné{selectedDocuments.size > 1 ? 's' : ''}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer la sélection
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">
                {isRetrying ? 'Rechargement en cours...' : 'Chargement des documents...'}
              </span>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                Aucun document trouvé
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Aucun document ne correspond à vos critères de recherche.' 
                  : 'Commencez par télécharger vos premiers documents.'}
              </p>
              {(searchTerm || statusFilter !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  Effacer les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isSelectAll}
                    onCheckedChange={handleSelectAll}
                    aria-label="Sélectionner tous les documents"
                  />
                </TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => {
                const isOptimistic = optimisticUploads.has(doc.id);
                return (
                  <TableRow 
                    key={doc.id} 
                    className={`${selectedDocuments.has(doc.id) ? 'bg-blue-50' : ''} ${isOptimistic ? 'opacity-75 animate-pulse' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedDocuments.has(doc.id)}
                        onCheckedChange={(checked: boolean) => handleSelectDocument(doc.id, checked)}
                        aria-label={`Sélectionner ${doc.filename}`}
                        disabled={isOptimistic}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(doc.status)}
                        <div>
                          <div className="font-medium">
                            {doc.filename}
                            {isOptimistic && (
                              <span className="ml-2 text-xs text-blue-500">
                                (téléchargement...)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {doc.content_type.split('/')[1]?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(doc.status)}
                    </TableCell>
                    <TableCell>{formatFileSize(doc.size_bytes)}</TableCell>
                    <TableCell>{doc.chunks_count}</TableCell>
                    <TableCell>{formatDate(doc.upload_date)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDocument(doc)}
                          disabled={isOptimistic}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={isOptimistic}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Page {currentPage} sur {totalPages} ({totalCount} documents)
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Modal */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Aperçu du Document</DialogTitle>
            <DialogDescription>
              {selectedDocument?.filename}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Fichier:</strong> {selectedDocument.filename}</div>
                <div><strong>Type:</strong> {selectedDocument.content_type}</div>
                <div><strong>Taille:</strong> {formatFileSize(selectedDocument.size_bytes)}</div>
                <div><strong>Chunks:</strong> {selectedDocument.chunks_count}</div>
                <div><strong>Statut:</strong> {selectedDocument.status}</div>
                <div><strong>Date:</strong> {formatDate(selectedDocument.upload_date)}</div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                <h4 className="font-medium mb-2">Contenu du document:</h4>
                <p className="text-sm text-gray-600">
                  [Aperçu du contenu serait affiché ici...]
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}