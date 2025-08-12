'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload,
  FileText,
  ArrowLeft,
  MessageCircle,
  Info,
  Clock,
  Shield,
  AlertCircle,
  Brain,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

interface DemoSession {
  token: string;
  email: string;
  company: string;
  documents?: any[];
  sampleQuestions?: string[];
  expiresAt: number;
}

export default function DemoUploadPage() {
  const router = useRouter();
  const [demoSession, setDemoSession] = useState<DemoSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pre-loaded demo documents
  const demoDocuments = [
    { name: 'Guide_Conformite_RGPD.pdf', size: '2.3 MB', type: 'Juridique' },
    { name: 'Manuel_Procedures_RH_2024.pdf', size: '1.8 MB', type: 'RH' },
    { name: 'Contrat_Type_Client.docx', size: '156 KB', type: 'Commercial' },
    { name: 'Analyse_Fiscale_2024.xlsx', size: '789 KB', type: 'Finance' },
    { name: 'Documentation_Technique_Produit.pdf', size: '4.2 MB', type: 'Technique' }
  ];

  useEffect(() => {
    checkDemoSession();
  }, []);

  const checkDemoSession = () => {
    try {
      const storedSession = localStorage.getItem('demoSession');
      if (!storedSession) {
        // No session, redirect to demo page
        router.push('/demo');
        return;
      }

      const session = JSON.parse(storedSession);
      
      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem('demoSession');
        router.push('/demo');
        return;
      }

      setDemoSession(session);
      loadUploadedFiles(session.token);
    } catch (error) {
      console.error('Error checking demo session:', error);
      localStorage.removeItem('demoSession');
      router.push('/demo');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUploadedFiles = async (sessionToken: string) => {
    try {
      const response = await fetch('/api/backend/demo/documents', {
        headers: {
          'X-Demo-Session': sessionToken
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUploadedFiles(data.user_uploaded_documents || []);
      }
    } catch (error) {
      console.error('Error loading uploaded files:', error);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!demoSession || !files.length) return;
    
    // Check demo limits
    if (uploadedFiles.length >= 3) {
      setUploadError('Limite de 3 fichiers atteinte pour la démo');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length && uploadedFiles.length + i < 3; i++) {
        const file = files[i];
        
        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`Fichier ${file.name} trop volumineux (max 10MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/backend/demo/upload', {
          method: 'POST',
          headers: {
            'X-Demo-Session': demoSession.token
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Upload successful:', result);
          
          // Reload uploaded files
          await loadUploadedFiles(demoSession.token);
        } else {
          const error = await response.json();
          setUploadError(error.detail || `Erreur lors de l'upload de ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Erreur lors de l\'upload des fichiers');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFileUpload(files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Vérification de votre session...</p>
        </div>
      </div>
    );
  }

  if (!demoSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Session requise</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Vous devez d'abord créer une session de démo.</p>
          <Link href="/demo">
            <Button>Créer une session de démo</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate remaining time
  const remainingTime = Math.max(0, demoSession.expiresAt - Date.now());
  const hoursRemaining = Math.floor(remainingTime / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur sticky top-0 z-50 border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour à l'accueil</span>
            </Link>
            
            <div className="flex-1 flex items-center justify-center">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Documents - Démo {demoSession.company}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="default" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800">
                <Clock className="w-3 h-3 mr-1" />
                {hoursRemaining}h {minutesRemaining}min
              </Badge>
              <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                <Shield className="w-3 h-3 mr-1" />
                Données sécurisées
              </Badge>
              <ThemeToggle variant="minimal" size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Session Status */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Badge variant="default" className="text-lg px-4 py-2 bg-green-100 text-green-800 hover:bg-green-200">
                  <Brain className="w-4 h-4 mr-2" />
                  Session active pour {demoSession.company}
                </Badge>
              </div>
              <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Gestion des documents
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Consultez les documents pré-chargés et ajoutez les vôtres
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Documents Section */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-blue-600" />
                      Documents disponibles
                    </div>
                    <Badge variant="default" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
                      {demoDocuments.length} fichiers
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Base documentaire pré-configurée avec corpus français
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {demoDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{doc.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{doc.size}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {doc.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Upload section */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Ajoutez vos propres documents</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Glissez-déposez ou cliquez pour sélectionner vos fichiers
                      </p>
                      
                      {/* Error message */}
                      {uploadError && (
                        <Alert className="mb-4">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription>
                            {uploadError}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Upload Area */}
                      <div 
                        className={`border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer relative ${
                          isUploading 
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
                        }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => document.getElementById('file-input')?.click()}
                      >
                        <input
                          id="file-input"
                          type="file"
                          multiple
                          accept=".pdf,.docx,.txt,.csv"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isUploading || uploadedFiles.length >= 3}
                        />
                        
                        {isUploading ? (
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            <p className="text-sm text-blue-600 dark:text-blue-400">Upload en cours...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              Cliquez ici ou glissez-déposez vos fichiers
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={uploadedFiles.length >= 3}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Sélectionner des fichiers
                            </Button>
                          </>
                        )}
                      </div>
                      
                      {/* Uploaded files */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="font-medium text-sm text-left text-gray-900 dark:text-gray-100">Vos fichiers uploadés:</h4>
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                                  <FileText className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.filename}</span>
                              </div>
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                {file.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div>• Formats supportés: PDF, DOCX, TXT, CSV</div>
                        <div>• Taille max: 10 MB par fichier</div>
                        <div>• Limite démo: 3 fichiers maximum ({uploadedFiles.length}/3 utilisés)</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions Sidebar */}
              <div className="space-y-6">
                {/* Chat Action */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
                      Assistant IA
                    </CardTitle>
                    <CardDescription>
                      Posez vos questions sur les documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      asChild
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <Link href="/demo-assistant">
                        <MessageCircle className="mr-2 w-4 h-4" />
                        Ouvrir le chat
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Session Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Votre session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Entreprise:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{demoSession.company}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Email:</span>
                        <span className="font-medium text-xs text-gray-900 dark:text-gray-100">{demoSession.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Expire dans:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {hoursRemaining}h {minutesRemaining}min
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          <div>• Questions illimitées</div>
                          <div>• 5 documents pré-chargés</div>
                          <div>• Upload limité (3 fichiers max)</div>
                          <div>• Support chat inclus</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Access */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Accès rapide</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/demo-assistant">
                        <Play className="w-4 h-4 mr-2" />
                        Assistant IA
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Demo Limitations */}
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                <strong>Limitations de la démo :</strong> Upload limité à 3 fichiers • 
                100 questions max • Données supprimées après 24h • 
                Pour une version complète, <Link href="/#contact" className="underline">contactez-nous</Link>
              </AlertDescription>
            </Alert>

            {/* Call to Action */}
            <div className="text-center pt-8 border-t">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Convaincu par la démo ?
              </p>
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => window.location.href = `mailto:contact@raggy.fr?subject=Export démo ${demoSession.company}`}>
                  <FileText className="mr-2 w-4 h-4" />
                  Exporter la conversation
                </Button>
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  onClick={() => window.location.href = `mailto:contact@raggy.fr?subject=Devis pour ${demoSession.company}`}
                >
                  Demander un devis
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}