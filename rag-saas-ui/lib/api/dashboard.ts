export interface DashboardData {
  docsReady: number
  processing: number
  storageBytes: number
  conversations: Array<{
    id: string
    title: string
    created_at: string
    updated_at: string
  }>
  recentDocuments: Array<{
    id: string
    name: string
    status: 'processing' | 'ready' | 'error'
    created_at: string
    size_bytes: number | null
  }>
  onboardingItems: Array<{
    key: string
    label: string
    completed: boolean
    description: string
  }>
  usage: {
    tokens_used: number
    conversations_count: number
    documents_count: number
  }
  lastUpdated: string
}

export class DashboardAPI {
  static async getDashboardData(): Promise<DashboardData> {
    const response = await fetch('/api/dashboard')
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data')
    }
    return response.json()
  }
}