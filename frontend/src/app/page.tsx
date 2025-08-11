'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  CheckCircle,
  ArrowRight,
  Upload,
  FileText,
  Shield,
  Lock,
  Zap,
  Globe,
  Database,
  Users,
  Clock,
  Download,
  Mail,
  ExternalLink,
  Menu,
  X,
  Play,
  Star,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const benefits = [
    {
      icon: Lock,
      title: 'Sécurisé',
      description: 'Données privées, séparation par organisation, DPA signé, hébergement UE.',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: FileText,
      title: 'Pertinent', 
      description: 'RAG complet: parsing → embeddings → recherche → citations sources cliquables.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Clock,
      title: 'Rapide',
      description: 'Réponses en streaming, interface simple, prêt pour un pilote.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  const features = [
    {
      icon: Upload,
      title: 'Upload multi-format',
      description: 'PDF, DOCX, MD, TXT, CSV supportés avec traitement automatique.'
    },
    {
      icon: FileText,
      title: 'Citations et extraits',
      description: 'Snippets, noms de fichiers, lien vers la source pour chaque réponse.'
    },
    {
      icon: Users,
      title: 'Authentification',
      description: 'Inscription/connexion, sessions sécurisées, gestion des rôles.'
    },
    {
      icon: Play,
      title: 'Démo sandbox',
      description: 'Corpus préchargé, prêt à tester immédiatement.'
    },
    {
      icon: Database,
      title: 'Déploiement',
      description: 'Docker Compose, FastAPI + Postgres/pgvector, Groq (ou LLM local).'
    }
  ];

  const screenshots = [
    {
      title: 'Interface d\'upload',
      description: 'Upload par glisser-déposer avec traitement en temps réel',
      alt: 'Interface d\'upload de documents Raggy'
    },
    {
      title: 'Chat avec streaming',
      description: 'Réponses en temps réel avec citations cliquables',
      alt: 'Chat assistant IA avec citations sources'
    },
    {
      title: 'Liste de documents',
      description: 'Gestion centralisée de votre base documentaire',
      alt: 'Liste des documents traités par l\'assistant'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: '1 200 €',
      period: '',
      description: 'Pour PoC rapide',
      features: [
        'Upload, RAG, citations',
        'Déploiement Docker',
        'Support Email'
      ],
      cta: 'Essayer la démo',
      popular: false
    },
    {
      name: 'Pro', 
      price: '2 000 €',
      period: '',
      description: 'Pour équipes',
      features: [
        'Tout Starter +',
        'Personnalisation des prompts',
        'Configuration index',
        'Support Email + 2h onboarding'
      ],
      cta: 'Essayer la démo',
      popular: true
    },
    {
      name: 'Enterprise',
      price: '3 500+ €',
      period: '',
      description: 'Pour déploiements sur-mesure',
      features: [
        'Intégration SSO',
        'Conformité & runbooks',
        'Support dédié',
        'SLA et pilotage'
      ],
      cta: 'Essayer la démo',
      popular: false
    }
  ];

  const faqs = [
    {
      question: 'Où sont stockées mes données ?',
      answer: 'Dans Postgres (pgvector), hébergé dans l\'UE pour la démo. Déploiement dédié possible pour la production.'
    },
    {
      question: 'Est-ce multi-tenant ?',
      answer: 'La démo utilise une organisation de démonstration unique. Déploiement dédié possible avec isolation complète.'
    },
    {
      question: 'Puis-je utiliser mon propre LLM ?',
      answer: 'Oui, branchement LLM local (vLLM/TGI) ou Groq selon vos besoins de conformité.'
    },
    {
      question: 'Quelles limites de format ?',
      answer: 'PDF, DOCX, MD, TXT, CSV (limites liées à la taille de fichier dans la démo).'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                Raggy
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                Fonctionnalités
              </Link>
              <Link href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                Tarifs
              </Link>
              <Link href="/demo" className="text-slate-600 hover:text-slate-900 transition-colors">
                Démo
              </Link>
              <Link href="/docs/DPA_short_fr_EN.md" target="_blank" className="text-slate-600 hover:text-slate-900 transition-colors">
                DPA
              </Link>
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="mailto:contact@raggy.fr?subject=Demande de pilote">
                  Demander un pilote
                </Link>
              </Button>
            </nav>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t bg-white">
              <nav className="flex flex-col space-y-4">
                <Link href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Fonctionnalités
                </Link>
                <Link href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Tarifs
                </Link>
                <Link href="/demo" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Démo
                </Link>
                <Link href="/docs/DPA_short_fr_EN.md" target="_blank" className="text-slate-600 hover:text-slate-900 transition-colors">
                  DPA
                </Link>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white w-fit">
                  <Link href="mailto:contact@raggy.fr?subject=Demande de pilote">
                    Demander un pilote
                  </Link>
                </Button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerChildren}
            >
              <motion.h1 
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6"
              >
                Assistants RAG privés pour vos{' '}
                <span className="text-blue-600">documents</span>
              </motion.h1>

              <motion.p 
                variants={fadeInUp}
                className="text-xl text-slate-600 mb-8"
              >
                Ingestion robuste. Citations fiables. Déploiement sécurisé. <span className="font-semibold text-blue-700">Testez en 2 minutes.</span>
              </motion.p>

              <motion.div 
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 mb-8"
              >
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Link href="/demo">
                    <Play className="mr-2 w-4 h-4" />
                    Accéder à la démo
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="mailto:contact@raggy.fr?subject=Demande de pilote">
                    <Mail className="mr-2 w-4 h-4" />
                    Demander un pilote
                  </Link>
                </Button>
              </motion.div>

              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 text-sm text-slate-600">
                <div className="flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-green-600" />
                  Hébergement UE
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  Aucune donnée utilisée pour l'entraînement
                </div>
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-green-600" />
                  DPA disponible
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Chat Interface Mockup */}
              <Card className="shadow-2xl bg-white border-0">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="text-sm font-medium ml-4">Assistant IA Raggy</div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg p-3 max-w-xs text-sm">
                      Quelles sont nos obligations RGPD pour les données clients ?
                    </div>
                  </div>
                  
                  {/* Assistant Response */}
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-slate-100 rounded-lg p-3 text-sm">
                        Selon votre Guide RGPD, voici les principales obligations :
                        <br />• Consentement explicite du client
                        <br />• Base légale appropriée
                        <br />• Délai de réponse max 1 mois...
                      </div>
                    </div>
                  </div>
                  
                  {/* Sources */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-800 mb-2">Sources citées :</div>
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-blue-700 cursor-pointer hover:text-blue-800">
                        <FileText className="w-3 h-3 mr-1" />
                        Guide_RGPD_2024.pdf (page 12)
                      </div>
                      <div className="flex items-center text-xs text-blue-700 cursor-pointer hover:text-blue-800">
                        <FileText className="w-3 h-3 mr-1" />
                        Procedures_Conformite.docx (page 3)
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-center mt-4">
                <p className="text-sm text-slate-500">
                  <span className="inline-flex items-center">
                    <Play className="w-3 h-3 mr-1" />
                    Démo publique, données factices
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Pourquoi Raggy
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-3xl mx-auto">
              Une solution complète pour créer des assistants IA performants et sécurisés
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {benefits.map((benefit, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow border-0 shadow-md">
                  <CardHeader className="text-center pb-4">
                    <div className={`w-16 h-16 ${benefit.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      {benefit.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Fonctionnalités clés
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-3xl mx-auto">
              Tout ce dont vous avez besoin pour déployer un assistant RAG professionnel
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <feature.icon className="w-12 h-12 text-blue-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-slate-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center"
          >
            <Button asChild variant="outline" size="lg">
              <Link href="/demo">
                <Play className="mr-2 w-4 h-4" />
                Voir la démo
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Screenshot Strip */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Interface intuitive et performante
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600">
              Découvrez l'expérience utilisateur optimisée pour l'entreprise
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {screenshots.map((screenshot, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-50 rounded-t-lg flex items-center justify-center">
                      <div className="text-blue-600 opacity-50">
                        {index === 0 && <Upload className="w-16 h-16" />}
                        {index === 1 && <MessageCircle className="w-16 h-16" />}
                        {index === 2 && <FileText className="w-16 h-16" />}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">{screenshot.title}</h3>
                      <p className="text-sm text-slate-600">{screenshot.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Tarifs
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-3xl mx-auto">
              Des solutions adaptées à chaque besoin, de la preuve de concept au déploiement enterprise
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
          >
            {pricingPlans.map((plan, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className={`relative h-full hover:shadow-lg transition-shadow ${
                  plan.popular ? 'border-2 border-blue-500' : ''
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white px-4 py-1">
                        Populaire
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                      <span className="text-slate-600 ml-1">{plan.period}</span>
                    </div>
                    <CardDescription className="text-base">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      asChild 
                      className={`w-full ${
                        plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      <Link href="/demo">
                        {plan.cta}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center"
          >
            <p className="text-slate-600 mb-4">
              Tarifs HT. Facturation sur devis pour Enterprise.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold mb-4">
              Lancez votre assistant RAG avec une démo en 5 minutes
            </motion.h2>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Link href="/demo">
                    <Play className="mr-2 w-4 h-4" />
                    Accéder à la démo
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="mailto:contact@raggy.fr?subject=Demande de pilote">
                    <Mail className="mr-2 w-4 h-4" />
                    Demander un pilote
                  </Link>
                </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Demo Explainer */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Démo sandbox
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 mb-8">
              Accès via email (gating simple). Corpus de démonstration préchargé (1 000+ documents mixtes).
              Uploader vos propres fichiers (fichiers de test uniquement).
            </motion.p>
            
            <motion.div variants={fadeInUp} className="bg-white rounded-lg p-8 shadow-lg mb-8">
              <h3 className="text-lg font-semibold mb-4">Ce que vous verrez :</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center">
                  <Upload className="w-4 h-4 text-blue-600 mr-2" />
                  Upload
                </div>
                <div className="flex items-center">
                  <Database className="w-4 h-4 text-blue-600 mr-2" />
                  Ingestion
                </div>
                <div className="flex items-center">
                  <MessageCircle className="w-4 h-4 text-blue-600 mr-2" />
                  Chat
                </div>
                <div className="flex items-center">
                  <Zap className="w-4 h-4 text-blue-600 mr-2" />
                  Streaming
                </div>
                <div className="flex items-center md:col-span-2">
                  <FileText className="w-4 h-4 text-blue-600 mr-2" />
                  Citations cliquables
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/demo">
                  <Play className="mr-2 w-4 h-4" />
                  Essayer maintenant
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Sécurité & conformité
            </motion.h2>
            
            <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <Card className="p-6">
                <Shield className="w-12 h-12 text-green-600 mb-4 mx-auto" />
                <h3 className="font-semibold mb-2">Hébergement UE recommandé</h3>
                <p className="text-sm text-slate-600">Infrastructure européenne pour la conformité RGPD</p>
              </Card>
              
              <Card className="p-6">
                <CheckCircle className="w-12 h-12 text-green-600 mb-4 mx-auto" />
                <h3 className="font-semibold mb-2">Aucune donnée utilisée pour l'entraînement</h3>
                <p className="text-sm text-slate-600">Vos documents restent confidentiels et privés</p>
              </Card>
              
              <Card className="p-6">
                <Database className="w-12 h-12 text-green-600 mb-4 mx-auto" />
                <h3 className="font-semibold mb-2">Suppression sur demande avec preuve</h3>
                <p className="text-sm text-slate-600">Hash + horodatage pour la traçabilité</p>
              </Card>
              
              <Card className="p-6">
                <FileText className="w-12 h-12 text-green-600 mb-4 mx-auto" />
                <h3 className="font-semibold mb-2">DPA disponible à la signature</h3>
                <p className="text-sm text-slate-600">Contrat de traitement des données conforme</p>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs/DPA_short_fr_EN.md" target="_blank">
                  <Download className="mr-2 w-4 h-4" />
                  Télécharger le DPA
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Questions fréquentes
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="space-y-8"
          >
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-3 text-slate-900">
                    {faq.question}
                  </h3>
                  <p className="text-slate-600">
                    {faq.answer}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <h3 className="font-semibold text-white mb-4">Raggy</h3>
              <p className="text-sm mb-4">
                Développement d'assistants RAG privés pour les entreprises françaises.
                Solutions sur-mesure, sécurisées et conformes.
              </p>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="font-medium text-white mb-3">Liens</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/docs/DPA_short_fr_EN.md" target="_blank" className="hover:text-white transition-colors">DPA</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Mentions légales</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Politique de confidentialité</Link></li>
              </ul>
            </div>
            
            {/* Contact */}
            <div className="md:col-span-2">
              <h4 className="font-medium text-white mb-3">Contact</h4>
              <p className="text-sm">
                <Link href="mailto:contact@raggy.fr" className="hover:text-white transition-colors">
                  contact@raggy.fr
                </Link>
              </p>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Raggy. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}