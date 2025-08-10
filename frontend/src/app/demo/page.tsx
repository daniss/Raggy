'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain,
  Upload,
  MessageCircle,
  FileText,
  ArrowLeft,
  Info,
  Play,
  Download,
  Clock,
  Shield,
  Sparkles
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
  const [demoStep, setDemoStep] = useState<'welcome' | 'email' | 'sandbox'>('welcome');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-loaded demo documents
  const demoDocuments = [
    { name: 'Guide_Conformite_RGPD.pdf', size: '2.3 MB', type: 'Juridique' },
    { name: 'Manuel_Procedures_RH_2024.pdf', size: '1.8 MB', type: 'RH' },
    { name: 'Contrat_Type_Client.docx', size: '156 KB', type: 'Commercial' },
    { name: 'Analyse_Fiscale_2024.xlsx', size: '789 KB', type: 'Finance' },
    { name: 'Documentation_Technique_Produit.pdf', size: '4.2 MB', type: 'Technique' }
  ];

  const sampleQuestions = [
    "Quelles sont les obligations RGPD pour le traitement des données clients ?",
    "Quelle est la procédure de recrutement d'un nouveau collaborateur ?",
    "Quels sont les délais de paiement dans nos contrats types ?",
    "Comment calculer le crédit d'impôt recherche ?",
    "Quelles sont les spécifications techniques de notre produit principal ?"
  ];

  const handleStartDemo = async () => {
    if (demoStep === 'email' && email && company) {
      setIsLoading(true);
      
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
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setSessionToken(data.session_token);
          setDemoStep('sandbox');
          
          // Store demo session in localStorage for persistence
          localStorage.setItem('demoSession', JSON.stringify({
            token: data.session_token,
            email,
            company,
            documents: data.demo_documents,
            sampleQuestions: data.sample_questions,
            expiresAt: data.expires_at
          }));
        } else {
          throw new Error(data.message || 'Failed to create demo session');
        }
      } catch (error) {
        console.error('Demo registration failed:', error);
        alert('Une erreur est survenue lors de la création de votre session de démo. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleNavigateToAssistant = () => {
    // Store demo session in localStorage
    localStorage.setItem('demoSession', JSON.stringify({
      token: sessionToken,
      email,
      company,
      documents: demoDocuments,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    }));
    router.push('/assistant');
  };

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
              <Badge variant="secondary">
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
                  Aucune carte bancaire requise • Données supprimées après 24h
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
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email professionnel
                      </label>
                      <Input
                        type="email"
                        placeholder="vous@entreprise.fr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                        onChange={(e) => setCompany(e.target.value)}
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

          {demoStep === 'sandbox' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    <Brain className="w-4 h-4 mr-2" />
                    Sandbox actif pour {company}
                  </Badge>
                </div>
                <h2 className="text-3xl font-bold mb-4">
                  Votre environnement de démo est prêt !
                </h2>
                <p className="text-lg text-slate-600">
                  Documents pré-chargés et assistant IA configuré
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
                      <Badge variant="secondary">
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
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{doc.name}</div>
                              <div className="text-xs text-slate-500">{doc.size}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {doc.type}
                            </Badge>
                            <Button variant="ghost" size="sm" className="text-xs">
                              Aperçu
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Upload section for demo */}
                    <div className="mt-6 pt-4 border-t">
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 mb-2">
                          Vous pouvez également ajouter vos propres documents
                        </p>
                        <Button variant="outline" size="sm" disabled>
                          <Upload className="w-4 h-4 mr-2" />
                          Ajouter des fichiers (max 3 en démo)
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                          PDF, DOCX, TXT • Max 10 MB par fichier
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions and Actions */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
                        Questions suggérées
                      </CardTitle>
                      <CardDescription>
                        Cliquez pour tester
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {sampleQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              // This would copy the question to clipboard or navigate to assistant with pre-filled question
                              navigator.clipboard.writeText(question);
                              alert('Question copiée ! Collez-la dans l\'assistant.');
                            }}
                            className="w-full p-2 bg-blue-50 hover:bg-blue-100 rounded text-sm text-left transition-colors"
                          >
                            "{question}"
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Demo Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Votre session</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Entreprise:</span>
                          <span className="font-medium">{company}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-medium text-xs">{email}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Expire dans:</span>
                          <span className="font-medium text-green-600">23h 45min</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>• Questions illimitées</div>
                            <div>• 5 documents pré-chargés</div>
                            <div>• Upload limité (3 fichiers max)</div>
                            <div>• Support chat inclus</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="border-2 border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        Tout est prêt pour votre test !
                      </h3>
                      <p className="text-slate-600">
                        Accédez à l'assistant IA et posez vos questions sur les documents
                      </p>
                    </div>
                    <Button 
                      size="lg"
                      onClick={handleNavigateToAssistant}
                      className="bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                      <MessageCircle className="mr-2 w-4 h-4" />
                      Ouvrir l'assistant
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  <strong>Limitations de la démo :</strong> Upload limité à 3 fichiers • 
                  100 questions max • Données supprimées après 24h • 
                  Pour une version complète, <Link href="/#contact" className="underline">contactez-nous</Link>
                </AlertDescription>
              </Alert>

              <div className="text-center pt-8 border-t">
                <p className="text-slate-600 mb-4">
                  Convaincu par la démo ?
                </p>
                <div className="flex justify-center space-x-4">
                  <Button variant="outline" onClick={() => window.location.href = 'mailto:contact@raggy.fr?subject=Export démo ' + company}>
                    <Download className="mr-2 w-4 h-4" />
                    Exporter la conversation
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    onClick={() => window.location.href = 'mailto:contact@raggy.fr?subject=Devis pour ' + company}
                  >
                    Demander un devis
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}