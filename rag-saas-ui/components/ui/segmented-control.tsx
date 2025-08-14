"use client"

import type React from "react"
import { cn } from "@/lib/utils"

export interface SegmentedControlOption {
  value: string
  label: string
  count?: number
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onValueChange,
  className,
}) => {
  return (
    <div
      className={cn(
        "inline-flex bg-gray-100 rounded-lg p-1 gap-1",
        className,
      )}
      role="tablist"
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
            value === option.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
          )}
          role="tab"
          aria-selected={value === option.value}
          aria-controls={`tabpanel-${option.value}`}
        >
          <span className="flex items-center gap-1.5">
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  value === option.value
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-600",
                )}
              >
                {option.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}