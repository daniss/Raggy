import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get organization settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 })
    }

    // Verify user belongs to org
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get organization with settings
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select(`
        *,
        org_settings (*)
      `)
      .eq('id', orgId)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const settings = Array.isArray(organization.org_settings) 
      ? organization.org_settings[0] 
      : organization.org_settings

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        tier: organization.tier,
        created_at: organization.created_at,
        updated_at: organization.updated_at
      },
      settings: settings || {
        // Default settings if none exist
        ai_model: 'gpt-3.5-turbo',
        max_tokens: 2000,
        temperature: 0.7,
        enable_citations: true,
        enable_streaming: true,
        notification_email: true,
        notification_push: false,
        notification_weekly: true
      }
    })

  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update organization settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId, organization: orgData, settings: settingsData } = await request.json()

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 })
    }

    // Verify user has admin+ role
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Update organization if provided
    if (orgData) {
      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          name: orgData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId)

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 500 })
      }
    }

    // Update or create settings
    if (settingsData) {
      const { error: settingsError } = await supabase
        .from('org_settings')
        .upsert({
          org_id: orgId,
          ...settingsData,
          updated_at: new Date().toISOString()
        })

      if (settingsError) {
        return NextResponse.json({ error: settingsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}