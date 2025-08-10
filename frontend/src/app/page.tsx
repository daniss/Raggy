'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain,
  Shield,
  Rocket,
  Users,
  FileText,
  ChevronRight,
  Play,
  Check,
  ArrowRight,
  Building,
  Euro,
  Clock,
  Zap,
  Lock,
  Cloud,
  Upload,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);

  const features = [
    {
      icon: Brain,
      title: 'IA de pointe',
      description: 'Modèles de langage dernière génération optimisés pour le français',
      color: 'text-blue-600'
    },
    {
      icon: Shield,
      title: '100% Souverain',
      description: 'Vos données restent chez vous, hébergement France ou on-premise',
      color: 'text-green-600'
    },
    {
      icon: Rocket,
      title: 'Déploiement rapide',
      description: 'Opérationnel en 48h avec vos documents métier',
      color: 'text-purple-600'
    },
    {
      icon: Lock,
      title: 'Sécurité maximale',
      description: 'Isolation complète, chiffrement bout-en-bout, audit complet',
      color: 'text-red-600'
    }
  ];

  const benefits = [
    'Assistant IA entraîné sur VOS documents internes',
    'Réponses instantanées avec sources citées',
    'Compatible PDF, Word, Excel, emails',
    'Interface 100% en français',
    'Support technique dédié en France',
    'Formation de vos équipes incluse'
  ];

  const useCases = [
    {
      sector: 'Cabinet d\'avocats',
      icon: Building,
      challenges: 'Recherche dans la jurisprudence, rédaction de conclusions',
      solution: 'IA juridique sur-mesure avec votre base documentaire'
    },
    {
      sector: 'Expert-comptable',
      icon: FileText,
      challenges: 'Analyse fiscale, veille réglementaire, conseil client',
      solution: 'Assistant fiscal intelligent avec mise à jour temps réel'
    },
    {
      sector: 'PME industrielle',
      icon: Zap,
      challenges: 'Documentation technique, procédures qualité, formation',
      solution: 'Base de connaissances IA pour tous vos collaborateurs'
    }
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600">Raggy</h1>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Fonctionnalités</a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Tarifs</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors">Contact</a>
              <Link href="/demo">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  Démo gratuite
                </Button>
              </Link>
            </div>
            <div className="md:hidden">
              <Link href="/demo">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  Démo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative py-12 md:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50"></div>
        
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerChildren}
            className="text-center"
          >
            <motion.div variants={fadeInUp}>
              <Badge variant="secondary" className="mb-4">
                <Euro className="w-3 h-3 mr-1" />
                Solution RAG clé en main à partir de 1 200€
              </Badge>
            </motion.div>

            <motion.h1 
              variants={fadeInUp}
              className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
            >
              Votre Assistant IA
              <br />
              <span className="text-slate-800">100% Sur-Mesure</span>
            </motion.h1>

            <motion.p 
              variants={fadeInUp}
              className="text-xl text-slate-600 max-w-3xl mx-auto mb-8"
            >
              Transformez vos documents internes en assistant intelligent.
              Solution RAG privée et sécurisée pour entreprises françaises.
              <br />
              <strong className="text-slate-800">Vos données restent vos données.</strong>
            </motion.p>

            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Link href="/demo">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Play className="mr-2 w-4 h-4" />
                  Essayer la démo gratuite
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Demander un devis personnalisé
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>

            <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">48h</div>
                <div className="text-sm text-slate-600">Déploiement</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">100%</div>
                <div className="text-sm text-slate-600">Données privées</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">&lt;2s</div>
                <div className="text-sm text-slate-600">Temps réponse</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">ROI</div>
                <div className="text-sm text-slate-600">3-6 mois</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerChildren}
            >
              <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-6">
                Vos équipes perdent du temps à chercher l'information ?
              </motion.h2>
              
              <motion.div variants={fadeInUp} className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <p className="text-slate-600">Documents éparpillés dans différents systèmes</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <p className="text-slate-600">Recherches longues et infructueuses</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <span className="text-red-600 text-sm">✗</span>
                  </div>
                  <p className="text-slate-600">Expertise perdue quand un collaborateur part</p>
                </div>
              </motion.div>

              <motion.h3 variants={fadeInUp} className="text-2xl font-semibold mb-4 text-blue-600">
                La solution : Votre IA d'entreprise
              </motion.h3>
              
              <motion.div variants={fadeInUp} className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">{benefit}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="shadow-xl border-2 border-blue-100">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle className="text-xl">Exemple concret</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-600 mb-1">Votre question :</p>
                      <p className="text-slate-800">"Quelle est notre procédure de validation des congés pour un manager ?"</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-600 mb-1">Réponse IA (1.8s) :</p>
                      <p className="text-slate-800 mb-3">
                        "Selon le Manuel RH 2024 (page 47), la procédure est :
                        1. Demande via l'outil SIRH minimum 15 jours avant
                        2. Validation N+1 automatique si &lt; 5 jours
                        3. Validation N+2 requise si &gt; 5 jours consécutifs
                        4. Notification email au demandeur sous 48h"
                      </p>
                      <div className="flex items-center text-xs text-blue-600">
                        <FileText className="w-3 h-3 mr-1" />
                        Sources : Manuel_RH_2024.pdf, Procédure_congés_v3.docx
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-4">
              Une solution pensée pour les entreprises françaises
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-2xl mx-auto">
              Conformité RGPD, hébergement souverain, support en français
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <feature.icon className={`w-12 h-12 ${feature.color} mb-4`} />
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-4">
              Adapté à votre secteur d'activité
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600">
              Solutions sur-mesure pour chaque métier
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {useCases.map((useCase, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-xl transition-shadow">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <useCase.icon className="w-10 h-10 text-blue-600" />
                      <Badge variant="outline">{useCase.sector}</Badge>
                    </div>
                    <CardTitle className="text-lg">Défis</CardTitle>
                    <CardDescription className="text-base mt-2">
                      {useCase.challenges}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="font-medium text-blue-600 mb-2">Notre solution :</p>
                    <p className="text-slate-700">{useCase.solution}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Product Screenshots Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-4">
              Découvrez l'interface en action
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-2xl mx-auto">
              Une interface intuitive pensée pour une adoption rapide par vos équipes
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="space-y-16"
          >
            {/* Main Dashboard Screenshot */}
            <motion.div variants={fadeInUp} className="text-center">
              <div className="relative max-w-5xl mx-auto">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-8 shadow-2xl">
                  <div className="bg-white rounded-lg overflow-hidden shadow-lg">
                    {/* Browser mockup header */}
                    <div className="bg-gray-100 px-4 py-3 flex items-center space-x-2">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      </div>
                      <div className="flex-1 bg-white rounded-md px-4 py-1 text-sm text-gray-600 ml-4">
                        https://votre-entreprise.raggy.ai
                      </div>
                    </div>
                    
                    {/* Main interface preview */}
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                      <div className="flex space-x-6">
                        {/* Sidebar */}
                        <div className="w-64 space-y-3">
                          <div className="bg-blue-100 rounded-lg p-3">
                            <div className="h-4 bg-blue-300 rounded mb-2"></div>
                            <div className="space-y-1">
                              <div className="h-2 bg-blue-200 rounded w-3/4"></div>
                              <div className="h-2 bg-blue-200 rounded w-1/2"></div>
                            </div>
                          </div>
                          {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-lg p-3 border">
                              <div className="h-3 bg-gray-200 rounded mb-2"></div>
                              <div className="h-2 bg-gray-100 rounded w-2/3"></div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Chat area */}
                        <div className="flex-1 bg-white rounded-lg border p-4">
                          <div className="space-y-4 mb-4">
                            <div className="flex justify-end">
                              <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-xs">
                                <div className="text-xs">Quelle est notre procédure RGPD ?</div>
                              </div>
                            </div>
                            <div className="flex">
                              <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-md">
                                <div className="text-xs mb-2">Selon le Guide RGPD 2024, voici la procédure...</div>
                                <div className="text-xs text-blue-600">📄 Guide_RGPD_2024.pdf</div>
                              </div>
                            </div>
                          </div>
                          <div className="border-t pt-3">
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 bg-green-500 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-lg">
                  ✨ Interface française
                </div>
              </div>
              <motion.div variants={fadeInUp} className="mt-8">
                <h3 className="text-xl font-semibold mb-2">Assistant IA intégré</h3>
                <p className="text-gray-600">
                  Interface de chat intuitive avec recherche intelligente dans vos documents
                </p>
              </motion.div>
            </motion.div>

            {/* Feature highlights */}
            <motion.div variants={staggerChildren} className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div variants={fadeInUp} className="text-center">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-100">
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                  </div>
                  <h4 className="font-semibold mb-2">Upload simplifié</h4>
                  <p className="text-sm text-gray-600">
                    Glissez-déposez vos documents PDF, Word, Excel en un clic
                  </p>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="text-center">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100">
                  <div className="bg-green-50 rounded-lg p-4 mb-4">
                    <MessageCircle className="w-8 h-8 text-green-600 mx-auto" />
                  </div>
                  <h4 className="font-semibold mb-2">Réponses instantanées</h4>
                  <p className="text-sm text-gray-600">
                    Questions en français naturel, réponses avec sources citées
                  </p>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="text-center">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-100">
                  <div className="bg-purple-50 rounded-lg p-4 mb-4">
                    <Shield className="w-8 h-8 text-purple-600 mx-auto" />
                  </div>
                  <h4 className="font-semibold mb-2">Données sécurisées</h4>
                  <p className="text-sm text-gray-600">
                    Chiffrement complet, hébergement France, conformité RGPD
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Live demo CTA */}
            <motion.div variants={fadeInUp} className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-4">Voir l'interface en action</h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Testez vous-même l'interface avec nos documents de démonstration. 
                Aucune installation requise, accès immédiat.
              </p>
              <Link href="/demo">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Play className="mr-2 w-4 h-4" />
                  Essayer la démo interactive
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Tarification simple et transparente
              </h2>
              <p className="text-xl opacity-90 max-w-2xl mx-auto">
                Choisissez la formule adaptée à la taille de votre entreprise
              </p>
            </motion.div>
            
            <motion.div variants={staggerChildren} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Starter Plan */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2">Starter</h3>
                      <div className="text-3xl font-bold mb-1">1 200€</div>
                      <p className="text-sm opacity-75">Configuration de base</p>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Jusqu'à 100 documents</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Installation et configuration</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Interface standard</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Formation 1 jour</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Support 3 mois</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <Badge variant="secondary" className="text-blue-600 bg-white/90">
                        PME 5-20 salariés
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pro Plan */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-white/20 backdrop-blur border-white/40 h-full relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold px-4 py-1">
                      Recommandé
                    </Badge>
                  </div>
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2">Pro</h3>
                      <div className="text-3xl font-bold mb-1">2 000€</div>
                      <p className="text-sm opacity-75">Solution complète</p>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Jusqu'à 500 documents</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Installation et personnalisation</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Interface sur-mesure</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Formation 2 jours</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Support 6 mois</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Connecteurs API</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <Badge variant="secondary" className="text-blue-600 bg-white/90">
                        Entreprises 20-100 salariés
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Enterprise Plan */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-white/10 backdrop-blur border-white/20 h-full">
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
                      <div className="text-3xl font-bold mb-1">3 500€+</div>
                      <p className="text-sm opacity-75">Sur devis</p>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Documents illimités</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Architecture sur-mesure</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Intégration complète</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Formation équipe complète</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Support premium 12 mois</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>SLA garanti</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <Badge variant="secondary" className="text-blue-600 bg-white/90">
                        Grandes entreprises 100+ salariés
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeInUp} className="text-center mt-12">
              <p className="text-lg mb-2">
                ROI moyen constaté : <strong>3 à 6 mois</strong>
              </p>
              <p className="text-sm opacity-90">
                Gain de productivité de 2-4h par collaborateur par semaine
              </p>
              <p className="text-xs opacity-75 mt-4">
                Tarifs HT • Devis personnalisé pour besoins spécifiques • Financement possible
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="text-center"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-6">
              Prêt à transformer votre gestion documentaire ?
            </motion.h2>
            
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 mb-8">
              Testez gratuitement avec vos propres documents ou planifiez une démonstration personnalisée
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/demo">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Play className="mr-2 w-4 h-4" />
                  Accéder à la démo gratuite
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => window.location.href = 'mailto:contact@raggy.fr?subject=Demande de devis personnalisé'}
              >
                <Building className="mr-2 w-4 h-4" />
                Contact commercial
              </Button>
            </motion.div>

            <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Réponse sous 24h</p>
              </div>
              <div className="text-center">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Équipe 100% française</p>
              </div>
              <div className="text-center">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Données 100% sécurisées</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <h3 className="font-bold text-white mb-4 text-xl">Raggy</h3>
              <p className="text-sm mb-4">
                Solution RAG sur-mesure pour entreprises françaises.
                Transformez vos documents en intelligence.
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Hébergement France • Conformité RGPD</span>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/demo" className="hover:text-white transition-colors">Démo gratuite</Link></li>
                <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact commercial</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:contact@raggy.fr" className="hover:text-white transition-colors">À propos</a></li>
                <li><a href="mailto:contact@raggy.fr?subject=Cas clients" className="hover:text-white transition-colors">Cas clients</a></li>
                <li><a href="mailto:partenaires@raggy.fr" className="hover:text-white transition-colors">Partenaires</a></li>
                <li><a href="mailto:support@raggy.fr" className="hover:text-white transition-colors">Support technique</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Conformité</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/docs/DPA_short_fr_EN.md" target="_blank" className="hover:text-white transition-colors">📄 DPA (Accord de traitement)</a></li>
                <li><a href="/rgpd" className="hover:text-white transition-colors">🔒 Politique RGPD</a></li>
                <li><a href="/security" className="hover:text-white transition-colors">🛡️ Sécurité & Chiffrement</a></li>
                <li><a href="/cgv" className="hover:text-white transition-colors">📋 CGV</a></li>
                <li><a href="/cgu" className="hover:text-white transition-colors">⚖️ CGU</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-12 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="text-sm">
                <p className="mb-2">© 2025 Raggy. Tous droits réservés.</p>
                <p className="text-xs opacity-75">
                  Made with 🇫🇷 in France • Solution RAG professionnelle pour entreprises
                </p>
              </div>
              <div className="text-sm md:text-right">
                <div className="flex flex-col md:items-end space-y-1">
                  <p className="font-medium text-white">Certifications & Conformité</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="bg-green-800/20 text-green-400 border-green-600">
                      ISO 27001 Ready
                    </Badge>
                    <Badge variant="outline" className="bg-blue-800/20 text-blue-400 border-blue-600">
                      RGPD Compliant
                    </Badge>
                    <Badge variant="outline" className="bg-purple-800/20 text-purple-400 border-purple-600">
                      HDS Compatible
                    </Badge>
                  </div>
                  <p className="text-xs opacity-75 mt-2">
                    Tarifs à partir de 1 200€ HT • Devis personnalisé • Financement possible
                  </p>
                </div>
              </div>
            </div>
            
            {/* Legal compliance line */}
            <div className="border-t border-slate-800 mt-6 pt-6 text-center">
              <p className="text-xs opacity-75">
                <span className="font-medium">Données personnelles :</span> Vos documents restent sur votre infrastructure.
                <span className="mx-2">•</span>
                <span className="font-medium">Sécurité :</span> Chiffrement AES-256, transmission TLS 1.3.
                <span className="mx-2">•</span>
                <Link href="/dpa" className="underline hover:text-white">
                  Télécharger l'accord de traitement des données (DPA)
                </Link>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}