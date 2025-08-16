import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name, company, orgName } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Use service role client for privileged operations
    const supabase = createSupabaseServiceClient()

    // Check if user already has an organization
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(id, name, tier)
      `)
      .eq('user_id', userId)
      .single()

    if (existingMembership?.organizations) {
      return NextResponse.json({ 
        success: true, 
        message: "Utilisateur déjà configuré",
        organization: {
          id: existingMembership.organizations.id,
          name: existingMembership.organizations.name,
          tier: existingMembership.organizations.tier
        }
      })
    }

    // Create new organization
    const organizationName = orgName || company || `${name || 'My'} Organization`
    
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        tier: 'starter'
      })
      .select('id, name, tier')
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      )
    }

    // Create membership for the user as owner
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: userId,
        org_id: organization.id,
        role: 'owner'
      })

    if (membershipError) {
      console.error('Error creating membership:', membershipError)
      // Try to cleanup the organization
      await supabase.from('organizations').delete().eq('id', organization.id)
      return NextResponse.json(
        { error: "Failed to create membership" },
        { status: 500 }
      )
    }

    // Create default settings for the organization
    const { error: settingsError } = await supabase
      .from('org_settings')
      .insert({
        org_id: organization.id,
        settings: {
          ai_model: 'gpt-3.5-turbo',
          max_tokens: 2000,
          temperature: 0.7,
          enable_citations: true,
          enable_streaming: false,
          notification_email: true,
          notification_push: false,
          notification_weekly: true
        }
      })

    if (settingsError) {
      console.error('Error creating settings:', settingsError)
      // Settings failure is not critical, continue
    }

    return NextResponse.json({ 
      success: true,
      message: "Organisation créée avec succès",
      organization: organization
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}