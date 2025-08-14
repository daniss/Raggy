"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Crown, Zap, Shield, Plug } from "lucide-react"
import type { TierType } from "@/lib/features"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentTier: TierType
  requiredTier: TierType
  featureName: string
}

const tierConfigs = {
  starter: {
    name: "Starter",
    price: "Gratuit",
    color: "bg-gray-100 text-gray-800",
    icon: <Crown className="w-4 h-4" />
  },
  pro: {
    name: "Pro",
    price: "29€/mois",
    color: "bg-blue-100 text-blue-800",
    icon: <Zap className="w-4 h-4" />
  },
  enterprise: {
    name: "Enterprise",
    price: "Sur demande",
    color: "bg-purple-100 text-purple-800",
    icon: <Shield className="w-4 h-4" />
  }
}

const featuresByTier = {
  starter: [
    "Jusqu'à 100 documents",
    "10 utilisateurs maximum",
    "Support communautaire",
    "Assistant IA basique",
    "Stockage 500MB"
  ],
  pro: [
    "Documents illimités",
    "Utilisateurs illimités", 
    "Historique des conversations",
    "Analytics d'utilisation",
    "Conformité et audit",
    "Clés API",
    "Support prioritaire"
  ],
  enterprise: [
    "Toutes les fonctionnalités Pro",
    "Connecteurs de données",
    "Environnement dédié", 
    "Rétention personnalisée",
    "SLA garantie 99.9%",
    "Support 24/7",
    "Intégrations avancées"
  ]
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentTier,
  requiredTier,
  featureName
}: UpgradeModalProps) {
  const currentConfig = tierConfigs[currentTier]
  const requiredConfig = tierConfigs[requiredTier]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="w-6 h-6 text-orange-500" />
            Fonctionnalité verrouillée
          </DialogTitle>
          <DialogDescription>
            La fonctionnalité <strong>{featureName}</strong> nécessite un abonnement{" "}
            <Badge className={requiredConfig.color}>
              {requiredConfig.icon}
              {requiredConfig.name}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {/* Plan actuel */}
          <div className={`p-4 border-2 rounded-lg ${currentTier === 'starter' ? 'border-gray-300' : 'border-gray-200'}`}>
            <div className="text-center">
              <Badge className={`mb-2 ${currentConfig.color}`}>
                {currentConfig.icon}
                Actuel
              </Badge>
              <h3 className="text-lg font-semibold">{currentConfig.name}</h3>
              <p className="text-2xl font-bold text-gray-900">{currentConfig.price}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {featuresByTier[currentTier].map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan requis */}
          <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50/50">
            <div className="text-center">
              <Badge className={`mb-2 ${requiredConfig.color}`}>
                {requiredConfig.icon}
                Requis
              </Badge>
              <h3 className="text-lg font-semibold">{requiredConfig.name}</h3>
              <p className="text-2xl font-bold text-blue-600">{requiredConfig.price}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {featuresByTier[requiredTier].map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className={featureName.toLowerCase().includes(feature.toLowerCase()) ? "font-semibold text-blue-600" : ""}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan Enterprise (si applicable) */}
          {requiredTier !== 'enterprise' && (
            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="text-center">
                <Badge className={tierConfigs.enterprise.color}>
                  {tierConfigs.enterprise.icon}
                  Enterprise
                </Badge>
                <h3 className="text-lg font-semibold mt-2">Enterprise</h3>
                <p className="text-2xl font-bold text-purple-600">{tierConfigs.enterprise.price}</p>
              </div>
              <ul className="mt-4 space-y-2">
                {featuresByTier.enterprise.slice(0, 4).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
                <li className="text-sm text-gray-500">+ bien plus encore...</li>
              </ul>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-yellow-800">Mise à niveau recommandée</h4>
              <p className="text-sm text-yellow-700">
                Débloquez <strong>{featureName}</strong> et bien d'autres fonctionnalités avancées 
                en passant au plan <strong>{requiredConfig.name}</strong>.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button 
            onClick={() => {
              // TODO: Rediriger vers la page de facturation
              console.log(`Upgrade to ${requiredTier}`)
              onClose()
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Passer au plan {requiredConfig.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}