import type React from "react"
import { SummaryPill } from "./summary-pill"

export interface SummaryItem {
  label: string
  value: React.ReactNode
  tone?: "default" | "warning" | "danger" | "success"
}

interface SummaryBarProps {
  items: SummaryItem[]
  lastUpdated?: string
  className?: string
}

export const SummaryBar: React.FC<SummaryBarProps> = ({
  items,
  lastUpdated,
  className = "mb-4"
}) => {
  return (
    <div 
      className={`flex flex-wrap gap-3 items-center ${className}`}
      aria-label="Résumé"
    >
      {items.map((item, index) => (
        <SummaryPill
          key={`${item.label}-${index}`}
          label={item.label}
          value={item.value}
          tone={item.tone}
        />
      ))}
      {lastUpdated && (
        <span className="text-[11px] text-muted">
          Maj {lastUpdated}
        </span>
      )}
    </div>
  )
}