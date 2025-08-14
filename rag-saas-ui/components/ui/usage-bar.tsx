"use client"

import type React from "react"
import { cn } from "@/lib/utils"

export interface UsageBarProps {
  label: string
  current: number
  limit: number
  unit?: string
  className?: string
  showNumbers?: boolean
}

export const UsageBar: React.FC<UsageBarProps> = ({
  label,
  current,
  limit,
  unit = "",
  className,
  showNumbers = true,
}) => {
  const percentage = Math.min((current / limit) * 100, 100)
  const isNearLimit = percentage >= 80
  const isOverLimit = percentage >= 100

  const formatNumber = (num: number) => {
    if (unit === "bytes") {
      const gb = (num / (1024 * 1024 * 1024)).toFixed(1)
      return `${gb} GB`
    }
    return num.toLocaleString("fr-FR")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        {showNumbers && (
          <span className={cn("font-medium", isOverLimit ? "text-red-600" : "text-gray-900")}>
            {formatNumber(current)} / {formatNumber(limit)}
            {unit && unit !== "bytes" && ` ${unit}`}
          </span>
        )}
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-2 rounded-full transition-all duration-300 ease-out",
            isOverLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-yellow-500"
                : "bg-blue-500",
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemax={limit}
          aria-label={`${label}: ${current} sur ${limit}`}
        />
      </div>
      
      {isNearLimit && (
        <p className={cn("text-xs", isOverLimit ? "text-red-600" : "text-yellow-600")}>
          {isOverLimit
            ? "Limite dépassée"
            : `${Math.ceil((limit - current) / limit * 100)}% restant`}
        </p>
      )}
    </div>
  )
}