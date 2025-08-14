import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Récupérer les paramètres de rétention
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Vérifier que c'est Pro+ et permissions adequates
    if (membership.organizations?.tier === 'starter') {
      return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })
    }

    // Permissions pour voir la conformité : SECURITY_ADMIN, ADMIN, OWNER
    const canViewCompliance = ['owner', 'admin', 'security_admin'].includes(membership.role)
    if (!canViewCompliance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get org settings
    const { data: orgSettings } = await supabase
      .from('org_settings')
      .select('settings')
      .eq('org_id', membership.org_id)
      .single()

    // Valeurs par défaut selon le tier
    const defaultRetention = {
      starter: 30,
      pro: 90,
      enterprise: 365
    }

    const settings = orgSettings?.settings as { retention_days?: number } | null
    const retentionDays = settings?.retention_days || 
      defaultRetention[membership.organizations.tier as keyof typeof defaultRetention] || 30

    return NextResponse.json({
      retention_days: retentionDays,
      tier: membership.organizations.tier,
      can_edit: membership.role === 'owner' && membership.organizations.tier === 'enterprise'
    })

  } catch (error) {
    console.error('Retention get error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Mettre à jour les paramètres de rétention
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await request.json()
    const { retention_days } = body

    if (!retention_days || retention_days < 1 || retention_days > 2555) {
      return NextResponse.json({ error: 'Invalid retention days (1-2555)' }, { status: 400 })
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Vérifier que c'est Enterprise et OWNER seulement
    if (membership.organizations?.tier !== 'enterprise' || membership.role !== 'owner') {
      return NextResponse.json({ 
        error: 'Enterprise tier and Owner role required to modify retention' 
      }, { status: 403 })
    }

    // Upsert org settings
    const { data: orgSettings, error: getError } = await supabase
      .from('org_settings')
      .select('id, settings')
      .eq('org_id', membership.org_id)
      .single()

    let updatedSettings
    if (getError && getError.code === 'PGRST116') {
      // Pas de settings existants, créer
      const newSettings = { retention_days }
      const { data, error } = await supabase
        .from('org_settings')
        .insert({
          org_id: membership.org_id,
          settings: newSettings
        })
        .select('settings')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      updatedSettings = data.settings
    } else if (orgSettings) {
      // Mettre à jour les settings existants
      const currentSettings = (orgSettings.settings as Record<string, any>) || {}
      const newSettings = { ...currentSettings, retention_days }
      
      const { data, error } = await supabase
        .from('org_settings')
        .update({ 
          settings: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgSettings.id)
        .select('settings')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      updatedSettings = data.settings
    } else {
      return NextResponse.json({ error: 'Failed to read org settings' }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'compliance.retention_updated',
      resource_type: 'org_settings',
      resource_id: membership.org_id,
      details: { 
        old_retention_days: (orgSettings?.settings as { retention_days?: number })?.retention_days,
        new_retention_days: retention_days 
      }
    })

    return NextResponse.json({
      retention_days,
      success: true
    })

  } catch (error) {
    console.error('Retention update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}