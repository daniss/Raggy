export interface Document {
  id: string
  name: string
  originalName: string
  type: string
  size: string
  uploadedAt: string
  status: 'Prêt' | 'En cours' | 'Erreur'
  tags: string[]
  uploadedBy: string
  filePath: string | null
}

export interface UploadInitResponse {
  documentId: string
  uploadUrl: string
  filePath: string
}

export class DocumentsAPI {
  static async getDocuments(orgId: string, status?: string, q?: string): Promise<Document[]> {
    const params = new URLSearchParams({ orgId })
    if (status && status !== 'all') params.append('status', status)
    if (q) params.append('q', q)
    
    const response = await fetch(`/api/documents?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch documents')
    }
    return response.json()
  }

  static async deleteDocument(documentId: string, orgId: string): Promise<void> {
    const response = await fetch('/api/documents', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId, orgId }),
    })

    if (!response.ok) {
      throw new Error('Failed to delete document')
    }
  }

  static async initializeUpload(
    orgId: string, 
    fileName: string, 
    fileType: string, 
    fileSize: number
  ): Promise<UploadInitResponse> {
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId,
        filename: fileName,
        mimeType: fileType,
        size: fileSize,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to initialize upload')
    }
    return response.json()
  }

  static async uploadFile(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to upload file')
    }
  }

  static async finalizeUpload(orgId: string, documentId: string, status: 'ready' | 'error' = 'ready'): Promise<void> {
    const response = await fetch('/api/documents/upload', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId,
        documentId,
        status,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to finalize upload')
    }
  }

  static async downloadDocument(filePath: string): Promise<string> {
    const response = await fetch(`/api/documents/download?path=${encodeURIComponent(filePath)}`)
    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }
    const data = await response.json()
    return data.url
  }
}