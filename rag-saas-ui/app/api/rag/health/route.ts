import { NextRequest, NextResponse } from 'next/server'

// GET - Vérifier la santé du service RAG
export async function GET(request: NextRequest) {
  try {
    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json(
        { 
          status: 'not_configured',
          message: 'Le service RAG FastAPI n\'est pas configuré.',
          code: 'RAG_SERVICE_NOT_CONFIGURED',
          config: {
            rag_base_url: 'Not set',
            expected_url: 'http://localhost:8000 (or your FastAPI service URL)'
          }
        },
        { status: 501 }
      )
    }

    try {
      // Test connection to FastAPI service
      const response = await fetch(`${ragBaseUrl}/rag/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Quick timeout for health check
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const healthData = await response.json()

      return NextResponse.json(
        {
          status: 'healthy',
          message: 'Service RAG FastAPI opérationnel',
          config: {
            rag_base_url: ragBaseUrl,
            last_check: new Date().toISOString()
          },
          fastapi_health: healthData
        },
        { status: 200 }
      )

    } catch (fetchError: any) {
      console.error('RAG service health check failed:', fetchError)
      
      return NextResponse.json(
        { 
          status: 'unhealthy',
          message: 'Le service RAG FastAPI n\'est pas accessible.',
          code: 'RAG_SERVICE_UNAVAILABLE',
          config: {
            rag_base_url: ragBaseUrl,
            last_check: new Date().toISOString()
          },
          error: fetchError.message
        },
        { status: 503 }
      )
    }

  } catch (error: any) {
    console.error('RAG health check error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Erreur lors de la vérification du service RAG.',
        error: error.message 
      },
      { status: 500 }
    )
  }
}