"use client"

import { useState, useCallback, useRef } from 'react'

export interface ChatMessage {
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
  title: string
  score: number
  spans: {
    snippet: string
    from: number
    to: number
  }[]
}

export interface Usage {
  tokens_input: number
  tokens_output: number
  model?: string
}

export interface ChatOptions {
  citations?: boolean
  fast_mode?: boolean
}

export interface UseChatOptions {
  orgId: string
  onError?: (error: string) => void
  onSuccess?: () => void
}

export function useChat({ orgId, onError, onSuccess }: UseChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [currentUsage, setCurrentUsage] = useState<Usage | null>(null)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingMessageRef = useRef<string>('')

  const send = useCallback(async (
    message: string, 
    options: ChatOptions = {},
    conversationId?: string | null
  ) => {
    if (isStreaming) {
      onError?.('Une requête est déjà en cours')
      return null
    }

    setIsStreaming(true)
    setStreamingContent('')
    setCitations([])
    setCurrentUsage(null)
    streamingMessageRef.current = ''
    
    // Create abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          conversationId,
          message,
          options
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let newConversationId = conversationId

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          // Check if request was aborted
          if (abortController.signal.aborted) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                
                switch (event.type) {
                  case 'token':
                    streamingMessageRef.current += event.text
                    setStreamingContent(streamingMessageRef.current)
                    break
                    
                  case 'citations':
                    setCitations(event.items || [])
                    break
                    
                  case 'usage':
                    setCurrentUsage({
                      tokens_input: event.tokens_input,
                      tokens_output: event.tokens_output,
                      model: event.model
                    })
                    break
                    
                  case 'done':
                    // Update conversation ID if provided (for new conversations)
                    if (event.conversation_id && !conversationId) {
                      newConversationId = event.conversation_id
                    }
                    setIsStreaming(false)
                    onSuccess?.()
                    return newConversationId
                    
                  case 'error':
                    throw new Error(event.message || 'Streaming error')
                    
                  default:
                    console.warn('Unknown event type:', event.type)
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE event:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return newConversationId

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was aborted, this is expected
        return null
      }
      
      console.error('Chat error:', error)
      setIsStreaming(false)
      
      let errorMessage = 'Une erreur est survenue'
      if (error.message.includes('Rate limit')) {
        errorMessage = 'Limite de requêtes atteinte. Veuillez patienter avant d\'envoyer un autre message.'
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'Session expirée. Veuillez vous reconnecter.'
      } else if (error.message.includes('Insufficient permissions')) {
        errorMessage = 'Permissions insuffisantes pour utiliser l\'assistant.'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.'
      }
      
      onError?.(errorMessage)
      return null
    } finally {
      abortControllerRef.current = null
    }
  }, [orgId, isStreaming, onError, onSuccess])

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }, [])

  const regenerate = useCallback(async (
    lastUserMessage: string,
    options: ChatOptions = {},
    conversationId?: string | null
  ) => {
    return send(lastUserMessage, options, conversationId)
  }, [send])

  return {
    send,
    stop,
    regenerate,
    isStreaming,
    streamingContent,
    citations,
    currentUsage
  }
}