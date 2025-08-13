'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateUploadProps {
  onUploadClick: () => void;
  onFileSelect?: (file: File) => Promise<void>;
  uploading?: boolean;
  className?: string;
}

export default function EmptyStateUpload({ 
  onUploadClick, 
  onFileSelect, 
  uploading = false,
  className = "" 
}: EmptyStateUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && onFileSelect) {
      try {
        setUploadStatus('uploading');
        await onFileSelect(file);
        setUploadStatus('success');
        setTimeout(() => setUploadStatus('idle'), 3000);
      } catch (error) {
        setUploadStatus('error');
        setTimeout(() => setUploadStatus('idle'), 5000);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      try {
        setUploadStatus('uploading');
        await onFileSelect(file);
        setUploadStatus('success');
        setTimeout(() => setUploadStatus('idle'), 3000);
      } catch (error) {
        setUploadStatus('error');
        setTimeout(() => setUploadStatus('idle'), 5000);
      }
    }
  };

  const isActive = uploadStatus === 'uploading' || uploading;
  const isSuccess = uploadStatus === 'success';
  const isError = uploadStatus === 'error';

  return (
    <Card className={`${className} ${isDragOver ? 'border-blue-400 bg-blue-50' : ''}`}>
      <CardContent className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center ${isDragOver ? 'scale-105' : ''} transition-transform duration-200`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Icon */}
          <div className="mb-4">
            {isSuccess ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors ${
                isDragOver 
                  ? 'bg-blue-100' 
                  : isError 
                    ? 'bg-red-100'
                    : 'bg-gray-100'
              }`}>
                <Upload className={`w-8 h-8 ${
                  isDragOver 
                    ? 'text-blue-600' 
                    : isError 
                      ? 'text-red-600'
                      : 'text-gray-400'
                } ${isActive ? 'animate-bounce' : ''}`} />
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isSuccess 
              ? 'Document importé avec succès !' 
              : isError
                ? 'Erreur lors de l\'import'
                : 'Aucun document encore'
            }
          </h3>

          {/* Description */}
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {isSuccess 
              ? 'Votre document est en cours de traitement et sera bientôt disponible pour l\'assistant.'
              : isError
                ? 'Une erreur s\'est produite. Veuillez réessayer avec un autre fichier.'
                : 'Importez un fichier pour activer l\'assistant et obtenir vos premières réponses.'
            }
          </p>

          {!isSuccess && (
            <>
              {/* Primary CTA */}
              <Button
                size="lg"
                onClick={() => {
                  if (onFileSelect) {
                    fileInputRef.current?.click();
                  } else {
                    onUploadClick();
                  }
                }}
                disabled={isActive}
                className="mb-4"
              >
                <Upload className="w-5 h-5 mr-2" />
                {isActive ? 'Import en cours...' : 'Importer des documents'}
              </Button>

              {/* Drag & Drop Zone */}
              <div className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <FileText className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  ou glissez-déposez un fichier ici
                </p>
              </div>

              {/* Helper Link */}
              <button
                onClick={() => window.open('/docs/formats-supportes', '_blank')}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
              >
                Formats supportés: PDF, DOCX, TXT, CSV
                <ExternalLink className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Hidden file input */}
          {onFileSelect && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
              onChange={handleFileInputChange}
              className="hidden"
            />
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
}