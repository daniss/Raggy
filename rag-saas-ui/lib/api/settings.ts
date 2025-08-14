export interface OrganizationSettings {
  organization: {
    id: string
    name: string
    tier: 'starter' | 'pro' | 'enterprise'
    created_at: string
    updated_at: string
  }
  settings: {
    ai_model?: string
    max_tokens?: number
    temperature?: number
    enable_citations?: boolean
    enable_streaming?: boolean
    notification_email?: boolean
    notification_push?: boolean
    notification_weekly?: boolean
  }
}

export class SettingsAPI {
  static async getSettings(orgId: string): Promise<OrganizationSettings> {
    const response = await fetch(`/api/settings?orgId=${orgId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch settings')
    }
    return response.json()
  }

  static async updateSettings(
    orgId: string,
    organization?: Partial<OrganizationSettings['organization']>,
    settings?: Partial<OrganizationSettings['settings']>
  ): Promise<void> {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId, organization, settings }),
    })

    if (!response.ok) {
      throw new Error('Failed to update settings')
    }
  }
}