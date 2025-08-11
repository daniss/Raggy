'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield,
  Database,
  Lock,
  FileText,
  Zap,
  CheckCircle,
  ExternalLink,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function Compliance() {
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

  const complianceFeatures = [
    {
      icon: Shield,
      title: 'RGPD by design',
      description: 'Architecture conçue dès l\'origine pour la conformité européenne avec Privacy by Design.',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Database,
      title: 'Hébergement UE',
      description: 'Données stockées exclusivement en Union Européenne avec souveraineté garantie.',
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50'
    },
    {
      icon: Lock,
      title: 'Aucun re-entraînement',
      description: 'Vos documents ne servent jamais à améliorer nos modèles. Confidentialité absolue.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      icon: FileText,
      title: 'Preuve de purge avec JSON',
      description: 'Certificat cryptographique de destruction complète avec hash de vérification.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      icon: CheckCircle,
      title: 'DPA disponible',
      description: 'Contrat de traitement des données conforme RGPD, signable immédiatement.',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Zap,
      title: 'TLS en transit',
      description: 'Chiffrement TLS 1.3 pour tous les échanges de données et communications API.',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="text-center mb-16"
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Confiance & conformité
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-3xl mx-auto">
            Sécurité renforcée et conformité RGPD garantie pour vos données sensibles d'entreprise
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12"
        >
          {complianceFeatures.map((feature, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full hover:shadow-lg transition-shadow border-0 shadow-md">
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 ${feature.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <feature.icon className={`w-8 h-8 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    {feature.description}
                  </CardDescription>
                  {feature.title === 'DPA disponible' && (
                    <div className="mt-4 text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href="/docs/DPA_short_fr_EN.md" target="_blank">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Consulter
                        </Link>
                      </Button>
                    </div>
                  )}
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
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href="/demo">
              <Play className="mr-2 w-4 h-4" />
              Voir la démo
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}