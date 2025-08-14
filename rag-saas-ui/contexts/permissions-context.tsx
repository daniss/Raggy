"use client"

import { createContext, useContext, type ReactNode } from "react"

export interface PermissionContextType {
  permissions: string[]
  hasPermission: (permission: string) => boolean
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

// Mock permissions for demonstration
const mockPermissions = [
  "documents:read",
  "documents:write",
  "documents:delete",
  "assistant:use",
  "team:read",
  "settings:read",
  "settings:write",
]

export function PermissionProvider({ children }: { children: ReactNode }) {
  const hasPermission = (permission: string) => {
    return mockPermissions.includes(permission)
  }

  return (
    <PermissionContext.Provider value={{ permissions: mockPermissions, hasPermission }}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider")
  }
  return context
}
