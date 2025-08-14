import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get current organization data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's organizations with role
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations (
          id,
          name,
          tier,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    // Get the first/default organization
    const primaryMembership = memberships?.[0]
    if (!primaryMembership?.organizations) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }

    const org = primaryMembership.organizations
    const userRole = primaryMembership.role

    // Get organization settings
    const { data: settings } = await supabase
      .from('org_settings')
      .select('settings')
      .eq('org_id', org.id)
      .single()

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('*')
      .eq('org_id', org.id)
      .eq('month', currentMonth)
      .single()

    return NextResponse.json({
      organization: {
        ...org,
        settings: settings?.settings || {},
        usage: usage || {
          tokens_used: 0,
          documents_count: 0,
          storage_bytes: 0,
          conversations_count: 0
        }
      },
      userRole,
      allOrganizations: memberships?.map(m => ({
        ...m.organizations,
        role: m.role
      })) || []
    })

  } catch (error) {
    console.error('Org API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update organization
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId, name, settings } = await request.json()

    // Verify user has admin/owner role
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const updates: any = {}
    if (name) updates.name = name

    // Update organization if name changed
    if (name) {
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', orgId)

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 500 })
      }
    }

    // Update settings if provided
    if (settings) {
      const { error: settingsError } = await supabase
        .from('org_settings')
        .upsert({
          org_id: orgId,
          settings
        })

      if (settingsError) {
        return NextResponse.json({ error: settingsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Org update error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}