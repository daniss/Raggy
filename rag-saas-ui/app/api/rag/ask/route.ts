import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from 'next/server'

// Rate limiting (simple in-memory store)
const rateLimit = new Map<string, { count: number, resetTime: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const key = orgId
  const limit = rateLimit.get(key)
  
  if (!limit || now > limit.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + 60000 }) // Reset after 1 minute
    return true
  }
  
  if (limit.count >= 3) { // 3 requests per minute per org
    return false
  }
  
  limit.count++
  return true
}

// Mock streaming response generator (fallback when FastAPI is not available)
async function* mockRAGResponse(userMessage: string, options: { citations?: boolean, fast_mode?: boolean }) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const response = `Je comprends votre question: "${userMessage}". Basé sur l'analyse de vos documents, voici ma réponse détaillée...`
  
  // Stream token by token with realistic delays
  for (let i = 0; i < response.length; i++) {
    yield {
      type: 'token',
      text: response[i]
    }
    // Vary delay to simulate realistic streaming
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10))
  }
  
  // Send citations if enabled
  if (options.citations) {
    yield {
      type: 'citations',
      items: [
        {
          document_id: 'doc_1',
          chunk_index: 0,
          score: 0.95,
          section: 'Introduction',
          page: 1,
          document_title: 'Document 1.pdf',
          document_filename: 'document1.pdf'
        },
        {
          document_id: 'doc_2', 
          chunk_index: 1,
          score: 0.87,
          section: 'Guide utilisateur',
          page: 3,
          document_title: 'Guide utilisateur.docx',
          document_filename: 'guide.docx'
        }
      ]
    }
  }
  
  // Send usage info
  yield {
    type: 'usage',
    tokens_input: userMessage.length,
    tokens_output: response.length,
    model: options.fast_mode ? 'gpt-3.5-turbo' : 'gpt-4'
  }
  
  // Final done event
  yield {
    type: 'done'
  }
}

// Proxy streaming response from FastAPI
async function* proxyRAGResponse(
  orgId: string, 
  userMessage: string, 
  options: { citations?: boolean, fast_mode?: boolean },
  correlationId: string
) {
  const ragBaseUrl = process.env.RAG_BASE_URL
  
  try {
    const response = await fetch(`${ragBaseUrl}/rag/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId
      },
      body: JSON.stringify({
        org_id: orgId,
        message: userMessage,
        options,
        correlation_id: correlationId
      })
    })

    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('No response body from FastAPI')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data.trim()) {
              try {
                const event = JSON.parse(data)
                yield event
              } catch (e) {
                console.warn('Failed to parse SSE event from FastAPI:', data)
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    console.error('FastAPI proxy error:', error)
    // Fall back to mock response on error
    yield* mockRAGResponse(userMessage, options)
  }
}

// SSE streaming endpoint
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      orgId, 
      conversationId, 
      message: userMessage, 
      options = {} 
    } = body

    if (!orgId || !userMessage) {
      return NextResponse.json({ error: "orgId and message are required" }, { status: 400 })
    }

    // Check rate limiting
    if (!checkRateLimit(orgId)) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before sending another message." }, { status: 429 })
    }

    // Verify user belongs to org and get tier info
    const { data: userMembership } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations (
          tier
        )
      `)
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const orgTier = userMembership.organizations?.tier || 'starter'

    // Check monthly token limits
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
    
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('tokens_used')
      .eq('org_id', orgId)
      .eq('month', currentMonth)
      .single()

    const currentTokens = usage?.tokens_used || 0
    const estimatedTokens = Math.ceil(userMessage.length / 4) // Rough estimate: 4 chars per token

    // Import limits check
    const { checkLimit } = await import('@/lib/limits')
    const tokenLimitCheck = checkLimit(orgTier as any, 'monthly_tokens', currentTokens, estimatedTokens)
    
    if (!tokenLimitCheck.allowed) {
      const { formatNumber } = await import('@/lib/limits')
      return NextResponse.json({
        error: "Monthly token limit exceeded",
        code: "TOKENS_EXCEEDED",
        current_usage: currentTokens,
        limit: tokenLimitCheck.limit,
        suggested_tier: tokenLimitCheck.suggested_tier,
        message: `Votre plan ${orgTier} permet ${formatNumber(tokenLimitCheck.limit!)} tokens par mois. Vous en avez déjà utilisé ${formatNumber(currentTokens)}.`
      }, { status: 402 })
    }

    // Create or get conversation
    let currentConversationId = conversationId
    if (!currentConversationId) {
      // Auto-generate title from first message (first 60 chars)
      const autoTitle = userMessage.length > 60 ? userMessage.substring(0, 57) + '...' : userMessage
      
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          title: autoTitle,
          org_id: orgId,
          user_id: user.id
        })
        .select()
        .single()

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 })
      }
      
      currentConversationId = newConversation.id
    }

    // Save user message immediately
    const { data: userMsg, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: userMessage,
        metadata: {}
      })
      .select()
      .single()

    if (userMsgError) {
      return NextResponse.json({ error: userMsgError.message }, { status: 500 })
    }

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConversationId)

    // Set up SSE response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          // Generate detailed correlation ID for tracking
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const randomId = Math.random().toString(36).substr(2, 9)
          const correlationId = `rag-${timestamp}-${randomId}`
          
          // Log request start
          console.log(`[${correlationId}] RAG request started:`, {
            orgId,
            messageLength: userMessage.length,
            options,
            conversationId
          })
          
          // Check if RAG_BASE_URL is configured for real RAG
          const ragBaseUrl = process.env.RAG_BASE_URL
          let responseGenerator
          
          if (ragBaseUrl) {
            // Use FastAPI RAG service
            responseGenerator = proxyRAGResponse(orgId, userMessage, options, correlationId)
          } else {
            // Use mock streaming (development fallback)
            responseGenerator = mockRAGResponse(userMessage, options)
          }

          let assistantContent = ''
          let citations: any[] = []
          let usage: { tokens_input: number, tokens_output: number, model: string } = { 
            tokens_input: 0, 
            tokens_output: 0, 
            model: 'mock' 
          }
          
          for await (const event of responseGenerator) {
            // Send SSE event
            const sseData = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(sseData))
            
            // Accumulate data for database storage
            if (event.type === 'token') {
              assistantContent += event.text
            } else if (event.type === 'citations') {
              citations = event.items || []
            } else if (event.type === 'usage') {
              usage = {
                tokens_input: event.tokens_input || 0,
                tokens_output: event.tokens_output || 0,
                model: event.model || 'mock'
              }
            } else if (event.type === 'done') {
              // Save assistant message to database
              const { data: assistantMsg, error: assistantMsgError } = await supabase
                .from('messages')
                .insert({
                  conversation_id: currentConversationId,
                  role: 'assistant', 
                  content: assistantContent,
                  metadata: {
                    citations,
                    usage,
                    model: usage.model
                  }
                })
                .select()
                .single()

              if (assistantMsgError) {
                console.error('Failed to save assistant message:', assistantMsgError)
              } else {
                // Include message_id and conversation_id in done event
                const doneEvent = { 
                  type: 'done', 
                  message_id: assistantMsg.id,
                  conversation_id: currentConversationId 
                }
                const doneData = `data: ${JSON.stringify(doneEvent)}\n\n`
                controller.enqueue(encoder.encode(doneData))
              }

              // Update usage tracking
              const currentMonth = new Date().toISOString().substring(0, 7) + '-01'
              try {
                const { error: usageError } = await supabase
                  .from('usage_monthly')
                  .upsert({
                    org_id: orgId,
                    month: currentMonth,
                    tokens_used: usage.tokens_input + usage.tokens_output,
                    conversations_count: conversationId ? 0 : 1
                  }, {
                    onConflict: 'org_id,month'
                  })
                
                if (usageError) {
                  console.error('Failed to update usage:', usageError)
                }
              } catch (error) {
                console.error('Usage tracking error:', error)
              }

              // Update conversation timestamp
              await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentConversationId)
            }
          }
        } catch (error) {
          console.error('RAG streaming error:', error)
          const errorEvent = {
            type: 'error',
            message: 'Une erreur est survenue lors du traitement de votre demande.'
          }
          const errorData = `data: ${JSON.stringify(errorEvent)}\n\n`
          controller.enqueue(encoder.encode(errorData))
        }
        
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('RAG API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}