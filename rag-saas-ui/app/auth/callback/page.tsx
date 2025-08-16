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
    
    if (error) {
      console.error('Auth callback error:', error)
      redirect('/auth/login?error=callback_error')
    }
  }

  redirect(next)
}