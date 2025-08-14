export interface Activity {
  id: string
  label: string
  time: string
}

export interface OnboardingItem {
  key: string
  label: string
  completed: boolean
}

export interface DashboardData {
  docsReady: number
  processing: number
  storageBytes: number
  lastUpdated: string
  onboardingItems: OnboardingItem[]
  docsLimit: number
  tokensUsed: number
  tokensLimit: number
  recentActivity: Activity[]
}

export async function getDashboardData(): Promise<DashboardData> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  return {
    docsReady: 24,
    processing: 2,
    storageBytes: 8.6 * 1024 * 1024 * 1024, // 8.6 GB
    lastUpdated: "il y a 2 min",
    onboardingItems: [
      { key: "upload_first_doc", label: "Importer un document", completed: true },
      { key: "ask_first_question", label: "Poser une question", completed: true },
      { key: "view_citation", label: "Voir une citation", completed: false },
      { key: "download_purge_proof", label: "Générer une preuve de purge", completed: false },
    ],
    docsLimit: 100,
    tokensUsed: 120000,
    tokensLimit: 200000,
    recentActivity: [
      { id: "1", label: "Document Rapport_Annuel_2024.pdf ajouté", time: "10:31" },
      { id: "2", label: "Question posée", time: "10:32" },
      { id: "3", label: "Document analysé", time: "09:45" },
    ],
  }
}
