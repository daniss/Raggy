import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name, company } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Use service role client for privileged operations
    const supabase = createSupabaseServiceClient()

    // Vérifier si l'utilisateur a besoin d'un setup
    const { data: needsSetup, error: checkError } = await (supabase as any)
      .rpc('user_needs_setup', { p_user_id: userId })

    if (checkError) {
      console.error('Error checking setup status:', checkError)
      return NextResponse.json(
        { error: "Failed to check setup status" },
        { status: 500 }
      )
    }

    if (!needsSetup) {
      // Récupérer l'org existante
      const { data: membership } = await supabase
        .from('memberships')
        .select(`
          org_id,
          organizations!inner(id, name, tier)
        `)
        .eq('user_id', userId)
        .eq('role', 'owner')
        .single()

      return NextResponse.json({ 
        success: true, 
        message: "Utilisateur déjà configuré",
        organization: {
          id: membership?.organizations.id,
          name: membership?.organizations.name,
          tier: membership?.organizations.tier
        }
      })
    }

    // Utiliser la fonction d'auto-setup
    const { data: orgId, error: setupError } = await (supabase as any)
      .rpc('auto_setup_user', {
        p_user_id: userId,
        p_email: email || 'user@example.com',
        p_name: name,
        p_company: company
      })

    if (setupError) {
      console.error('Error during auto-setup:', setupError)
      return NextResponse.json(
        { error: "Échec de la configuration automatique" },
        { status: 500 }
      )
    }

    // Récupérer les détails de l'organisation créée
    const { data: organization, error: orgFetchError } = await supabase
      .from('organizations')
      .select('id, name, tier')
      .eq('id', orgId)
      .single()

    if (orgFetchError) {
      console.error('Error fetching organization:', orgFetchError)
    }

    return NextResponse.json({ 
      success: true,
      message: "Configuration automatique réussie",
      organization: organization || { id: orgId }
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}