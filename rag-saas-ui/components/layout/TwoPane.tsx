import type React from "react"
import { cn } from "@/lib/utils"

interface TwoPaneProps {
  leftWidth?: number
  leftPane: React.ReactNode
  rightPane: React.ReactNode
  className?: string
}

export const TwoPane: React.FC<TwoPaneProps> = ({
  leftWidth = 280,
  leftPane,
  rightPane,
  className
}) => {
  return (
    <div className={cn("flex gap-6 h-full", className)}>
      {/* Left Pane */}
      <div 
        className="flex-shrink-0 border-r border-border pt-6 px-4"
        style={{ width: leftWidth }}
      >
        {leftPane}
      </div>
      
      {/* Right Pane */}
      <div className="flex-1 min-w-0">
        {rightPane}
      </div>
    </div>
  )
}