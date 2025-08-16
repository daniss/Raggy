"use client"

import { useEffect } from "react"

interface KeyboardShortcutsProps {
  onOpenCommandPalette: () => void
  onToggleInspector: () => void
  onFocusComposer: () => void
}

export function KeyboardShortcuts({
  onOpenCommandPalette,
  onToggleInspector,
  onFocusComposer
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenCommandPalette()
      }
      
      // Toggle inspector
      if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onToggleInspector()
      }
      
      // Focus composer
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onFocusComposer()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenCommandPalette, onToggleInspector, onFocusComposer])

  return null
}
