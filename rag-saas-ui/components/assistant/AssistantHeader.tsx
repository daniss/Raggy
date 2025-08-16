"use client"

import { Button } from "@/components/ui/button"
import { Activity, FileSearch } from "lucide-react"

interface AssistantHeaderProps {
  onOpenDiagnostics: () => void
  onToggleInspector: () => void
}

export function AssistantHeader({ onOpenDiagnostics, onToggleInspector }: AssistantHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold">Assistant</h1>
        <div className="flex items-center space-x-2">
          {/* Telemetry indicators would go here */}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenDiagnostics}
          className="flex items-center space-x-2"
        >
          <Activity className="w-4 h-4" />
          <span>Diagnostics</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleInspector}
          className="flex items-center space-x-2"
        >
          <FileSearch className="w-4 h-4" />
          <span>Sources</span>
        </Button>
      </div>
    </header>
  )
}
