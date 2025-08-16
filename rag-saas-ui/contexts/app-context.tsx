"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { TierType, FeatureKey } from "@/lib/features"
import type { User, Session } from "@supabase/supabase-js"
import type { Profile, Organization, UserRole } from "@/lib/supabase/database.types"

interface AppContextType {
  // Auth state
  user: User | null
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isSettingUpOrg: boolean

  // Organization state
  organization: Organization | null
  userRole: UserRole | null
  orgName: string
  orgTier: TierType

  // Modal state
  lockedFeatureModal: {
    open: boolean
    featureKey: FeatureKey | null
  }

  // Actions
  openLockedFeatureModal: (featureKey: FeatureKey) => void
  closeLockedFeatureModal: () => void
  setOrgTier: (tier: TierType) => void
  refreshOrganization: () => Promise<void>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingUpOrg, setIsSettingUpOrg] = useState(false)
  const [lockedFeatureModal, setLockedFeatureModal] = useState<{
    open: boolean
    featureKey: FeatureKey | null
  }>({
    open: false,
    featureKey: null,
  })

  const supabase = createSupabaseBrowserClient()

  // Fetch organization data
  const fetchOrganizationData = async () => {
    try {
      const response = await fetch('/api/org')
      if (response.ok) {
        const data = await response.json()
        setOrganization(data.organization)
        setUserRole(data.userRole)
        return true
      } else if (response.status === 404) {
        // No organization found, redirect to onboarding
        console.warn('No organization found for user, redirecting to onboarding')
        window.location.href = '/onboarding'
        return false
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
      return false
    }
    return false
  }

  const refreshOrganization = async () => {
    // Skip if on onboarding page
    if (typeof window !== 'undefined' && window.location.pathname.includes('/onboarding')) {
      return
    }
    await fetchOrganizationData()
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          setProfile(profile)
          
          // Fetch organization data (skip if on onboarding page)
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/onboarding')) {
            await fetchOrganizationData()
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          setProfile(profile)
          
          // Fetch organization data (skip if on onboarding page)
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/onboarding')) {
            await fetchOrganizationData()
          }
        } else {
          setProfile(null)
          setOrganization(null)
          setUserRole(null)
        }
        
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const openLockedFeatureModal = (featureKey: FeatureKey) => {
    setLockedFeatureModal({ open: true, featureKey })
  }

  const closeLockedFeatureModal = () => {
    setLockedFeatureModal({ open: false, featureKey: null })
  }

  const setOrgTier = (tier: TierType) => {
    if (organization) {
      setOrganization({ ...organization, tier })
    }
  }

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isSettingUpOrg,
        organization,
        userRole,
        orgName: organization?.name || "Mon Organisation",
        orgTier: (organization?.tier as TierType) || "starter",
        lockedFeatureModal,
        openLockedFeatureModal,
        closeLockedFeatureModal,
        setOrgTier,
        refreshOrganization,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
