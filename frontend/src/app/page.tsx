'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  CheckCircle,
  ArrowRight,
  FileText,
  Lock,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTheme } from '@/components/ThemeProvider';

export default function HomePage() {
  const { companyName, logoPath, isFeatureEnabled } = useTheme();

  const features = [
    {
      icon: MessageCircle,
      title: 'Assistant IA Privé',
      description: 'Interrogez vos documents internes avec notre IA spécialisée.',
      color: 'text-blue-500'
    },
    {
      icon: FileText,
      title: 'Documents d\'entreprise',
      description: 'Alimentez l\'IA avec vos documents (PDF, Excel, Word, etc.).',
      color: 'text-purple-500'
    },
    {
      icon: Lock,
      title: 'Sécurité maximale',
      description: 'Vos données restent privées et ne quittent jamais votre environnement.',
      color: 'text-red-500'
    },
    {
      icon: Zap,
      title: 'Réponses rapides',
      description: 'Obtenez des réponses précises en moins de 3 secondes.',
      color: 'text-yellow-500'
    }
  ];

  const benefits = [
    'Un assistant IA privé alimenté par vos documents internes',
    'Réponses instantanées basées sur votre connaissance métier',
    'Isolation complète des données - 100% sécurisé',
    'Recherche intelligente dans tous vos documents',
    'Interface simple et intuitive'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                Assistant IA pour
                <span className="text-blue-600"> {companyName}</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Votre assistant IA personnel, alimenté par vos documents d'entreprise.
                Obtenez des réponses précises et instantanées basées sur votre expertise métier.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center justify-center gap-x-6"
            >
              <Button 
                size="lg" 
                className="px-8 py-3"
                onClick={() => window.location.href = '/assistant'}
              >
                Commencer maintenant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="text-base font-semibold leading-7 text-blue-600">
                Fonctionnalités
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Tout ce dont vous avez besoin
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Une plateforme RAG complète, sécurisée et adaptée à vos besoins spécifiques.
              </p>
            </motion.div>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg bg-gray-100`}>
                          <feature.icon className={`h-6 w-6 ${feature.color}`} />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Pourquoi choisir notre solution ?
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Une plateforme conçue spécifiquement pour les besoins de {companyName}.
              </p>
            </motion.div>

            <div className="mx-auto mt-16 max-w-2xl">
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 1.2 + index * 0.1 }}
                    className="flex items-start space-x-3"
                  >
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.8 }}
              className="mt-12 text-center"
            >
              <Button 
                size="lg" 
                className="px-8 py-3"
                onClick={() => window.location.href = '/assistant'}
              >
                Essayer maintenant
                <MessageCircle className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}