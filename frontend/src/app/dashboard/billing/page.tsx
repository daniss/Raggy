'use client';

import React from 'react';
import { CreditCard, FileText, Calendar, Download, Crown, Star, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, EmptyState } from '@/components/FeatureGate';

export default function BillingPage() {
  const { organization } = useOrganization();

  return (
    <FeatureGate feature="billing" permission="billing:view" fallback={
      <EmptyState
        icon={CreditCard}
        title="Facturation non disponible"
        description="Vous n'avez pas les permissions nécessaires pour consulter la facturation."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturation & Abonnement</h1>
            <p className="text-gray-600">
              Gérez votre abonnement et consultez vos factures
            </p>
          </div>
          
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Télécharger la facture
          </Button>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              Plan actuel
            </CardTitle>
            <CardDescription>
              Votre abonnement actuel et ses fonctionnalités
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  {organization?.tier === 'enterprise' ? (
                    <Crown className="w-6 h-6 text-white" />
                  ) : organization?.tier === 'pro' ? (
                    <Star className="w-6 h-6 text-white" />
                  ) : (
                    <FileText className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">
                    Plan {organization?.tier ? organization.tier.charAt(0).toUpperCase() + organization.tier.slice(1) : 'Starter'}
                  </h3>
                  <p className="text-blue-700">
                    {organization?.tier === 'enterprise' ? 'Solution complète pour les grandes entreprises' :
                     organization?.tier === 'pro' ? 'Fonctionnalités avancées pour les équipes' :
                     'Fonctionnalités de base pour débuter'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900">
                  {organization?.tier === 'enterprise' ? 'Sur mesure' :
                   organization?.tier === 'pro' ? '49€' :
                   'Gratuit'}
                </div>
                {organization?.tier !== 'starter' && (
                  <div className="text-sm text-blue-700">par mois</div>
                )}
              </div>
            </div>

            {/* Features included */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Fonctionnalités incluses :</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {getFeaturesByTier(organization?.tier || 'starter').map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents</p>
                  <p className="text-2xl font-bold text-gray-900">45 / 100</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tokens utilisés</p>
                  <p className="text-2xl font-bold text-gray-900">15K / 200K</p>
                </div>
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Prochaine facture</p>
                  <p className="text-2xl font-bold text-gray-900">15 déc</p>
                </div>
                <CreditCard className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Notice */}
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={CreditCard}
              title="Fonctionnalités de facturation en développement"
              description="Les fonctionnalités détaillées de facturation et de gestion d'abonnement seront disponibles prochainement."
            />
          </CardContent>
        </Card>
      </div>
    </FeatureGate>
  );
}

function getFeaturesByTier(tier: string): string[] {
  switch (tier) {
    case 'enterprise':
      return [
        'Documents illimités',
        'Tokens illimités',
        'Équipe illimitée',
        'Support dédié',
        'Intégrations personnalisées',
        'Audit et conformité',
        'Déploiement sur site',
        'SLA 99.9%'
      ];
    case 'pro':
      return [
        '1000 documents',
        '1M tokens/mois',
        '50 membres d\'équipe',
        'Analytics avancés',
        'API complète',
        'Support prioritaire',
        'Conformité RGPD',
        'Sauvegarde automatique'
      ];
    default:
      return [
        '100 documents',
        '200K tokens/mois',
        '5 membres d\'équipe',
        'Assistant IA de base',
        'Support email',
        'Conformité de base'
      ];
  }
}