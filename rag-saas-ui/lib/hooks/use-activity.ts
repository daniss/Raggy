"use client"

import { useState, useEffect } from "react"

export interface Activity {
  id: string
  label: string
  time: string
  type: "document" | "question" | "analysis" | "system"
}

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: "1",
    label: "Document Rapport_Annuel_2024.pdf ajouté",
    time: "2024-01-15T10:31:00Z",
    type: "document",
  },
  {
    id: "2",
    label: "Question posée sur la stratégie marketing",
    time: "2024-01-15T10:32:00Z",
    type: "question",
  },
  {
    id: "3",
    label: "Document Contract_Client_ABC.docx analysé",
    time: "2024-01-15T09:45:00Z",
    type: "analysis",
  },
  {
    id: "4",
    label: "Nouveau utilisateur ajouté à l'équipe",
    time: "2024-01-15T09:12:00Z",
    type: "system",
  },
  {
    id: "5",
    label: "Document Presentation_Produit.pptx traité",
    time: "2024-01-15T08:30:00Z",
    type: "document",
  },
]

export function useActivity(limit: number = 5) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const fetchActivities = async () => {
      setLoading(true)
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Sort by most recent and limit
      const sortedActivities = MOCK_ACTIVITIES.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      ).slice(0, limit)

      setActivities(sortedActivities)
      setLoading(false)
    }

    fetchActivities()
  }, [limit])

  const addActivity = (activity: Omit<Activity, "id">) => {
    const newActivity: Activity = {
      ...activity,
      id: Date.now().toString(),
      time: new Date().toISOString(),
    }
    setActivities((prev) => [newActivity, ...prev.slice(0, limit - 1)])
  }

  return {
    activities,
    loading,
    addActivity,
  }
}