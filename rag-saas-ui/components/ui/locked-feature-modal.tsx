"use client"

import type React from "react"
import { X } from "lucide-react"
import type { FeatureKey } from "@/lib/features"
import { hasFeature } from "@/lib/features"

interface LockedFeatureModalProps {
  featureKey: FeatureKey | null
  onClose: () => void
  onUpgrade: () => void
  open: boolean
}

const featureContent: Record<FeatureKey, { title: string; bullets: string[]; minTier: 'pro' | 'enterprise' }> = {
  conversations: {
    title: "Historique des conversations",
    bullets: ["Retrouvez toutes vos discussions", "Recherche et filtrage", "Export & collaboration (à venir)"],
    minTier: "pro",
  },
  usage: {
    title: "Tableaux d'utilisation",
    bullets: ["Suivi tokens & documents", "Utilisateurs actifs", "Questions sans réponse"],
    minTier: "pro",
  },
  connectors: {
    title: "Connecteurs sources",
    bullets: ["SharePoint, Drive, S3", "Sync planifiée", "Supervision des runs"],
    minTier: "enterprise",
  },
  environment: {
    title: "Environnement dédié",
    bullets: ["Isolation renforcée", "SLA avancé", "Déploiement souverain"],
    minTier: "enterprise",
  },
  compliance: {
    title: "Conformité avancée",
    bullets: ["Audit trail complet", "Preuve de purge", "Certification RGPD"],
    minTier: "pro",
  },
  apiKeys: {
    title: "Clés API",
    bullets: ["Intégration programmatique", "Gestion des permissions", "Monitoring des appels"],
    minTier: "pro",
  },
  billing: {
    title: "Facturation avancée",
    bullets: ["Factures détaillées", "Gestion des paiements", "Analytics d'utilisation"],
    minTier: "pro",
  },
  fast_mode: {
    title: "Mode rapide IA",
    bullets: ["Réponses ultra-rapides", "Modèles optimisés", "Priorité de traitement"],
    minTier: "pro",
  },
  custom_prompts: {
    title: "Prompts personnalisés",
    bullets: ["Définir vos propres prompts", "Sauvegarder vos modèles", "Optimiser vos réponses"],
    minTier: "pro",
  },
}

export const LockedFeatureModal: React.FC<LockedFeatureModalProps> = ({ featureKey, onClose, onUpgrade, open }) => {
  if (!open || !featureKey) return null

  const content = featureContent[featureKey] || { title: "Fonctionnalité Pro", bullets: [], minTier: "pro" }
  const tierLabel = content.minTier === 'enterprise' ? 'Enterprise' : 'Pro'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-pop)] w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-lg font-semibold">
            {content.title} ({tierLabel})
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-subtle)] rounded" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="list-disc list-inside text-sm space-y-1 mb-4">
          {content.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm px-3 py-2 rounded-md bg-[var(--color-bg-subtle)] hover:bg-[var(--color-border)] transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={onUpgrade}
            className="text-sm px-3 py-2 rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Voir les plans
          </button>
        </div>
      </div>
    </div>
  )
}
