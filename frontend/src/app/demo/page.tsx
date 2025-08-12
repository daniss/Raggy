'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Info,
  Play,
  Clock,
  Shield,
  Sparkles,
  FileText,
  Brain,
  Upload,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DemoPage() {
  const router = useRouter();
  const [demoStep, setDemoStep] = useState<'welcome' | 'email'>('welcome');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkExistingSession = useCallback(async () => {
    try {
      const storedSession = localStorage.getItem('demoSession');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        
        // Check if session is still valid
        if (Date.now() < session.expiresAt) {
          // Session is valid, set flag to redirect
          setShouldRedirect(true);
          return;
        } else {
          // Session expired, remove it
          localStorage.removeItem('demoSession');
        }
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
      localStorage.removeItem('demoSession');
    } finally {
      // Use setTimeout to ensure setState happens in next tick
      setTimeout(() => {
        setIsCheckingSession(false);
      }, 0);
    }
  }, []);

  // Check for existing demo session on mount
  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  // Handle redirect in a separate effect to avoid setState during render
  useEffect(() => {
    if (shouldRedirect) {
      router.push('/demo-assistant');
    }
  }, [shouldRedirect, router]);

  const handleStartDemo = async () => {
    if (demoStep === 'email' && email && company) {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/demo/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            company_name: company,
            source: 'landing',
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
            utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
            utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
          }),
        });

        if (!response.ok) {
          // Handle specific validation errors from backend
          if (response.status === 400) {
            const errorData = await response.json();
            setError(errorData.error || errorData.detail || 'Erreur de validation');
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          // Store demo session and redirect to assistant
          localStorage.setItem('demoSession', JSON.stringify({
            token: data.session_token,
            email,
            company,
            documents: data.demo_documents,
            sampleQuestions: data.sample_questions,
            expiresAt: new Date(data.expires_at).getTime()
          }));
          
          // Redirect directly to demo assistant
          router.push('/demo-assistant');
        } else {
          throw new Error(data.message || 'Failed to create demo session');
        }
      } catch (error) {
        console.error('Demo registration failed:', error);
        setError('Une erreur est survenue lors de la création de votre session de démo. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    }
  };


  // Show loading while checking for existing session or redirecting
  if (isCheckingSession || shouldRedirect) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">
            {shouldRedirect ? 'Redirection vers votre démo...' : 'Vérification de votre session...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                Démo 24h
              </Badge>
              <Badge variant="outline">
                <Shield className="w-3 h-3 mr-1" />
                Données sécurisées
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {demoStep === 'welcome' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Brain className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h1 className="text-4xl font-bold mb-4">
                  Découvrez Raggy en action
                </h1>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Testez notre solution RAG avec des documents pré-chargés en français.
                  Posez vos questions et obtenez des réponses instantanées avec sources.
                </p>
              </div>

              <Card className="border-2 border-blue-100">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle>Ce que vous allez découvrir</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3">
                      <Upload className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-medium">Documents pré-chargés</p>
                        <p className="text-sm text-slate-600">
                          5 documents types d'entreprise déjà intégrés
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MessageCircle className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-medium">Chat intelligent</p>
                        <p className="text-sm text-slate-600">
                          Posez vos questions en français naturel
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-medium">Sources citées</p>
                        <p className="text-sm text-slate-600">
                          Chaque réponse référence les documents sources
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Clock className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-medium">Réponses &lt; 2s</p>
                        <p className="text-sm text-slate-600">
                          Performance temps réel garantie
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center">
                <Button 
                  size="lg"
                  onClick={() => setDemoStep('email')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <Play className="mr-2 w-4 h-4" />
                  Commencer la démo gratuite
                </Button>
                <p className="text-sm text-slate-500 mt-4">
                  Aucune carte bancaire • Session 24h • <span className="font-medium text-blue-600">Revenez quand vous voulez</span>
                </p>
              </div>
            </motion.div>
          )}

          {demoStep === 'email' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-4">
                  Créez votre environnement de démo
                </h2>
                <p className="text-lg text-slate-600">
                  Renseignez vos informations pour accéder à votre sandbox personnalisé
                </p>
              </div>

              <Card className="max-w-md mx-auto">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email professionnel
                      </label>
                      <Input
                        type="email"
                        placeholder="vous@entreprise.fr"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null); // Clear error when user starts typing
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Nom de votre entreprise
                      </label>
                      <Input
                        type="text"
                        placeholder="Votre Entreprise SARL"
                        value={company}
                        onChange={(e) => {
                          setCompany(e.target.value);
                          if (error) setError(null); // Clear error when user starts typing
                        }}
                      />
                    </div>
                    
                    <Alert>
                      <Info className="w-4 h-4" />
                      <AlertDescription>
                        Vos données sont utilisées uniquement pour personnaliser 
                        votre démo et sont automatiquement supprimées après 24h.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      className="w-full"
                      onClick={handleStartDemo}
                      disabled={!email || !company || isLoading}
                    >
                      {isLoading ? 'Création...' : 'Accéder à ma démo'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Demo Navigation - Only show if user might have a session */}
          {demoStep === 'welcome' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 pt-8 border-t"
            >
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Vous avez déjà une session de démo ?
                </h3>
                <p className="text-slate-600">
                  Accédez directement aux fonctionnalités de votre démo
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                <Button variant="outline" asChild>
                  <Link href="/demo-assistant">
                    <Play className="mr-2 w-4 h-4" />
                    Assistant IA
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/demo/upload">
                    <FileText className="mr-2 w-4 h-4" />
                    Gérer les documents
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}