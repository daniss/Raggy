import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Liste des connecteurs
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

    // Vérifier que c'est Enterprise
    if (membership.organizations?.tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise tier required' }, { status: 403 })
    }

    // Permissions : ADMIN/OWNER peuvent tout voir/modifier
    const canManage = ['owner', 'admin'].includes(membership.role)

    // Get connectors avec détails
    const { data: connectors, error } = await supabase
      .from('connectors')
      .select(`
        id,
        name,
        type,
        status,
        created_at,
        updated_at,
        created_by,
        profiles!connectors_created_by_fkey(name, email)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Formatter pour l'UI avec derniers runs
    const connectorsWithRuns = await Promise.all(
      connectors.map(async (connector) => {
        // Get le dernier run
        const { data: lastRun } = await supabase
          .from('connector_runs')
          .select('id, status, started_at, completed_at, error_message')
          .eq('connector_id', connector.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()

        // Count total runs
        const { count: totalRuns } = await supabase
          .from('connector_runs')
          .select('*', { count: 'exact', head: true })
          .eq('connector_id', connector.id)

        return {
          id: connector.id,
          name: connector.name,
          type: connector.type,
          status: connector.status,
          created_at: connector.created_at,
          updated_at: connector.updated_at,
          created_by: connector.profiles?.name || connector.profiles?.email || 'Unknown',
          last_run: lastRun || null,
          total_runs: totalRuns || 0,
          can_manage: canManage
        }
      })
    )

    // Types de connecteurs disponibles
    const availableTypes = [
      { id: 'google_drive', name: 'Google Drive', icon: 'drive' },
      { id: 'sharepoint', name: 'SharePoint', icon: 'sharepoint' },
      { id: 's3', name: 'Amazon S3', icon: 's3' },
      { id: 'slack', name: 'Slack', icon: 'slack' },
      { id: 'notion', name: 'Notion', icon: 'notion' },
      { id: 'confluence', name: 'Confluence', icon: 'confluence' }
    ]

    return NextResponse.json({
      data: connectorsWithRuns,
      available_types: availableTypes,
      permissions: {
        can_create: canManage,
        can_manage: canManage
      }
    })

  } catch (error) {
    console.error('Connectors list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Créer un nouveau connecteur
export async function POST(request: NextRequest) {
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

    // Vérifier que c'est Enterprise et permissions
    if (membership.organizations?.tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise tier required' }, { status: 403 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { name, type, config } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    // Types autorisés
    const validTypes = ['google_drive', 'sharepoint', 's3', 'slack', 'notion', 'confluence']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 })
    }

    // Chiffrement de la config (pour l'instant simple base64, à améliorer)
    const configEncrypted = config ? Buffer.from(JSON.stringify(config)).toString('base64') : null

    // Créer le connecteur
    const { data: connector, error } = await supabase
      .from('connectors')
      .insert({
        org_id: membership.org_id,
        name: name.trim(),
        type,
        config_encrypted: configEncrypted,
        status: 'idle',
        created_by: user.id
      })
      .select('id, name, type, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'connector.created',
      resource_type: 'connector',
      resource_id: connector.id,
      details: { connector_name: name, connector_type: type }
    })

    return NextResponse.json({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      status: connector.status,
      created_at: connector.created_at
    })

  } catch (error) {
    console.error('Connector creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}