import type React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  children,
  className 
}) => {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <div className="text-sm text-muted mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {children && (
          <div className="ml-4 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}