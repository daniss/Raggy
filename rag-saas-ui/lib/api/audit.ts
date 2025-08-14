export interface AuditLog {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  details: any
  created_at: string
  user_name: string
  user_id: string | null
  ip_address: string | null
  user_agent: string | null
}

export interface AuditFilters {
  from?: string
  to?: string
  type?: string
  user?: string
  limit?: number
  offset?: number
}

export interface AuditResponse {
  data: AuditLog[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  filters: AuditFilters
  available_event_types: string[]
}

export class AuditAPI {
  static async getAuditLogs(filters: AuditFilters = {}): Promise<AuditResponse> {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })

    const response = await fetch(`/api/audit?${params.toString()}`)
    if (!response.ok) {
      throw new Error('Failed to fetch audit logs')
    }
    return response.json()
  }

  static formatEventType(action: string): string {
    const eventTypeLabels: Record<string, string> = {
      'document.uploaded': 'Document importé',
      'document.deleted': 'Document supprimé',
      'conversation.created': 'Conversation créée',
      'apikey.created': 'Clé API créée',
      'apikey.revoked': 'Clé API révoquée',
      'connector.created': 'Connecteur créé',
      'connector.updated': 'Connecteur modifié',
      'connector.deleted': 'Connecteur supprimé',
      'connector.run.started': 'Synchronisation démarrée',
      'user.login': 'Connexion utilisateur',
      'user.logout': 'Déconnexion utilisateur',
      'settings.updated': 'Paramètres modifiés',
      'usage.exported': 'Export d\'utilisation',
      'compliance.purge_proof_created': 'Preuve de purge créée'
    }
    return eventTypeLabels[action] || action
  }

  static formatActionColor(action: string): string {
    if (action.includes('created') || action.includes('login')) return 'text-green-600'
    if (action.includes('deleted') || action.includes('revoked')) return 'text-red-600'
    if (action.includes('updated') || action.includes('modified')) return 'text-blue-600'
    if (action.includes('exported')) return 'text-purple-600'
    return 'text-gray-600'
  }
}