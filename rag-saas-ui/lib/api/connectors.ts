export interface Connector {
  id: string
  name: string
  type: string
  status: 'idle' | 'running' | 'error'
  created_at: string
  updated_at: string
  created_by: string
  last_run: ConnectorRun | null
  total_runs: number
  can_manage: boolean
}

export interface ConnectorRun {
  id: string
  status: 'running' | 'success' | 'error'
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export interface ConnectorType {
  id: string
  name: string
  icon: string
}

export interface ConnectorsResponse {
  data: Connector[]
  available_types: ConnectorType[]
  permissions: {
    can_create: boolean
    can_manage: boolean
  }
}

export interface CreateConnectorRequest {
  name: string
  type: string
  config?: any
}

export interface ConnectorRunsResponse {
  connector: {
    id: string
    name: string
  }
  runs: Array<{
    id: string
    status: string
    started_at: string
    completed_at: string | null
    duration: string
    duration_ms: number | null
    stats: any
    error_message: string | null
  }>
  stats: {
    total_runs: number
    success_count: number
    error_count: number
    running_count: number
  }
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export class ConnectorsAPI {
  static async getConnectors(): Promise<ConnectorsResponse> {
    const response = await fetch('/api/connectors')
    if (!response.ok) {
      throw new Error('Failed to fetch connectors')
    }
    return response.json()
  }

  static async createConnector(request: CreateConnectorRequest): Promise<Connector> {
    const response = await fetch('/api/connectors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create connector')
    }

    return response.json()
  }

  static async updateConnector(id: string, updates: Partial<CreateConnectorRequest>): Promise<Connector> {
    const response = await fetch(`/api/connectors/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update connector')
    }

    return response.json()
  }

  static async deleteConnector(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/connectors/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete connector')
    }

    return response.json()
  }

  static async runConnector(id: string): Promise<any> {
    const response = await fetch(`/api/connectors/${id}/run`, {
      method: 'POST'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to run connector')
    }

    return response.json()
  }

  static async getConnectorRuns(id: string, limit = 20, offset = 0): Promise<ConnectorRunsResponse> {
    const response = await fetch(`/api/connectors/${id}/runs?limit=${limit}&offset=${offset}`)
    if (!response.ok) {
      throw new Error('Failed to fetch connector runs')
    }
    return response.json()
  }

  static getConnectorTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      google_drive: '🔗',
      sharepoint: '📊',
      s3: '📦',
      slack: '💬',
      notion: '📝',
      confluence: '🌐'
    }
    return icons[type] || '🔌'
  }

  static formatConnectorStatus(status: string): string {
    const statusLabels: Record<string, string> = {
      idle: 'Inactif',
      running: 'En cours',
      error: 'Erreur'
    }
    return statusLabels[status] || status
  }

  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      idle: 'text-gray-500',
      running: 'text-blue-500',
      error: 'text-red-500'
    }
    return colors[status] || 'text-gray-500'
  }

  static getRunStatusColor(status: string): string {
    const colors: Record<string, string> = {
      running: 'text-blue-600 bg-blue-50',
      success: 'text-green-600 bg-green-50',
      error: 'text-red-600 bg-red-50'
    }
    return colors[status] || 'text-gray-600 bg-gray-50'
  }
}