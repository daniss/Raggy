"use client"

import { createContext, useContext, type ReactNode } from "react"

export type OrgTier = "starter" | "pro" | "enterprise"

export interface Org {
  id: string
  name: string
  tier: OrgTier
  slug: string
}

export interface OrgContextType {
  org: Org
  features: Record<string, boolean>
  limits: {
    documents: number | null
    tokens: number | null
    retention: number // days
  }
  switchOrg: (orgId: string) => void
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

// Mock data for demonstration
const mockOrg: Org = {
  id: "1",
  name: "Mon Organisation",
  tier: "starter",
  slug: "mon-org",
}

const getFeaturesByTier = (tier: OrgTier): Record<string, boolean> => {
  const features = {
    conversations: tier !== "starter",
    usage: tier !== "starter",
    compliance: tier !== "starter",
    team: true,
    apiKeys: tier !== "starter",
    connectors: tier === "enterprise",
    environment: tier === "enterprise",
    billing: tier !== "starter",
    advancedSettings: tier !== "starter",
  }
  return features
}

const getLimitsByTier = (tier: OrgTier) => {
  switch (tier) {
    case "starter":
      return { documents: 50, tokens: 10000, retention: 30 }
    case "pro":
      return { documents: 1000, tokens: 100000, retention: 90 }
    case "enterprise":
      return { documents: null, tokens: null, retention: 365 }
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const features = getFeaturesByTier(mockOrg.tier)
  const limits = getLimitsByTier(mockOrg.tier)

  const switchOrg = (orgId: string) => {
    // Mock implementation
    console.log("Switching to org:", orgId)
  }

  return <OrgContext.Provider value={{ org: mockOrg, features, limits, switchOrg }}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider")
  }
  return context
}
