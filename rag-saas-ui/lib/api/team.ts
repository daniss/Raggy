// Real API client for team management (replaces team.api.ts mocks)

import type { UserRole } from "@/lib/supabase/database.types"

export interface TeamMember {
  id: string
  name: string
  email: string
  roles: UserRole[]
  lastActivity: string
  mfaEnabled: boolean
  avatar?: string
  membershipId: string
}

export interface TeamInvitation {
  id: string
  email: string
  roles: UserRole[]
  invitedBy: string
  invitedAt: string
  expiresAt: string
}

export interface SeatUsage {
  used: number
  limit: number
  percentage: number
}

export class TeamAPI {
  static async listMembers(orgId: string): Promise<TeamMember[]> {
    const response = await fetch(`/api/team/members?orgId=${orgId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch members')
    }
    return response.json()
  }

  static async listInvitations(orgId: string): Promise<TeamInvitation[]> {
    const response = await fetch(`/api/team/invitations?orgId=${orgId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch invitations')
    }
    return response.json()
  }

  static async getSeatUsage(orgId: string): Promise<SeatUsage> {
    // For now, calculate based on members count (could be from API later)
    const members = await this.listMembers(orgId)
    const used = members.length
    const limit = 10 // Default for starter tier
    
    return {
      used,
      limit,
      percentage: Math.round((used / limit) * 100)
    }
  }

  static async inviteMembers(orgId: string, emails: string[], roles: UserRole[]): Promise<void> {
    const response = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, roles, orgId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send invitations')
    }
  }

  static async updateMemberRoles(memberId: string, orgId: string, roles: UserRole[]): Promise<void> {
    const response = await fetch('/api/team/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, orgId, roles })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update member roles')
    }
  }

  static async removeMember(memberId: string, orgId: string): Promise<void> {
    const response = await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, orgId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove member')
    }
  }

  static async resendInvitation(invitationId: string): Promise<void> {
    // Placeholder for resend functionality
    console.log('Resend invitation:', invitationId)
    return Promise.resolve()
  }

  static async cancelInvitation(invitationId: string, orgId: string): Promise<void> {
    const response = await fetch('/api/team/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, orgId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to cancel invitation')
    }
  }
}

// Role definitions for UI
export const roleDefinitions = [
  {
    code: 'admin' as const,
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
    code: 'editor' as const,
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
    code: 'viewer' as const,
    label: 'Observateur',
    description: 'Accès en lecture seule aux documents et conversations existants',
    permissions: [
      'Consultation des documents',
      'Lecture des conversations',
      'Utilisation limitée de l\'assistant',
    ],
  },
]