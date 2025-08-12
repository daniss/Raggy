'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  CheckCircle,
  ArrowRight,
  Building2,
  Users,
  FileText,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ChatWidget from '@/components/ChatWidget';

export default function HomePage() {
  const features = [
    {
      icon: Building2,
      title: 'Multi-tenant',
      description: 'Chaque organisation dispose de son propre espace sécurisé et isolé.',
      color: 'text-blue-500'
    },
    {
      icon: Users,
      title: 'Collaboration d\'équipe',
      description: 'Invitez vos collègues et travaillez ensemble avec votre assistant IA privé.',
      color: 'text-green-500'
    },
    {
      icon: FileText,
      title: 'Documents privés',
      description: 'Alimentez votre IA avec vos documents internes (PDF, CSV, docs métiers).',
      color: 'text-purple-500'
    },
    {
      icon: Lock,
      title: 'Sécurité entreprise',
      description: 'Isolation stricte des données par organisation avec authentification sécurisée.',
      color: 'text-red-500'
    }
  ];

  const benefits = [
    'Un assistant IA privé alimenté par vos documents internes',
    'Collaboration entre collègues dans un espace sécurisé',
    'Isolation stricte des données par organisation',
    'Gestion des rôles : admin et membres',
    'Upload par lot de PDF, CSV, docs métiers',
    'Interface moderne optimisée pour les équipes'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5"></div>
        
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerChildren}
            className="text-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <Badge variant="secondary" className="mb-4">
                <Building2 className="w-3 h-3 mr-1" />
                Plateforme SaaS Multi-tenant
              </Badge>
            </motion.div>

            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-6xl font-bold tracking-tight gradient-text mb-6"
            >
              Assistant IA Privé pour
              <br />
              <span className="text-accent">Chaque Entreprise</span>
            </motion.h1>

            <motion.p 
              variants={fadeInUp}
              className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8"
            >
              Plateforme SaaS RAG qui permet à chaque entreprise d'avoir son assistant IA privé, 
              alimenté par ses documents internes. Multi-utilisateurs, sécurisé, collaboratif.
            </motion.p>

            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Button size="lg" className="w-full sm:w-auto">
                Créer votre Organisation
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Essayer la Démo
              </Button>
            </motion.div>

            <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Isolation des données</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">10</div>
                <div className="text-sm text-muted-foreground">Utilisateurs/org (gratuit)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">&lt;2s</div>
                <div className="text-sm text-muted-foreground">Réponse IA</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
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
              Architecture Multi-tenant
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground max-w-2xl mx-auto">
              Une plateforme SaaS conçue dès le départ pour les entreprises, avec isolation complète 
              des données et gestion des équipes intégrée.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <feature.icon className={`w-12 h-12 ${feature.color} mb-4`} />
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerChildren}
            >
              <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-6">
                Pourquoi Raggy pour votre Entreprise ?
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-muted-foreground mb-8">
                La première plateforme SaaS RAG multi-tenant pour les entreprises françaises. 
                Sécurisé, collaboratif, et alimenté par vos propres documents.
              </motion.p>
              
              <motion.div variants={staggerChildren} className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div 
                    key={index} 
                    variants={fadeInUp}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{benefit}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="relative"
            >
              <Card className="p-8 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  <div className="ml-11">
                    <div className="bg-slate-100 rounded-lg p-3 text-sm">
                      Bonjour ! Je suis l'assistant IA de votre entreprise. Comment puis-je vous aider avec nos documents internes ?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-accent text-white rounded-lg p-3 text-sm max-w-xs">
                      Quelles sont nos procédures RH pour l'intégration d'un nouveau salarié ?
                    </div>
                  </div>
                  <div className="ml-11">
                    <div className="bg-slate-100 rounded-lg p-3 text-sm">
                      Selon notre manuel RH (document interne), voici les 5 étapes clés pour l'intégration...
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-6">
              Créez l'Assistant IA de votre Entreprise
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl opacity-90 mb-8">
              Rejoignez les entreprises qui ont déjà leur assistant IA privé alimenté par leurs documents.
              Plan gratuit jusqu'à 10 utilisateurs, sans engagement.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Créer une Organisation
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-primary-foreground hover:bg-white hover:text-primary">
                Planifier une Démo
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-white mb-4">Raggy</h3>
              <p className="text-sm">
                Plateforme SaaS RAG pour entreprises françaises. 
                Un assistant IA privé pour chaque organisation, alimenté par leurs documents internes.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-white">Tarifs</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Aide</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">À propos</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Carrières</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 Raggy. Tous droits réservés. Made with ❤️ for French SMEs.</p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}