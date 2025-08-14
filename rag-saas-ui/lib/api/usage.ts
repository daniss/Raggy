export interface UsageData {
  month: string
  current_usage: {
    tokens_used: number
    documents_count: number
    storage_bytes: number
    storage_gb: number
    conversations_count: number
  }
  limits: {
    tokens: number
    documents: number
    storage_gb: number
  }
  usage_percentages: {
    tokens: number
    documents: number
    storage: number
  }
  trends: {
    tokens: number
    documents: number
    storage: number
    conversations: number
  }
  historical_usage: Array<{
    month: string
    tokens_used: number
    documents_count: number
    storage_bytes: number
    conversations_count: number
  }>
  tier: string
}

export class UsageAPI {
  static async getUsageSummary(month?: string): Promise<UsageData> {
    const url = month ? `/api/usage?month=${month}` : '/api/usage'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch usage data')
    }
    return response.json()
  }

  static async exportUsageCSV(month?: string): Promise<Blob> {
    const url = month ? `/api/usage/export.csv?month=${month}` : '/api/usage/export.csv'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to export usage data')
    }
    return response.blob()
  }

  static downloadCSV(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}