import type { TierType } from './features'
import type { UserRole } from './supabase/database.types'

export type { UserRole }

export type Permission = 
  | 'team.read' 
  | 'team.write' 
  | 'team.manage_roles'
  | 'settings.read' 
  | 'settings.write'
  | 'documents.read' 
  | 'documents.write' 
  | 'documents.upload'
  | 'assistant.use' 
  | 'conversations.read' 
  | 'conversations.write' 
  | 'conversations.delete'
  | 'usage.read' 
  | 'compliance.read' 
  | 'compliance.write_retention'
  | 'apikeys.read' 
  | 'apikeys.create' 
  | 'apikeys.revoke'
  | 'connectors.read' 
  | 'connectors.write'
  | 'environment.read'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'team.read', 'team.write', 'team.manage_roles',
    'settings.read', 'settings.write',
    'documents.read', 'documents.write', 'documents.upload',
    'assistant.use',
    'conversations.read', 'conversations.write', 'conversations.delete',
    'usage.read',
    'compliance.read', 'compliance.write_retention',
    'apikeys.read', 'apikeys.create', 'apikeys.revoke',
    'connectors.read', 'connectors.write',
    'environment.read'
  ],
  admin: [
    'team.read', 'team.write', 'team.manage_roles',
    'settings.read', 'settings.write',
    'documents.read', 'documents.write', 'documents.upload',
    'assistant.use',
    'conversations.read', 'conversations.write', 'conversations.delete',
    'usage.read',
    'compliance.read', 'compliance.write_retention',
    'apikeys.read', 'apikeys.create', 'apikeys.revoke',
    'connectors.read', 'connectors.write',
    'environment.read'
  ],
  security_admin: [
    'team.read',
    'settings.read',
    'assistant.use',
    'conversations.read', 'conversations.write',
    'usage.read',
    'compliance.read', 'compliance.write_retention',
    'apikeys.read',
    'environment.read'
  ],
  billing_admin: [
    'team.read',
    'settings.read',
    'assistant.use',
    'conversations.read', 'conversations.write',
    'usage.read'
  ],
  editor: [
    'team.read',
    'documents.read', 'documents.write', 'documents.upload',
    'assistant.use',
    'conversations.read', 'conversations.write',
    'connectors.read', 'connectors.write'
  ],
  viewer: [
    'documents.read',
    'assistant.use',
    'conversations.read'
  ]
}

export function hasPermission(userRole: UserRole | null, permission: Permission): boolean {
  if (!userRole) return false
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false
}

export function canAccessPage(
  userRole: UserRole | null, 
  orgTier: TierType, 
  page: string
): boolean {
  if (!userRole) return false

  switch (page) {
    case 'team':
      return hasPermission(userRole, 'team.read')
    
    case 'settings':
      return hasPermission(userRole, 'settings.read')
    
    case 'documents':
      return hasPermission(userRole, 'documents.read')
    
    case 'assistant':
      return hasPermission(userRole, 'assistant.use')
    
    case 'conversations':
      return hasPermission(userRole, 'conversations.read')
    
    case 'usage':
      return hasPermission(userRole, 'usage.read')
    
    case 'compliance':
      return hasPermission(userRole, 'compliance.read')
    
    case 'apikeys':
      return hasPermission(userRole, 'apikeys.read')
    
    case 'connectors':
      return orgTier === 'enterprise' && hasPermission(userRole, 'connectors.read')
    
    case 'environment':
      return orgTier === 'enterprise' && hasPermission(userRole, 'environment.read')
    
    default:
      return false
  }
}

export function getAccessLevel(
  userRole: UserRole | null, 
  orgTier: TierType, 
  resource: string
): 'none' | 'read' | 'write' {
  if (!userRole) return 'none'

  switch (resource) {
    case 'team':
      if (hasPermission(userRole, 'team.write')) return 'write'
      if (hasPermission(userRole, 'team.read')) return 'read'
      return 'none'
    
    case 'settings':
      if (hasPermission(userRole, 'settings.write')) return 'write'
      if (hasPermission(userRole, 'settings.read')) return 'read'
      return 'none'
    
    case 'documents':
      if (hasPermission(userRole, 'documents.write')) return 'write'
      if (hasPermission(userRole, 'documents.read')) return 'read'
      return 'none'
    
    case 'conversations':
      if (hasPermission(userRole, 'conversations.write')) return 'write'
      if (hasPermission(userRole, 'conversations.read')) return 'read'
      return 'none'
    
    case 'compliance':
      if (orgTier === 'enterprise' && hasPermission(userRole, 'compliance.write_retention')) return 'write'
      if (hasPermission(userRole, 'compliance.read')) return 'read'
      return 'none'
    
    case 'apikeys':
      if (hasPermission(userRole, 'apikeys.create')) return 'write'
      if (hasPermission(userRole, 'apikeys.read')) return 'read'
      return 'none'
    
    case 'connectors':
      if (orgTier !== 'enterprise') return 'none'
      if (hasPermission(userRole, 'connectors.write')) return 'write'
      if (hasPermission(userRole, 'connectors.read')) return 'read'
      return 'none'
    
    case 'environment':
      if (orgTier !== 'enterprise') return 'none'
      if (hasPermission(userRole, 'environment.read')) return 'read'
      return 'none'
    
    default:
      return 'none'
  }
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    security_admin: 'Admin Sécurité',
    billing_admin: 'Admin Facturation',
    editor: 'Éditeur',
    viewer: 'Observateur'
  }
  return roleNames[role] || role
}