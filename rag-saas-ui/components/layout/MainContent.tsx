import type React from "react"
import { cn } from "@/lib/utils"

interface MainContentProps {
  children: React.ReactNode
  className?: string
}

export const MainContent: React.FC<MainContentProps> = ({ children, className }) => {
  return (
    <div className={cn("px-6 py-6 max-w-7xl mx-auto", className)}>
      {children}
    </div>
  )
}