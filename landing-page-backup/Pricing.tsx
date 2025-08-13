'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle,
  Shield,
  Star,
  ExternalLink,
  Database,
  Globe,
  FileText
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
      setupPrice: '0 € HT',
      monthlyPrice: '0 €/mois HT',
      annualPrice: 'Essai gratuit 14 jours (pas de carte bancaire)',
      tagline: 'Parfait pour tester / projets pilotes',
      limits: {
        users: '2 utilisateurs',
        docs: '100 documents / 2 Go',
        tokens: '50k tokens/mois'
      },
      features: [
        'Upload multi-format (PDF, DOCX, TXT, CSV)',
        'Chat streaming avec citations sources',
        'Interface clé en main',
        'Hébergement UE',
        'Onboarding vidéo pré-enregistrée'
      ],
      compliance: [
        'Chiffrement en transit (TLS)',
        'Volumes chiffrés (AES-256)',
        'Journaux d\'audit essentiels',
        'Résidence des données UE'
      ],
      support: 'Email (72h ouvrées)',
      popular: false
    },
    {
      name: 'Team', 
      setupPrice: '249 € HT',
      monthlyPrice: '299 €/mois HT',
      annualPrice: 'ou 3 200 €/an HT (-10%)',
      tagline: 'Sweet spot PME — scaling simple',
      limits: {
        users: '5 utilisateurs',
        docs: '500 documents / 10 Go',
        tokens: '200k tokens/mois'
      },
      features: [
        'Tout Starter inclus',
        'Export des données',
        'API basique',
        'Historique étendu',
        'Académie vidéo complète'
      ],
      compliance: [
        'Tout Starter inclus',
        'Authentification 2FA (TOTP)',
        'Journalisation étendue',
        'DPA signable fourni'
      ],
      support: 'Email prioritaire (48h ouvrées)',
      popular: true
    },
    {
      name: 'Business',
      setupPrice: '499 € HT',
      monthlyPrice: '599 €/mois HT',
      annualPrice: 'ou 6 400 €/an HT (-10%)',
      tagline: 'Conçu pour équipes jusqu\'à 15 personnes',
      limits: {
        users: '15 utilisateurs',
        docs: '2 000 documents / 50 Go',
        tokens: '500k tokens/mois'
      },
      features: [
        'Tout Team inclus',
        'SSO/SAML',
        'API complète + Webhooks',
        'Espaces d\'équipe',
        '1 call d\'onboarding inclus'
      ],
      compliance: [
        'Tout Team inclus',
        'Isolation logique par organisation (RLS)',
        'Audit logs avancés',
        'Conformité enterprise'
      ],
      support: 'Support prioritaire + 1 call setup',
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
            Tarifs simplifiés
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-xl text-slate-600 max-w-3xl mx-auto">
            Vos documents d'entreprise deviennent intelligents en 5 minutes. Commencez gratuitement.<br/>
            <span className="text-lg font-medium text-purple-700 mt-2 inline-block">
              Résidence des données : UE (option France/HDS sur demande)
            </span>
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
                  <div className="mb-2">
                    <div className="text-lg font-semibold text-slate-700 mb-1">Setup</div>
                    <div className="text-2xl font-bold text-slate-900">{plan.setupPrice}</div>
                  </div>
                  <div className="mb-4">
                    <div className="text-lg font-semibold text-slate-700 mb-1">Abonnement</div>
                    <div className="text-2xl font-bold text-blue-600">{plan.monthlyPrice}</div>
                    <div className="text-sm text-slate-500">{plan.annualPrice}</div>
                  </div>
                  <CardDescription className="text-lg font-medium text-blue-600">
                    {plan.tagline}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-6">
                  {/* Limits Section */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Limites incluses</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                        {plan.limits.users}
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                        {plan.limits.docs}
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                        {plan.limits.tokens}
                      </li>
                    </ul>
                  </div>

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
                        {plan.name === 'Starter' ? 'Essai gratuit 14 jours' : 'Commencer maintenant'}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Managed/Enterprise Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="mb-16"
        >
          <motion.div variants={fadeInUp} className="max-w-4xl mx-auto">
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-xl">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center mb-3">
                  <Badge className="bg-purple-600 text-white px-4 py-2 text-sm font-medium">
                    <Shield className="w-4 h-4 mr-2" />
                    Enterprise
                  </Badge>
                </div>
                <CardTitle className="text-3xl mb-3 text-slate-900">Managed / Enterprise</CardTitle>
                <CardDescription className="text-xl font-medium text-purple-700 mb-4">
                  Données sensibles & intégrations critiques
                </CardDescription>
                <div className="text-2xl font-bold text-slate-900">
                  SUR DEVIS
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  Pour clients régulés (santé, finance, juridique) ou besoins d'intégration profonde
                </p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Infrastructure */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-900 flex items-center">
                      <Database className="w-5 h-5 mr-2 text-purple-600" />
                      Infrastructure dédiée
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Hébergement dédié (Cloud FR / on-premise possible)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Option certification HDS (accompagnement)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">SLA 99.9%, RTO/RPO définis</span>
                      </li>
                    </ul>
                  </div>

                  {/* Intégrations */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-900 flex items-center">
                      <Globe className="w-5 h-5 mr-2 text-purple-600" />
                      Intégrations & Gouvernance
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Connecteurs vers ERP / DMS / Bases internes</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Audit source des données, mapping, suppression</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">Formation DPO / atelier gouvernance inclus</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Pricing indicative */}
                <div className="border-t pt-6">
                  <h4 className="font-semibold text-slate-900 mb-4">Exemples de tarification indicative</h4>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="font-medium text-slate-900 mb-1">Setup / audit conformité</div>
                      <div className="text-lg font-bold text-purple-600">à partir de 3 000 €</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="font-medium text-slate-900 mb-1">Hébergement dédié + maintenance</div>
                      <div className="text-lg font-bold text-purple-600">à partir de 2 000 €/mois</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="font-medium text-slate-900 mb-1">Option HDS / certification</div>
                      <div className="text-lg font-bold text-purple-600">sur devis</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-6 text-center">
                  <Button 
                    asChild 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
                    size="lg"
                  >
                    <a href="mailto:hello@raggy.fr?subject=Demande%20Enterprise%20-%20Demo%20%26%20Audit">
                      Contact commercial → Demo & audit gratuit 30 min
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Enhanced Add-ons Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="mt-20"
        >
          <motion.div variants={fadeInUp} className="text-center mb-12">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Add-ons & Services</h3>
            <p className="text-slate-600">Extensions et services professionnels disponibles</p>
          </motion.div>

          <motion.div 
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-2">Stockage supplémentaire</h4>
                <div className="text-2xl font-bold text-blue-600 mb-3">+50€/mois HT</div>
                <p className="text-sm text-slate-600">+50 Go d'espace documents</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-2">Pack Audit RGPD/AI Act</h4>
                <div className="text-2xl font-bold text-green-600 mb-3">1 500€</div>
                <p className="text-sm text-slate-600">Rapport + plan d'action DPO</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-2">Connecteur personnalisé</h4>
                <div className="text-2xl font-bold text-orange-600 mb-3">500-2k€</div>
                <p className="text-sm text-slate-600">ERP / DMS selon complexité</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-2">Migration assistée</h4>
                <div className="text-2xl font-bold text-purple-600 mb-3">Sur devis</div>
                <p className="text-sm text-slate-600">Forfait à la journée</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mt-8">
            <p className="text-sm text-slate-500">
              Les tokens dépassés passent automatiquement au plan supérieur
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Pour &gt; 15 utilisateurs ou besoins spécifiques :{' '}
              <a href="mailto:hello@raggy.fr" className="text-blue-600 hover:text-blue-700">
                hello@raggy.fr
              </a>
            </p>
          </motion.div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="mt-16"
        >
          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Questions fréquentes</h3>
          </motion.div>

          <motion.div variants={fadeInUp} className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Puis-je avoir mes données en France ?</h4>
                  <p className="text-sm text-slate-600">
                    Oui, option sur demande. Hébergement France disponible avec surcoût, accompagnement HDS possible.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Ai-je besoin d'HDS ?</h4>
                  <p className="text-sm text-slate-600">
                    Si vous hébergez des données de santé, nous accompagnons la montée en conformité HDS.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Comment upgrader vers Managed ?</h4>
                  <p className="text-sm text-slate-600">
                    Passage à Managed = audit 2-4 semaines + migration assistée depuis votre compte existant.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Données sensibles ?</h4>
                  <p className="text-sm text-slate-600">
                    Finance, santé, juridique : nous proposons un audit gratuit pour évaluer vos besoins de conformité.
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </motion.div>

        {/* Business Terms */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="text-center space-y-4 bg-slate-50 rounded-lg p-6"
        >
          <h4 className="font-semibold text-slate-900 mb-4">Conditions simples</h4>
          
          {/* Badges de confiance */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <Badge variant="outline" className="px-3 py-1">
              <Shield className="w-4 h-4 mr-2" />
              RGPD Compliant
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Globe className="w-4 h-4 mr-2" />
              Résidence des données : UE
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Database className="w-4 h-4 mr-2" />
              Option France/HDS
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <FileText className="w-4 h-4 mr-2" />
              DPA signable
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
            <div>• Tous les prix HT — facturation en € — mise à l'échelle facile, upgrade instantané</div>
            <div>• Essai gratuit 14 jours sans carte bancaire</div>
            <div>• Résiliation possible à tout moment</div>
            <div>• Facturation mensuelle par Stripe</div>
          </div>
          <div className="mt-6 text-sm text-slate-500 space-y-2">
            <p>
              <Link 
                href="/docs/DPA_short_fr_EN.md" 
                target="_blank"
                className="inline-flex items-center hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Consulter notre DPA (Contrat de traitement des données)
              </Link>
            </p>
            <p className="text-xs">
              Support par email uniquement. Pas de SLA contractuel. Simple, efficace, sans surprises.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}