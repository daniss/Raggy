"use client"

import { useEffect, useState } from "react"
import { getDashboardData, type DashboardData } from "@/lib/mocks/dashboard"

export function useDashboardData() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return {
    loading,
    ...data,
  }
}
