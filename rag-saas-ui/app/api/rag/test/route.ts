import { NextRequest, NextResponse } from 'next/server'

// GET - Simple test endpoint for RAG integration
export async function GET(request: NextRequest) {
  try {
    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json({
        status: 'error',
        message: 'RAG_BASE_URL not configured',
        rag_configured: false
      })
    }

    return NextResponse.json({
      status: 'ready',
      message: 'RAG integration configured',
      rag_base_url: ragBaseUrl,
      rag_configured: true,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('RAG test error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        message: 'RAG test failed',
        error: error.message 
      },
      { status: 500 }
    )
  }
}

// POST - Test RAG ask endpoint with simple query
export async function POST(request: NextRequest) {
  try {
    const { message, org_id } = await request.json()
    
    if (!message || !org_id) {
      return NextResponse.json(
        { error: 'message and org_id are required' },
        { status: 400 }
      )
    }

    const ragBaseUrl = process.env.RAG_BASE_URL
    
    if (!ragBaseUrl) {
      return NextResponse.json(
        { error: 'RAG_BASE_URL not configured' },
        { status: 501 }
      )
    }

    // Test the RAG service
    const testResponse = await fetch(`${ragBaseUrl}/rag/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id,
        message,
        options: { fast_mode: true, citations: false },
        correlation_id: `test_${Date.now()}`
      })
    })

    if (!testResponse.ok) {
      throw new Error(`RAG service error: ${testResponse.status} ${testResponse.statusText}`)
    }

    return NextResponse.json({
      status: 'success',
      message: 'RAG service test successful',
      test_query: message,
      org_id,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('RAG test POST error:', error)
    return NextResponse.json(
      { 
        error: 'RAG test failed',
        details: error.message 
      },
      { status: 500 }
    )
  }
}