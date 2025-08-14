export type TierType = "starter" | "pro" | "enterprise"

export const featureMatrix = {
  starter: {
    usage: false,
    conversations: false,
    compliance: false,
    connectors: false,
    environment: false,
    apiKeys: false,
    billing: false,
    fast_mode: false,
  },
  pro: {
    usage: true,
    conversations: true,
    compliance: true,
    connectors: false,
    environment: false,
    apiKeys: true,
    billing: true,
    fast_mode: true,
  },
  enterprise: {
    usage: true,
    conversations: true,
    compliance: true,
    connectors: true,
    environment: true,
    apiKeys: true,
    billing: true,
    fast_mode: true,
  },
} as const

export type FeatureKey = keyof typeof featureMatrix.starter

export function hasFeature(tier: TierType, feature: FeatureKey): boolean {
  return featureMatrix[tier][feature]
}

export function isLocked(tier: TierType, feature: FeatureKey): boolean {
  return !hasFeature(tier, feature)
}
