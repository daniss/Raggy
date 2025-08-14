import type React from "react"

const toneClasses: Record<string, string> = {
  default: "bg-[var(--color-accent-bg)] text-[var(--color-primary)]",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  success: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
}

export interface SummaryPillProps {
  label: string
  value: React.ReactNode
  tone?: keyof typeof toneClasses
}

export const SummaryPill: React.FC<SummaryPillProps> = ({ label, value, tone = "default" }) => (
  <div className={`flex items-center gap-2 rounded-md px-3 py-2 shadow-sm ${toneClasses[tone]}`}>
    <span className="text-sm font-medium">{value}</span>
    <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
  </div>
)
