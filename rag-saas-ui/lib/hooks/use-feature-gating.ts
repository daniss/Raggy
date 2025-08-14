"use client"

import { useApp } from "@/contexts/app-context"
import { hasFeature, isLocked, type FeatureKey } from "@/lib/features"
import type { TierType } from "@/lib/features"

export function useFeatureGating() {
  const { openLockedFeatureModal, orgTier } = useApp()

  const checkFeature = (featureKey: FeatureKey) => {
    return hasFeature(orgTier as TierType, featureKey)
  }

  const checkLocked = (featureKey: FeatureKey) => {
    return isLocked(orgTier as TierType, featureKey)
  }

  const openLockedModal = (featureKey: FeatureKey) => {
    openLockedFeatureModal(featureKey)
  }

  const handleFeatureClick = (featureKey: FeatureKey, onSuccess: () => void) => {
    if (checkLocked(featureKey)) {
      openLockedModal(featureKey)
      return
    }
    onSuccess()
  }

  return {
    hasFeature: checkFeature,
    isLocked: checkLocked,
    openLocked: openLockedModal,
    handleFeatureClick,
  }
}