/**
 * Billing Tiers and Usage Limits
 * Centralized system for enforcing per-tier limits
 */

import type { TierType } from './features'

export interface TierLimits {
  // Team limits
  seats: number
  
  // Document limits  
  documents_count: number
  storage_bytes: number // in bytes
  
  // Chat limits
  monthly_tokens: number
  chat_requests_per_minute: number
  
  // Feature availability (from features.ts but duplicated here for easy access)
  connectors: boolean
  compliance: boolean
  billing: boolean
  environment: boolean
  api_keys: boolean
}

export const TIER_LIMITS: Record<TierType, TierLimits> = {
  starter: {
    seats: 3,
    documents_count: 10,
    storage_bytes: 100 * 1024 * 1024, // 100 MB
    monthly_tokens: 50_000,
    chat_requests_per_minute: 10,
    connectors: false,
    compliance: false,
    billing: false,
    environment: false,
    api_keys: false,
  },
  pro: {
    seats: 10,
    documents_count: 100,
    storage_bytes: 1024 * 1024 * 1024, // 1 GB
    monthly_tokens: 500_000,
    chat_requests_per_minute: 60,
    connectors: false,
    compliance: true,
    billing: true,
    environment: false,
    api_keys: true,
  },
  enterprise: {
    seats: 100,
    documents_count: 1000,
    storage_bytes: 10 * 1024 * 1024 * 1024, // 10 GB
    monthly_tokens: 5_000_000,
    chat_requests_per_minute: 300,
    connectors: true,
    compliance: true,
    billing: true,
    environment: true,
    api_keys: true,
  },
}

export interface UsageStats {
  seats_used: number
  documents_count: number
  storage_bytes: number
  monthly_tokens_used: number
  current_month: string
}

export interface LimitCheckResult {
  allowed: boolean
  limit_exceeded?: string
  current_usage?: number
  limit?: number
  suggested_tier?: TierType
  error_code?: 'SEATS_EXCEEDED' | 'DOCUMENTS_EXCEEDED' | 'STORAGE_EXCEEDED' | 'TOKENS_EXCEEDED' | 'RATE_LIMITED'
}

/**
 * Check if an action is allowed based on current usage and tier limits
 */
export function checkLimit(
  tier: TierType,
  limitType: keyof TierLimits,
  currentUsage: number,
  increment: number = 1
): LimitCheckResult {
  const limits = TIER_LIMITS[tier]
  const limit = limits[limitType]
  
  // For boolean features, check if feature is available
  if (typeof limit === 'boolean') {
    return {
      allowed: limit,
      error_code: limit ? undefined : 'FEATURE_NOT_AVAILABLE' as any
    }
  }
  
  const wouldExceed = currentUsage + increment > (limit as number)
  
  if (wouldExceed) {
    // Suggest upgrade tier
    const suggestedTier = getSuggestedUpgradeTier(tier, limitType, currentUsage + increment)
    
    const errorCodes: Record<string, any> = {
      seats: 'SEATS_EXCEEDED',
      documents_count: 'DOCUMENTS_EXCEEDED', 
      storage_bytes: 'STORAGE_EXCEEDED',
      monthly_tokens: 'TOKENS_EXCEEDED',
      chat_requests_per_minute: 'RATE_LIMITED'
    }
    
    return {
      allowed: false,
      limit_exceeded: limitType,
      current_usage: currentUsage,
      limit: limit as number,
      suggested_tier: suggestedTier,
      error_code: errorCodes[limitType]
    }
  }
  
  return {
    allowed: true,
    current_usage: currentUsage,
    limit: limit as number
  }
}

/**
 * Get suggested upgrade tier for a specific limit
 */
function getSuggestedUpgradeTier(
  currentTier: TierType,
  limitType: keyof TierLimits,
  requiredValue: number
): TierType | undefined {
  const tierOrder: TierType[] = ['starter', 'pro', 'enterprise']
  const currentIndex = tierOrder.indexOf(currentTier)
  
  for (let i = currentIndex + 1; i < tierOrder.length; i++) {
    const tier = tierOrder[i]
    const limit = TIER_LIMITS[tier][limitType]
    
    if (typeof limit === 'number' && limit >= requiredValue) {
      return tier
    }
    if (typeof limit === 'boolean' && limit) {
      return tier  
    }
  }
  
  return undefined
}

/**
 * Get user-friendly limit names
 */
export const LIMIT_DISPLAY_NAMES: Record<keyof TierLimits, string> = {
  seats: 'Sièges équipe',
  documents_count: 'Documents',
  storage_bytes: 'Stockage',
  monthly_tokens: 'Tokens mensuels',
  chat_requests_per_minute: 'Requêtes par minute',
  connectors: 'Connecteurs',
  compliance: 'Conformité',
  billing: 'Facturation',
  environment: 'Environment',
  api_keys: 'Clés API'
}

/**
 * Format storage bytes for display
 */
export function formatStorageSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('fr-FR')
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(current: number, limit: number): number {
  return Math.min(Math.round((current / limit) * 100), 100)
}

/**
 * Check if usage is approaching limit (>80%)
 */
export function isApproachingLimit(current: number, limit: number): boolean {
  return getUsagePercentage(current, limit) >= 80
}

/**
 * Get tier upgrade benefits for display
 */
export function getTierUpgradeBenefits(fromTier: TierType, toTier: TierType): string[] {
  const fromLimits = TIER_LIMITS[fromTier]
  const toLimits = TIER_LIMITS[toTier]
  
  const benefits: string[] = []
  
  if (toLimits.seats > fromLimits.seats) {
    benefits.push(`${formatNumber(toLimits.seats)} sièges équipe`)
  }
  
  if (toLimits.documents_count > fromLimits.documents_count) {
    benefits.push(`${formatNumber(toLimits.documents_count)} documents`)
  }
  
  if (toLimits.storage_bytes > fromLimits.storage_bytes) {
    benefits.push(`${formatStorageSize(toLimits.storage_bytes)} de stockage`)
  }
  
  if (toLimits.monthly_tokens > fromLimits.monthly_tokens) {
    benefits.push(`${formatNumber(toLimits.monthly_tokens)} tokens mensuels`)
  }
  
  if (toLimits.connectors && !fromLimits.connectors) {
    benefits.push('Connecteurs avancés')
  }
  
  if (toLimits.compliance && !fromLimits.compliance) {
    benefits.push('Conformité et audit')
  }
  
  if (toLimits.api_keys && !fromLimits.api_keys) {
    benefits.push('Clés API')
  }
  
  return benefits
}