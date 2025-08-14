import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { redirect } from "next/navigation"

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>
}) {
  const { code, next = "/dashboard" } = await searchParams

  if (code) {
    const supabase = await createSupabaseServerClient()
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Setup organization if this is a new user
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/setup`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({
              userId: data.user.id,
              orgName: data.user.user_metadata?.org_name || `${data.user.user_metadata?.name || 'My'} Organization`
            })
          }
        )
      } catch (error) {
        console.error('Setup error:', error)
      }
    }
  }

  redirect(next)
}