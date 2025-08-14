"use client"

import type React from "react"
import { Check } from "lucide-react"

interface OnboardingItem {
  key: string
  label: string
  completed: boolean
}

export interface OnboardingChecklistProps {
  items: OnboardingItem[]
  onDismiss: () => void
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ items, onDismiss }) => {
  const allDone = items.every((i) => i.completed)
  if (allDone) return null

  return (
    <div className="surface-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Commencez ici</h2>
        <button
          onClick={onDismiss}
          className="text-xs text-muted hover:underline"
          aria-label="Ignorer la liste d'intégration"
        >
          Ignorer
        </button>
      </div>
      <ul className="space-y-2" role="list">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 text-sm">
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center ${
                item.completed
                  ? "bg-[var(--color-success)] border-[var(--color-success)] text-white"
                  : "border-[var(--color-border)] text-transparent"
              }`}
              aria-hidden="true"
            >
              {item.completed && <Check className="w-3 h-3" />}
            </span>
            <span className={item.completed ? "line-through text-muted" : "text-[var(--color-text)]"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
