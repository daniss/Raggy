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
  Cloud
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
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
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
                Solution RAG clé en main à partir de 15 000€
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
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

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-6">
              Tarification simple et transparente
            </motion.h2>
            
            <motion.div variants={fadeInUp}>
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-8">
                  <div className="text-5xl font-bold mb-4">15 000€</div>
                  <p className="text-xl mb-6">Déploiement initial tout compris</p>
                  
                  <div className="space-y-3 text-left max-w-md mx-auto mb-8">
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span>Installation et configuration complète</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span>Import de vos documents existants</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span>Personnalisation interface et workflows</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span>Formation de vos équipes (2 jours)</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span>Support technique 6 mois inclus</span>
                    </div>
                  </div>

                  <div className="border-t border-white/20 pt-6">
                    <p className="text-sm mb-2">Options disponibles :</p>
                    <p className="text-sm opacity-90">
                      Hébergement géré • Maintenance évolutive • Connecteurs API • Formation avancée
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.p variants={fadeInUp} className="mt-8 text-lg">
              ROI moyen constaté : <strong>3 à 6 mois</strong>
              <br />
              <span className="text-sm opacity-90">
                Gain de productivité de 2-4h par collaborateur par semaine
              </span>
            </motion.p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-white mb-4 text-xl">Raggy</h3>
              <p className="text-sm">
                Solution RAG sur-mesure pour entreprises françaises.
                Transformez vos documents en intelligence.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/demo" className="hover:text-white">Démo gratuite</Link></li>
                <li><a href="#features" className="hover:text-white">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">À propos</a></li>
                <li><a href="#" className="hover:text-white">Cas clients</a></li>
                <li><a href="#" className="hover:text-white">Partenaires</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Conformité</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">RGPD</a></li>
                <li><a href="#" className="hover:text-white">Sécurité</a></li>
                <li><a href="#" className="hover:text-white">CGV</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© 2025 Raggy. Tous droits réservés. Made with 🇫🇷 in France</p>
            <p className="mt-2 text-xs opacity-75">
              Solution RAG professionnelle pour entreprises • 15 000€ HT déploiement initial
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}