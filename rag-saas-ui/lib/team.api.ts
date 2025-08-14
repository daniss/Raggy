export type RoleCode = 'admin' | 'editor' | 'viewer'

export interface Member {
  id: string
  name: string
  email: string
  roles: RoleCode[]
  lastActivity: string
  mfaEnabled: boolean
  avatar?: string
}

export interface Invitation {
  id: string
  email: string
  roles: RoleCode[]
  invitedBy: string
  invitedAt: string
  expiresAt: string
}

export interface SeatUsage {
  used: number
  limit: number
  percentage: number
}

export interface RoleDefinition {
  code: RoleCode
  label: string
  description: string
  permissions: string[]
}

// Mock data
const mockMembers: Member[] = [
  {
    id: '1',
    name: 'Sarah Martin',
    email: 'sarah.martin@example.com',
    roles: ['admin'],
    lastActivity: '2024-01-15T14:30:00Z',
    mfaEnabled: true,
  },
  {
    id: '2', 
    name: 'Thomas Dubois',
    email: 'thomas.dubois@example.com',
    roles: ['editor'],
    lastActivity: '2024-01-15T09:15:00Z',
    mfaEnabled: true,
  },
  {
    id: '3',
    name: 'Marie Lopez',
    email: 'marie.lopez@example.com', 
    roles: ['editor', 'viewer'],
    lastActivity: '2024-01-14T16:45:00Z',
    mfaEnabled: false,
  },
  {
    id: '4',
    name: 'Pierre Renault',
    email: 'pierre.renault@example.com',
    roles: ['viewer'],
    lastActivity: '2024-01-13T11:20:00Z',
    mfaEnabled: false,
  },
]

const mockInvitations: Invitation[] = [
  {
    id: '1',
    email: 'alice.bernard@example.com',
    roles: ['editor'],
    invitedBy: 'Sarah Martin',
    invitedAt: '2024-01-15T10:00:00Z',
    expiresAt: '2024-01-22T10:00:00Z',
  },
  {
    id: '2',
    email: 'julien.moreau@example.com',
    roles: ['viewer'],
    invitedBy: 'Thomas Dubois', 
    invitedAt: '2024-01-14T15:30:00Z',
    expiresAt: '2024-01-21T15:30:00Z',
  },
]

const mockSeatUsage: SeatUsage = {
  used: 4,
  limit: 10,
  percentage: 40,
}

export const roleDefinitions: RoleDefinition[] = [
  {
    code: 'admin',
    label: 'Administrateur',
    description: 'Accès complet à tous les paramètres et données de l\'organisation',
    permissions: [
      'Gestion des utilisateurs et invitations',
      'Configuration des paramètres', 
      'Accès aux données de facturation',
      'Gestion des intégrations',
      'Lecture et modification de tous les documents',
    ],
  },
  {
    code: 'editor',
    label: 'Éditeur', 
    description: 'Peut consulter et modifier les documents, poser des questions à l\'assistant',
    permissions: [
      'Import et modification de documents',
      'Utilisation de l\'assistant IA',
      'Consultation des conversations',
      'Export de données',
    ],
  },
  {
    code: 'viewer',
    label: 'Observateur',
    description: 'Accès en lecture seule aux documents et conversations existants',
    permissions: [
      'Consultation des documents',
      'Lecture des conversations',
      'Utilisation limitée de l\'assistant',
    ],
  },
]

// Mock API functions - these return Promises to simulate async behavior
export async function listMembers(): Promise<Member[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))
  return [...mockMembers]
}

export async function listInvitations(): Promise<Invitation[]> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return [...mockInvitations]
}

export async function getSeatUsage(): Promise<SeatUsage> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return { ...mockSeatUsage }
}

export async function inviteMembers(emails: string[], roles: RoleCode[]): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500))
  // In a real implementation, this would send invitations
  console.log('Mock: Inviting', emails, 'with roles', roles)
}

export async function updateMemberRoles(memberId: string, roles: RoleCode[]): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 300))
  // In a real implementation, this would update the member's roles
  console.log('Mock: Updating member', memberId, 'roles to', roles)
}

export async function removeMember(memberId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 300))
  // In a real implementation, this would remove the member
  console.log('Mock: Removing member', memberId)
}

export async function resendInvitation(invitationId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200))
  // In a real implementation, this would resend the invitation email
  console.log('Mock: Resending invitation', invitationId)
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200))
  // In a real implementation, this would cancel the invitation
  console.log('Mock: Canceling invitation', invitationId)
}