import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// PATCH - Modifier un connecteur
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
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

    // Vérifier Enterprise + permissions
    if (membership.organizations?.tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise tier required' }, { status: 403 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Vérifier que le connecteur existe et appartient à l'org
    const { data: existingConnector } = await supabase
      .from('connectors')
      .select('id, name, type, org_id')
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .single()

    if (!existingConnector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
    }

    // Parse body
    const body = await request.json()
    const { name, config, status } = body

    const updates: any = {}
    if (name) updates.name = name.trim()
    if (status) updates.status = status
    if (config) {
      updates.config_encrypted = Buffer.from(JSON.stringify(config)).toString('base64')
    }

    // Update connector
    const { data: connector, error } = await supabase
      .from('connectors')
      .update(updates)
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .select('id, name, type, status, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'connector.updated',
      resource_type: 'connector',
      resource_id: id,
      details: { updates }
    })

    return NextResponse.json(connector)

  } catch (error) {
    console.error('Connector update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer un connecteur
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
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

    // Vérifier Enterprise + permissions
    if (membership.organizations?.tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise tier required' }, { status: 403 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Vérifier que le connecteur existe et appartient à l'org
    const { data: existingConnector } = await supabase
      .from('connectors')
      .select('id, name, org_id')
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .single()

    if (!existingConnector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
    }

    // Supprimer le connecteur (les runs seront supprimés en cascade)
    const { error: deleteError } = await supabase
      .from('connectors')
      .delete()
      .eq('id', id)
      .eq('org_id', membership.org_id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'connector.deleted',
      resource_type: 'connector',
      resource_id: id,
      details: { connector_name: existingConnector.name }
    })

    return NextResponse.json({ 
      success: true,
      message: `Connecteur "${existingConnector.name}" supprimé avec succès`
    })

  } catch (error) {
    console.error('Connector deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}