"use client"

import { useState, useEffect } from "react"

export interface OnboardingItem {
  key: string
  label: string
  completed: boolean
}

const DEFAULT_ITEMS: OnboardingItem[] = [
  { key: "upload_first_doc", label: "Importer un document", completed: false },
  { key: "ask_first_question", label: "Poser une question", completed: false },
  { key: "view_citation", label: "Voir une citation", completed: false },
  { key: "download_purge_proof", label: "Générer une preuve de purge", completed: false },
]

const STORAGE_KEY = "onboarding_progress"

export function useOnboarding() {
  const [items, setItems] = useState<OnboardingItem[]>(DEFAULT_ITEMS)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        setItems(data.items || DEFAULT_ITEMS)
        setDismissed(data.dismissed || false)
      }
    } catch (error) {
      console.warn("Failed to load onboarding progress:", error)
    }
  }, [])

  const saveToStorage = (newItems: OnboardingItem[], newDismissed: boolean) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items: newItems,
          dismissed: newDismissed,
        }),
      )
    } catch (error) {
      console.warn("Failed to save onboarding progress:", error)
    }
  }

  const markComplete = (key: string) => {
    const newItems = items.map((item) => (item.key === key ? { ...item, completed: true } : item))
    setItems(newItems)
    saveToStorage(newItems, dismissed)
  }

  const markIncomplete = (key: string) => {
    const newItems = items.map((item) => (item.key === key ? { ...item, completed: false } : item))
    setItems(newItems)
    saveToStorage(newItems, dismissed)
  }

  const dismiss = () => {
    setDismissed(true)
    saveToStorage(items, true)
  }

  const reset = () => {
    setItems(DEFAULT_ITEMS)
    setDismissed(false)
    saveToStorage(DEFAULT_ITEMS, false)
  }

  const isComplete = items.every((item) => item.completed)
  const completedCount = items.filter((item) => item.completed).length
  const progress = completedCount / items.length

  return {
    items,
    dismissed,
    isComplete,
    completedCount,
    progress,
    markComplete,
    markIncomplete,
    dismiss,
    reset,
  }
}