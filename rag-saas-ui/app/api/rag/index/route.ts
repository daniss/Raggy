import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from 'next/server'

// POST - Indexer un document dans le RAG
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, documentId } = body

    if (!orgId || !documentId) {
      return NextResponse.json(
        { error: "orgId and documentId are required" }, 
        { status: 400 }
      )
    }

    // Verify user belongs to org
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if RAG service is available
    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json(
        { 
          error: 'RAG service not configured',
          message: 'Le service d\'indexation RAG n\'est pas configuré. Configurez RAG_BASE_URL pour activer l\'indexation.',
          code: 'RAG_SERVICE_NOT_CONFIGURED'
        },
        { status: 501 }
      )
    }

    // Generate correlation ID for tracking
    const correlationId = `idx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Proxy request to FastAPI
    try {
      const response = await fetch(`${ragBaseUrl}/rag/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          org_id: orgId,
          document_id: documentId,
          correlation_id: correlationId
        }),
        // Don't wait too long for indexing response (it's async)
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      return NextResponse.json({
        status: 'accepted',
        message: `Document ${documentId} queued for indexing`,
        org_id: orgId,
        document_id: documentId,
        correlation_id: correlationId,
        fastapi_response: result
      })

    } catch (fetchError: any) {
      console.error('FastAPI indexing request failed:', fetchError)
      
      if (fetchError.name === 'TimeoutError') {
        // Timeout is not necessarily an error for async indexing
        return NextResponse.json({
          status: 'accepted',
          message: `Document ${documentId} indexing started (async)`,
          org_id: orgId,
          document_id: documentId,
          correlation_id: correlationId,
          note: 'Indexing request sent but timed out waiting for confirmation'
        })
      }

      return NextResponse.json(
        { 
          error: 'RAG service unavailable',
          message: 'Le service d\'indexation RAG est temporairement indisponible. Réessayez plus tard.',
          details: fetchError.message
        },
        { status: 503 }
      )
    }

  } catch (error: any) {
    console.error('RAG indexing error:', error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message }, 
      { status: 500 }
    )
  }
}