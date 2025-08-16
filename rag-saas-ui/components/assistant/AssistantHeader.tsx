"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, FileText, Search, Zap } from "lucide-react"
import { useI18n } from "@/i18n/translations"
import type { FeatureKey } from "@/lib/features"

interface AssistantHeaderProps {
  citationsEnabled: boolean
  setCitationsEnabled: (enabled: boolean) => void
  quickMode: boolean
  setQuickMode: (enabled: boolean) => void
  citationsCount: number
  showCitationsSidePanel: boolean
  setShowCitationsSidePanel: (show: boolean) => void
  showUsageWarning: boolean
  organizationTier?: string | null
  onOpenLocked: (feature: FeatureKey) => void
}

export function AssistantHeader({
  citationsEnabled,
  setCitationsEnabled,
  quickMode,
  setQuickMode,
  citationsCount,
  showCitationsSidePanel,
  setShowCitationsSidePanel,
  showUsageWarning,
  organizationTier,
  onOpenLocked
}: AssistantHeaderProps) {
  const t = useI18n()

  return (
    <header className="border-b border-border/40 bg-card/50 backdrop-blur-md px-6 py-3 flex-shrink-0 transition-all duration-200 shadow-sm">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        
        {/* Left: Title + Status */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              {t.assistant.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div 
                className="w-1.5 h-1.5 rounded-full bg-green-500"
                style={{ boxShadow: '0 0 4px rgb(34 197 94 / 0.4)' }}
              />
              <span className="font-medium">{t.assistant.status_online}</span>
              <span className="hidden sm:inline">• {t.assistant.status_analyzing}</span>
              {showUsageWarning && (
                <Badge 
                  variant="outline" 
                  className="text-xs border-warning-500/20 text-warning-600 bg-warning-50/50 px-2 py-0.5 h-5 font-medium"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {t.assistant.quota_warning}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Center: Global Search (future enhancement) */}
        <div className="hidden lg:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.assistant.search_conversations}
              className="pl-10 h-9 bg-background/60 border-border/50 focus:border-accent-400 focus:ring-2 focus:ring-accent-200 text-sm placeholder:text-muted-foreground/70 transition-all duration-200 rounded-sm backdrop-blur-[8px]"
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          
          {/* Main Control Group */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1 gap-1">
            <Button
              variant={citationsEnabled ? "default" : "ghost"}
              size="sm"
              onClick={() => setCitationsEnabled(!citationsEnabled)}
              className="h-7 px-3 text-xs font-medium transition-all duration-200 rounded-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">{t.assistant.citations}</span>
            </Button>
            
            <Button
              variant={quickMode ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                if (organizationTier === 'starter') {
                  onOpenLocked('fast_mode')
                } else {
                  setQuickMode(!quickMode)
                }
              }}
              className="h-7 px-3 text-xs font-medium transition-all duration-200 rounded-xs"
              disabled={false}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">{t.assistant.fast_mode}</span>
              {organizationTier === 'starter' && (
                <span className="ml-1 text-xs opacity-60">🔒</span>
              )}
            </Button>
          </div>

          {/* Sources Button */}
          {citationsCount > 0 && citationsEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCitationsSidePanel(!showCitationsSidePanel)}
              className="h-8 px-3 text-xs font-medium border-border/60 bg-background/50 hover:bg-accent-50 transition-all duration-200 rounded-xs"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              <span>{t.assistant.sources}</span>
              <Badge 
                variant="secondary" 
                className="ml-2 h-4 px-1.5 text-xs bg-accent-100 text-accent-700 rounded-xs"
              >
                {citationsCount}
              </Badge>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}