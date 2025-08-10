import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Basic health check data
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'raggy-frontend',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      checks: {
        basic: 'pass',
        env_vars: 'pass',
        backend_connectivity: 'unknown'
      }
    };

    // Check essential environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      healthData.checks.env_vars = 'fail';
      healthData.status = 'unhealthy';
      return NextResponse.json({
        ...healthData,
        errors: [`Missing environment variables: ${missingEnvVars.join(', ')}`]
      }, { status: 503 });
    }

    // Test backend connectivity if backend URL is available
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    if (backendUrl) {
      try {
        const backendHealthUrl = `${backendUrl}/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const backendResponse = await fetch(backendHealthUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'raggy-frontend-healthcheck'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (backendResponse.ok) {
          healthData.checks.backend_connectivity = 'pass';
        } else {
          healthData.checks.backend_connectivity = 'fail';
          healthData.status = 'degraded';
        }
      } catch (error) {
        healthData.checks.backend_connectivity = 'fail';
        healthData.status = 'degraded';
        // Don't fail completely on backend connectivity issues in health check
      }
    }

    // Add response time
    const responseTime = Date.now() - startTime;
    healthData.response_time_ms = responseTime;

    // Add additional metadata for debugging
    const additionalData = {
      node_env: process.env.NODE_ENV,
      build_time: process.env.BUILD_TIME || 'unknown',
      commit_sha: process.env.COMMIT_SHA || 'unknown',
      app_name: process.env.NEXT_PUBLIC_APP_NAME,
      urls: {
        backend: backendUrl,
        supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
        app: process.env.NEXT_PUBLIC_APP_URL
      }
    };

    return NextResponse.json({
      ...healthData,
      metadata: additionalData
    }, { 
      status: healthData.status === 'healthy' ? 200 : 
              healthData.status === 'degraded' ? 200 : 503 
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'raggy-frontend',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        basic: 'fail'
      }
    }, { status: 503 });
  }
}

// Handle HEAD requests for simple connectivity checks
export async function HEAD(request: NextRequest) {
  try {
    // Quick connectivity check without full health data
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}