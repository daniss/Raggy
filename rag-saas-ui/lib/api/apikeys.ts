export interface ApiKey {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  created_by: string
  can_delete: boolean
}

export interface CreateApiKeyRequest {
  name: string
}

export interface CreateApiKeyResponse {
  id: string
  name: string
  key: string // Clé en clair - affichée une seule fois
  created_at: string
  warning: string
}

export interface ApiKeysResponse {
  data: ApiKey[]
  permissions: {
    can_create: boolean
    can_delete: boolean
  }
}

export class ApiKeysAPI {
  static async getApiKeys(): Promise<ApiKeysResponse> {
    const response = await fetch('/api/apikeys')
    if (!response.ok) {
      throw new Error('Failed to fetch API keys')
    }
    return response.json()
  }

  static async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const response = await fetch('/api/apikeys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create API key')
    }

    return response.json()
  }

  static async deleteApiKey(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/apikeys/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete API key')
    }

    return response.json()
  }

  static formatLastUsed(lastUsedAt: string | null): string {
    if (!lastUsedAt) return 'Jamais utilisée'
    
    const date = new Date(lastUsedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`
      }
      return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
    } else if (diffDays === 1) {
      return 'Hier'
    } else if (diffDays < 30) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
    } else {
      return date.toLocaleDateString('fr-FR')
    }
  }

  static maskApiKey(key: string): string {
    if (key.length < 8) return key
    return key.substring(0, 4) + '...' + key.substring(key.length - 4)
  }
}