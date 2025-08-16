export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    citations?: Citation[]
    usage?: Usage
    model?: string
  }
}

export interface Citation {
  document_id: string
  chunk_index: number
  score: number
  section: string | null
  page: number | null
  document_title?: string
  document_filename?: string
}

export interface Usage {
  tokens_input: number
  tokens_output: number
  model?: string
}

export class ConversationsAPI {
  static async getConversations(
    orgId: string, 
    options?: { page?: number; limit?: number; search?: string }
  ): Promise<ConversationsResponse> {
    const params = new URLSearchParams({ orgId })
    if (options?.page) params.set('page', options.page.toString())
    if (options?.limit) params.set('limit', options.limit.toString())
    if (options?.search) params.set('search', options.search)
    
    const response = await fetch(`/api/conversations?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch conversations')
    }
    return response.json()
  }

  static async createConversation(orgId: string, title: string): Promise<Conversation> {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId, title }),
    })

    if (!response.ok) {
      throw new Error('Failed to create conversation')
    }
    return response.json()
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    const response = await fetch(`/api/conversations/${conversationId}/messages`)
    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }
    return response.json()
  }

  static async addMessage(conversationId: string, content: string, role: 'user' | 'assistant'): Promise<Message> {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, role }),
    })

    if (!response.ok) {
      throw new Error('Failed to add message')
    }
    return response.json()
  }

  static async updateConversation(conversationId: string, updates: { title: string }): Promise<{ id: string; title: string; updatedAt: string }> {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error('Failed to update conversation')
    }
    return response.json()
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete conversation')
    }
  }
}