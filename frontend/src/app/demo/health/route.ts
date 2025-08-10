import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Demo-specific health check
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'raggy-demo-sandbox',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
      checks: {
        demo_page: 'pass',
        demo_corpus: 'unknown',
        backend_api: 'unknown'
      }
    };

    // Check if demo mode is enabled
    const demoEnabled = process.env.ENABLE_DEMO_MODE !== 'false';
    if (!demoEnabled) {
      healthData.status = 'disabled';
      healthData.checks.demo_page = 'disabled';
      return NextResponse.json(healthData, { status: 200 });
    }

    // Test backend API for demo functionality
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    if (backendUrl) {
      try {
        // Test demo corpus endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const demoResponse = await fetch(`${backendUrl}/api/v1/demo/status`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'raggy-demo-healthcheck'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (demoResponse.ok) {
          healthData.checks.backend_api = 'pass';
          healthData.checks.demo_corpus = 'pass';
        } else {
          healthData.checks.backend_api = 'fail';
          healthData.status = 'degraded';
        }
      } catch (error) {
        healthData.checks.backend_api = 'fail';
        healthData.status = 'degraded';
      }
    }

    // Add response time
    const responseTime = Date.now() - startTime;
    healthData.response_time_ms = responseTime;

    // Demo-specific metadata
    const demoMetadata = {
      demo_org_id: process.env.DEMO_ORG_ID || 'demo-org-12345',
      demo_documents_available: true,
      features: {
        file_upload: process.env.ENABLE_UPLOAD !== 'false',
        chat_interface: true,
        document_viewer: true,
        demo_corpus: true
      }
    };

    return NextResponse.json({
      ...healthData,
      demo_metadata: demoMetadata
    }, { 
      status: healthData.status === 'healthy' ? 200 : 
              healthData.status === 'degraded' ? 200 : 503 
    });

  } catch (error) {
    console.error('Demo health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'raggy-demo-sandbox',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        demo_page: 'fail'
      }
    }, { status: 503 });
  }
}

export async function HEAD(request: NextRequest) {
  try {
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}