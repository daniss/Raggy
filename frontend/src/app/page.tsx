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
import Compliance from '@/components/Compliance';
import Pricing from '@/components/Pricing';

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
      description: 'Données privées, isolation logique, DPA signable, hébergement UE disponible.',
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
      description: 'Réponses en streaming, interface simple, ready to use.',
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


  const faqs = [
    {
      question: 'Comment fonctionne l\'essai gratuit ?',
      answer: 'Essai gratuit de 14 jours sur le plan Starter sans carte bancaire requise. Accès complet à toutes les fonctionnalités. Convertissez quand vous êtes convaincu.'
    },
    {
      question: 'Quelles sont les limites de chaque forfait ?',
      answer: 'Starter: 2 utilisateurs, 100 docs/2Go, 50k tokens/mois. Team: 5 utilisateurs, 500 docs/10Go, 200k tokens/mois. Business: 15 utilisateurs, 2000 docs/50Go, 500k tokens/mois.'
    },
    {
      question: 'Que se passe-t-il si je dépasse mes limites ?',
      answer: 'Les tokens dépassés passent automatiquement au plan supérieur. Stockage supplémentaire disponible à +50€/mois pour +50Go. Simple et transparent.'
    },
    {
      question: 'Quel type de support proposez-vous ?',
      answer: 'Support par email uniquement : 72h pour Starter, 48h pour Team, prioritaire pour Business avec possibilité de call booking. Pas de SLA contractuel, mais réponses rapides et efficaces.'
    },
    {
      question: 'Comment puis-je annuler mon abonnement ?',
      answer: 'Résiliation possible à tout moment depuis votre tableau de bord. Paiements mensuels via Stripe. Annuel avec -10% de remise. Aucun engagement long terme.'
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
                <Link href="/demo">
                  Essai gratuit 14 jours
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
                  <Link href="/demo">
                    Essai gratuit 14 jours
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
              {/* A/B Test Headlines - Current: Option A */}
              <motion.h1 
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6"
              >
                {/* Option A (Current): */}
                Vos documents deviennent{' '}
                <span className="text-blue-600">intelligents</span>
                
                {/* Option B (A/B Test): Le ChatGPT qui connaît VOS documents */}
                {/* Le <span className="text-blue-600">ChatGPT</span> qui connaît{' '}
                <span className="text-blue-600">VOS</span> documents */}
                
                {/* Option C (Alternative): Posez des questions à vos 1000 PDFs comme si c'était ChatGPT */}
                {/* Posez des questions à vos{' '}
                <span className="text-blue-600">1000 PDFs</span> comme si c'était ChatGPT */}
              </motion.h1>

              <motion.p 
                variants={fadeInUp}
                className="text-xl text-slate-600 mb-8"
              >
                <span className="font-semibold text-blue-700">Assistant IA privé en 5 minutes.</span> Commencez gratuitement, payez quand vous êtes convaincu.
              </motion.p>

              <motion.div 
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 mb-8"
              >
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Link href="/demo">
                    <Star className="mr-2 w-4 h-4" />
                    Essai gratuit 14 jours
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="mailto:hello@raggy.fr?subject=Demo%20Enterprise%20-%20Demande%20commerciale">
                    <Mail className="mr-2 w-4 h-4" />
                    Contact commercial (Enterprise)
                  </a>
                </Button>
              </motion.div>

              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 text-sm text-slate-600">
                <div className="flex items-center bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                  <div className="w-3 h-3 mr-2 text-green-600">🇫🇷</div>
                  <span className="font-medium">Hébergé en France</span>
                </div>
                <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                  <Shield className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="font-medium">RGPD Compliant</span>
                </div>
                <div className="flex items-center bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4 mr-2 text-purple-600" />
                  <span className="font-medium">Vos données restent vôtres</span>
                </div>
                <div className="flex items-center bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full">
                  <FileText className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="font-medium">DPA signable</span>
                </div>
                <div className="flex items-center bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
                  <Database className="w-4 h-4 mr-2 text-orange-600" />
                  <span className="font-medium">Option HDS</span>
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

      {/* Compliance Section */}
      <Compliance />

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
                Essayer la démo
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
      <Pricing />

      {/* Lead Magnet Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center"
          >
            <motion.div variants={fadeInUp} className="mb-8">
              <Badge className="bg-purple-100 text-purple-800 px-4 py-2 text-sm font-medium mb-4">
                <Download className="w-4 h-4 mr-2" />
                Ressource gratuite
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Checklist RGPD & AI Act
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Téléchargez notre guide complet pour la conformité de votre assistant IA aux réglementations françaises et européennes.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-lg shadow-lg p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="text-left">
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">Ce que vous allez obtenir :</h3>
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      Audit RGPD complet pour les assistants IA
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      Plan d'action AI Act (conformité européenne)
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      Dossier DPO prêt à l'emploi
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      Template de politique de données
                    </li>
                  </ul>
                </div>
                
                <div className="text-center">
                  <div className="bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg p-6 mb-6">
                    <FileText className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-slate-900">24 pages</div>
                    <div className="text-sm text-slate-600">Guide PDF complet</div>
                  </div>
                  
                  <Button asChild size="lg" className="bg-purple-600 hover:bg-purple-700 text-white w-full">
                    <a href="mailto:hello@raggy.fr?subject=Demande%20Checklist%20RGPD%20AI%20Act&body=Bonjour,%0A%0AJe%20souhaiterais%20recevoir%20la%20checklist%20RGPD%20%26%20AI%20Act.%0A%0ANom%20:%20%0AEntreprise%20:%20%0ASecteur%20:%20%0ATaille%20équipe%20:%20%0A%0AMerci%20!">
                      <Download className="mr-2 w-4 h-4" />
                      Télécharger gratuitement
                    </a>
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Aucune carte bancaire requise
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Band - Free Trial Focus */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Prêt à rendre vos documents intelligents ?
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-blue-100 mb-6">
              Commencez gratuitement, aucune carte bancaire requise
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                  <Link href="/demo">
                    <Star className="mr-2 w-4 h-4" />
                    Essai gratuit 14 jours
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                  <a href="mailto:hello@raggy.fr?subject=Demo%20Enterprise%20-%20Audit%20gratuit">
                    <Shield className="mr-2 w-4 h-4" />
                    Audit Enterprise (gratuit 30min)
                  </a>
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
                Assistants RAG privés pour entreprises françaises. 
                Essai gratuit 14 jours. Vos documents deviennent intelligents.
              </p>
              <p className="text-xs text-slate-400">
                Tarifs HT • Net 30 • Chorus Pro compatible
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
          
          <div className="border-t border-slate-800 pt-8 text-center text-sm space-y-2">
            <p className="text-blue-400 italic">
              🇫🇷 Conçu par un dev français qui préfère coder que faire des PowerPoints
            </p>
            <p>&copy; {new Date().getFullYear()} Raggy. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}