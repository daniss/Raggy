"use client"

import type React from "react"

export interface UpgradeBannerProps {
  type: "docs" | "tokens"
  current: number
  limit: number
  onClick?: () => void
  className?: string
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ 
  type, 
  current, 
  limit, 
  onClick = () => console.log("Upgrade clicked"),
  className 
}) => {
  const pct = Math.round((current / limit) * 100)
  if (pct < 80) return null

  const label = type === "docs" ? "documents" : "tokens"

  return (
    <div className={`border border-yellow-200 bg-yellow-50 text-sm rounded-lg p-3 flex flex-wrap items-center gap-3 ${className || ""}`}>
      <span>
        Vous avez utilisé {pct}% de votre limite de {label} ({current} / {limit}).
      </span>
      <button
        onClick={onClick}
        className="ml-auto bg-blue-600 text-white text-xs px-3 py-1 rounded-md hover:bg-blue-700 transition-colors"
      >
        Voir les plans
      </button>
    </div>
  )
}
