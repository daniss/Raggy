'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, X, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UpgradeBannerProps {
  type: 'documents' | 'tokens' | 'conversations' | 'storage';
  current: number;
  limit: number;
  onLearnMore: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function UpgradeBanner({ 
  type, 
  current, 
  limit, 
  onLearnMore, 
  onDismiss,
  className = ""
}: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  
  const percentage = (current / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  // Don't show if not near limit
  if (!isNearLimit || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'documents':
        return {
          title: 'Limite de documents approchée',
          description: `Vous utilisez ${current} documents sur ${limit} autorisés`,
          benefitTitle: 'Débloquer 1 000 documents',
          benefits: ['Traitement illimité', 'Support prioritaire', 'Analytics avancés'],
          cta: 'Passer à Pro'
        };
      case 'tokens':
        return {
          title: 'Quota de tokens épuisé',
          description: `${current.toLocaleString()} tokens utilisés ce mois`,
          benefitTitle: 'Tokens illimités',
          benefits: ['Usage illimité', 'Conversations longues', 'Pas de limite'],
          cta: 'Passer à Pro'
        };
      case 'conversations':
        return {
          title: 'Limite de conversations atteinte',
          description: `${current} conversations ce mois`,
          benefitTitle: 'Conversations illimitées',
          benefits: ['Historique complet', 'Export des données', 'Multi-utilisateurs'],
          cta: 'Passer à Pro'
        };
      case 'storage':
        return {
          title: 'Espace de stockage bientôt plein',
          description: `${(current / 1024).toFixed(1)} GB utilisés sur ${(limit / 1024).toFixed(1)} GB`,
          benefitTitle: 'Stockage étendu',
          benefits: ['50 GB de stockage', 'Sauvegarde automatique', 'Versioning de documents'],
          cta: 'Passer à Pro'
        };
      default:
        return {
          title: 'Limite atteinte',
          description: 'Passez à un plan supérieur',
          benefitTitle: 'Fonctionnalités avancées',
          benefits: ['Plus de ressources', 'Support prioritaire', 'Outils avancés'],
          cta: 'Découvrir Pro'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={className}
      >
        <Card className={`border-l-4 ${isAtLimit ? 'border-l-red-500 bg-red-50' : 'border-l-amber-500 bg-amber-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isAtLimit ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {isAtLimit ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </div>

              {/* Content */}
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className={`font-semibold text-sm ${
                      isAtLimit ? 'text-red-900' : 'text-amber-900'
                    }`}>
                      {config.title}
                    </h3>
                    <p className={`text-xs mt-1 ${
                      isAtLimit ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {config.description}
                    </p>
                  </div>
                  
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="text-gray-400 hover:text-gray-600 h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className={`w-full bg-gray-200 rounded-full h-2`}>
                    <motion.div
                      className={`h-2 rounded-full ${
                        isAtLimit ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{current.toLocaleString()}</span>
                    <span>{limit.toLocaleString()}</span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-1">
                      <Crown className="w-4 h-4 text-purple-600" />
                      {config.benefitTitle}
                    </h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {config.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={onLearnMore}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {config.cta}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}