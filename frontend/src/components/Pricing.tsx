'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle,
  Shield,
  Star,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function Pricing() {
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

  const pricingPlans = [
    {
      name: 'Starter',
      price: '1 200 €',
      tagline: 'Pour PoC rapide',
      features: [
        'Upload multi-format (PDF, DOCX, TXT, CSV)',
        'Chat streaming avec citations sources',
        'Interface utilisateur complète',
        'Déploiement Docker Compose',
        'Documentation technique fournie'
      ],
      compliance: [
        'Chiffrement AES-256 au repos',
        'Communications TLS 1.3',
        'Logs d\'audit de base',
        'Hébergement UE recommandé'
      ],
      support: 'Support Email Standard',
      popular: false
    },
    {
      name: 'Pro', 
      price: '2 000 €',
      tagline: 'Pour équipes',
      features: [
        'Tout Starter inclus',
        'Personnalisation des prompts IA',
        'Configuration avancée des index',
        'Gestion multi-utilisateurs',
        'API d\'intégration complète',
        'Sauvegarde automatique'
      ],
      compliance: [
        'DPA signable fourni',
        'Authentification multi-facteurs',
        'Audit trail complet',
        'Chiffrement bout-en-bout',
        'Isolation par organisation'
      ],
      support: 'Support Email + 2h onboarding incluses',
      popular: true
    },
    {
      name: 'Enterprise',
      price: '3 500+ €',
      tagline: 'Pour déploiements sur-mesure',
      features: [
        'Tout Pro inclus',
        'Intégration SSO/SAML',
        'Connecteurs métiers personnalisés',
        'Modèles IA privés (vLLM/TGI)',
        'Infrastructure dédiée',
        'Conformité secteur spécifique'
      ],
      compliance: [
        'Certification ISO 27001 disponible',
        'Audit de sécurité inclus',
        'Preuve de purge cryptographique',
        'Conformité ANSSI/HDS sur demande',
        'Hébergement souverain garanti'
      ],
      support: 'Support dédié avec SLA 4h + CSM assigné',
      popular: false
    }
  ];

  return (
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
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12"
        >
          {pricingPlans.map((plan, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className={`relative h-full hover:shadow-lg transition-shadow ${
                plan.popular ? 'border-2 border-blue-500 shadow-lg' : 'border'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1 text-sm font-medium">
                      <Star className="w-3 h-3 mr-1" />
                      Populaire
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  </div>
                  <CardDescription className="text-lg font-medium text-blue-600">
                    {plan.tagline}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-6">
                  {/* Features Section */}
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Fonctionnalités</h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Compliance Section */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-green-600" />
                      Conformité
                    </h4>
                    <ul className="space-y-2">
                      {plan.compliance.map((complianceItem, complianceIndex) => (
                        <li key={complianceIndex} className="flex items-start">
                          <Shield className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-600">{complianceItem}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Support Section */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-slate-900 mb-2">Support</h4>
                    <p className="text-sm text-slate-600">{plan.support}</p>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-4">
                    <Button 
                      asChild 
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                      }`}
                      size="lg"
                    >
                      <Link href="/demo">
                        Essayer la démo
                      </Link>
                    </Button>
                  </div>
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
          className="text-center space-y-4"
        >
          <p className="text-slate-600">
            Tarifs HT. Facturation sur devis pour Enterprise.
          </p>
          <p className="text-sm text-slate-500">
            <Link 
              href="/docs/DPA_short_fr_EN.md" 
              target="_blank"
              className="inline-flex items-center hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Consulter notre DPA (Contrat de traitement des données)
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}