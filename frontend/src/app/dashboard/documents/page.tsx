'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { dashboardApi, type Document } from '@/utils/dashboard-api';
import { useAuth } from '@/contexts/AuthContext';
import { uploadApi, handleApiError } from '@/utils/api';
import DocumentToolbar from '@/components/DocumentToolbar';
import EmptyStateUpload from '@/components/EmptyStateUpload';
import IndexSummary from '@/components/IndexSummary';

export default function DocumentsPage() {
  const { session, signOut } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await dashboardApi.getDocumentsFromSupabase();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Impossible de charger les documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file);
    } catch (error) {
      // Error is already handled in uploadFile, just prevent propagation
      console.log('File upload handled with error:', error);
    }
  };

  const uploadFile = async (file: File) => {
    console.log('🚀 DASHBOARD UPLOAD START:', file.name);
    
    // Clear previous messages
    setError(null);
    setSuccessMessage(null);

    // Check authentication - dashboard requires valid session
    console.log('🔍 Session check:', { 
      hasSession: !!session, 
      hasToken: !!session?.access_token,
      tokenLength: session?.access_token?.length,
      userId: session?.user?.id
    });
    
    if (!session || !session.access_token) {
      console.error('❌ NO VALID SESSION - signing out');
      setError('Session expirée. Veuillez vous reconnecter.');
      await signOut();
      return;
    }

    setUploading(true);
    
    try {
      console.log('✅ SESSION VALID - proceeding with upload');
      // Use authenticated upload for dashboard
      await uploadApi.uploadDocuments([file]);
      setSuccessMessage(`Document "${file.name}" téléchargé avec succès !`);

      // Reload documents after successful upload
      await loadDocuments();
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('❌ DASHBOARD UPLOAD FAILED:', err);
      const errorMessage = handleApiError(err);
      
      // Handle authentication errors
      if (errorMessage.includes('Session expirée') || errorMessage.includes('401')) {
        await signOut();
        return;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage); // Re-throw with processed error message for EmptyStateUpload
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': 
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing': 
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed': 
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: 
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-700 border-green-300 text-xs px-2 py-0">Prêt</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-2 py-0">Traitement</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-300 text-xs px-2 py-0">Échec</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0">Inconnu</Badge>;
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSize = documents.reduce((sum, doc) => sum + doc.size_mb, 0);
  const readyDocs = documents.filter(doc => doc.status === 'ready').length;
  const processingDocs = documents.filter(doc => doc.status === 'processing').length;
  const isAssistantReady = readyDocs > 0;
  const lastUpdate = documents.length > 0 ? 
    new Date(Math.max(...documents.map(d => new Date(d.updated_at).getTime()))).toISOString() : 
    null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Gérez votre base de connaissances</p>
        </div>
      </div>

      {/* Index Summary when documents exist */}
      {documents.length > 0 && (
        <IndexSummary
          docsReady={readyDocs}
          totalDocs={documents.length}
          lastUpdate={lastUpdate}
          assistantOk={isAssistantReady}
          processingCount={processingDocs}
          totalSizeMB={totalSize}
        />
      )}

      {/* Document Toolbar */}
      <DocumentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onRefreshClick={loadDocuments}
        onAddDocumentClick={() => fileInputRef.current?.click()}
        isRefreshing={loading}
        isUploading={uploading}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Success Alert */}
      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-2 p-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-700">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Documents List or Empty State */}
      {documents.length === 0 ? (
        <EmptyStateUpload 
          onUploadClick={() => fileInputRef.current?.click()}
          onFileSelect={uploadFile}
          uploading={uploading}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Documents ({filteredDocuments.length})
              {searchTerm && ` • Recherche: "${searchTerm}"`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">Aucun document trouvé</p>
                <p className="text-sm text-gray-500">
                  Essayez un autre terme de recherche
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 truncate max-w-sm">{doc.filename}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>{doc.size_mb.toFixed(1)} MB</span>
                          <span>{new Date(doc.updated_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusIcon(doc.status)}
                      {getStatusBadge(doc.status)}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}