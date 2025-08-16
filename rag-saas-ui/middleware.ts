import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Bypass middleware entirely for API routes to avoid interfering with fetch requests
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get authenticated user - required for Server Components
  const { data: { user }, error } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/callback', '/onboarding']
  const isPublicRoute = publicRoutes.includes(pathname)
  const isAuthRoute = pathname.startsWith('/auth/')
  const isPublicApiRoute = pathname.startsWith('/api/rag/health') || pathname.startsWith('/api/rag/test')

  // If no user and trying to access protected route, redirect to login
  if (!user && !isPublicRoute) {
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // If has user, check if user has an organization (except for auth routes and onboarding)
  if (user && !isAuthRoute && pathname !== '/onboarding') {
    try {
      // Check if user has an organization
      const { data: memberships } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)

      if (!memberships || memberships.length === 0) {
        // No organization found, redirect to onboarding
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Error checking user organization:', error)
    }
  }

  // If has user and trying to access auth routes (except callback or login with OAuth code), redirect to dashboard
  if (user && isAuthRoute && pathname !== '/auth/callback' && !(pathname === '/auth/login' && url.searchParams.has('code'))) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // If accessing root and authenticated, redirect to dashboard
  if (user && pathname === '/') {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
  * - api routes (handled by route handlers themselves)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}