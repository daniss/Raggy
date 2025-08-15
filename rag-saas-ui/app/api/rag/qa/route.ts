import { NextRequest, NextResponse } from 'next/server'

// GET - Quality Assurance metrics endpoint
export async function GET(request: NextRequest) {
  try {
    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json(
        { 
          status: 'not_configured',
          message: 'RAG service not configured - cannot fetch QA metrics',
          metrics: {
            service_availability: 0,
            overall_health: 0
          }
        },
        { status: 501 }
      )
    }

    // Fetch QA metrics from FastAPI service
    try {
      const response = await fetch(`${ragBaseUrl}/rag/qa/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const qaMetrics = await response.json()

      return NextResponse.json(
        {
          status: 'success',
          message: 'QA metrics retrieved successfully',
          timestamp: new Date().toISOString(),
          metrics: qaMetrics,
          config: {
            rag_base_url: ragBaseUrl
          }
        },
        { status: 200 }
      )

    } catch (fetchError: any) {
      console.error('Failed to fetch QA metrics:', fetchError)
      
      return NextResponse.json(
        { 
          status: 'unavailable',
          message: 'RAG service QA metrics unavailable',
          error: fetchError.message,
          metrics: {
            service_availability: 0,
            overall_health: 0,
            last_check: new Date().toISOString()
          }
        },
        { status: 503 }
      )
    }

  } catch (error: any) {
    console.error('QA metrics endpoint error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        message: 'QA metrics endpoint failed',
        error: error.message 
      },
      { status: 500 }
    )
  }
}

// POST - Validate RAG quality for a test query
export async function POST(request: NextRequest) {
  try {
    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json(
        { 
          error: 'RAG service not configured',
          message: 'Cannot perform quality validation without RAG service',
          code: 'RAG_SERVICE_NOT_CONFIGURED'
        },
        { status: 501 }
      )
    }

    const body = await request.json()
    const { query, orgId } = body

    if (!query) {
      return NextResponse.json(
        { error: "Query is required for QA validation" }, 
        { status: 400 }
      )
    }

    // Generate correlation ID for tracking
    const correlationId = `qa_val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Validate query quality through FastAPI
      const response = await fetch(`${ragBaseUrl}/rag/qa/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          org_id: orgId || 'qa-test-org',
          message: query,
          options: { fast_mode: true, citations: true },
          correlation_id: correlationId
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })

      if (!response.ok) {
        throw new Error(`RAG QA validation failed: ${response.status} ${response.statusText}`)
      }

      const validationResult = await response.json()

      return NextResponse.json({
        status: 'success',
        message: 'RAG quality validation completed',
        correlation_id: correlationId,
        query: query,
        validation_result: validationResult,
        timestamp: new Date().toISOString()
      })

    } catch (fetchError: any) {
      console.error('RAG QA validation failed:', fetchError)
      return NextResponse.json(
        { 
          error: 'QA validation failed', 
          details: fetchError.message,
          correlation_id: correlationId
        },
        { status: 503 }
      )
    }

  } catch (error: any) {
    console.error('QA validation endpoint error:', error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message }, 
      { status: 500 }
    )
  }
}