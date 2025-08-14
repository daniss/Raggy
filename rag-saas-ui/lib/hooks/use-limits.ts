"use client"

import { useApp } from "@/contexts/app-context"
import type { TierType } from "@/lib/features"

export interface Limits {
  docsUsed: number
  docsLimit: number
  tokensUsed: number
  tokensLimit: number
  ratioDocs: number
  ratioTokens: number
  storageBytes: number
  storageLimit: number
  ratioStorage: number
}

export function useLimits(): Limits {
  const { organization } = useApp()

  // Mock data based on tier - in real app this would come from API
  const getTierLimits = () => {
    switch (organization?.tier as TierType) {
      case "starter":
        return {
          docsLimit: 100,
          tokensLimit: 200000,
          storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        }
      case "pro":
        return {
          docsLimit: 1000,
          tokensLimit: 1000000,
          storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
        }
      case "enterprise":
        return {
          docsLimit: 10000,
          tokensLimit: 5000000,
          storageLimit: 1000 * 1024 * 1024 * 1024, // 1TB
        }
      default:
        return {
          docsLimit: 100,
          tokensLimit: 200000,
          storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        }
    }
  }

  // Mock current usage - in real app this would come from API/state
  const getCurrentUsage = () => {
    return {
      docsUsed: 24,
      tokensUsed: 120000,
      storageBytes: 8.6 * 1024 * 1024 * 1024, // 8.6GB
    }
  }

  const limits = getTierLimits()
  const usage = getCurrentUsage()

  const ratioDocs = usage.docsUsed / limits.docsLimit
  const ratioTokens = usage.tokensUsed / limits.tokensLimit
  const ratioStorage = usage.storageBytes / limits.storageLimit

  return {
    docsUsed: usage.docsUsed,
    docsLimit: limits.docsLimit,
    tokensUsed: usage.tokensUsed,
    tokensLimit: limits.tokensLimit,
    storageBytes: usage.storageBytes,
    storageLimit: limits.storageLimit,
    ratioDocs,
    ratioTokens,
    ratioStorage,
  }
}

export function shouldShowUpgradeBanner(limits: Limits): boolean {
  return limits.ratioDocs >= 0.8 || limits.ratioTokens >= 0.8 || limits.ratioStorage >= 0.8
}