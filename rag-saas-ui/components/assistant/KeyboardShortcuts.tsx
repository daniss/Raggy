"use client"

import { useEffect } from "react"

interface KeyboardShortcutsProps {
  onFocusComposer?: () => void
  onNewConversation?: () => void
  onToggleSidebar?: () => void
  onToggleCitations?: () => void
}

export function useKeyboardShortcuts({
  onFocusComposer,
  onNewConversation,
  onToggleSidebar,
  onToggleCitations
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      // Cmd/Ctrl + K: Focus composer
      if (cmdOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onFocusComposer?.()
        return
      }

      // Cmd/Ctrl + N: New conversation
      if (cmdOrCtrl && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onNewConversation?.()
        return
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (cmdOrCtrl && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        onToggleSidebar?.()
        return
      }

      // Cmd/Ctrl + Shift + C: Toggle citations
      if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        onToggleCitations?.()
        return
      }

      // Escape: Global escape handler
      if (event.key === 'Escape') {
        // Let individual components handle escape
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onFocusComposer, onNewConversation, onToggleSidebar, onToggleCitations])
}

// Keyboard shortcuts help component
export function KeyboardShortcutsHelp() {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? '⌘' : 'Ctrl'

  const shortcuts = [
    { keys: `${cmdKey} + K`, description: 'Focus message input' },
    { keys: `${cmdKey} + N`, description: 'New conversation' },
    { keys: `${cmdKey} + B`, description: 'Toggle conversations sidebar' },
    { keys: `${cmdKey} + Shift + C`, description: 'Toggle citations panel' },
    { keys: 'Enter', description: 'Send message' },
    { keys: 'Shift + Enter', description: 'New line in message' },
    { keys: 'Esc', description: 'Close panels or clear focus' },
  ]

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground mb-3">Keyboard Shortcuts</h4>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <span className="text-text-subtle">{shortcut.description}</span>
            <kbd className="px-2 py-1 bg-surface-elevated border border-border/40 rounded text-text-subtle font-mono">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}