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
      // Simulate session creation
      setTimeout(() => {
        const token = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionToken(token);
        setDemoStep('sandbox');
        setIsLoading(false);
      }, 1000);
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-blue-600" />
                      Documents disponibles
                    </CardTitle>
                    <CardDescription>
                      Base documentaire pré-configurée
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {demoDocuments.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span className="text-sm">{doc.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {doc.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
                      Questions suggérées
                    </CardTitle>
                    <CardDescription>
                      Exemples pour commencer
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sampleQuestions.map((question, index) => (
                        <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                          "{question}"
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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