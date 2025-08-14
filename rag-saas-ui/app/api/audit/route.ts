import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Logs d'audit avec filtres
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    
    // Paramètres de filtre
    const from = url.searchParams.get('from') // Date début (ISO string)
    const to = url.searchParams.get('to') // Date fin (ISO string)  
    const type = url.searchParams.get('type') // Type d'événement (ex: document.*, user.*)
    const userId = url.searchParams.get('user') // User ID
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 1000) // Max 1000
    const offset = parseInt(url.searchParams.get('offset') || '0')
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization avec permissions
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

    // Permissions pour voir les audits : SECURITY_ADMIN, ADMIN, OWNER
    const canViewAudits = ['owner', 'admin', 'security_admin'].includes(membership.role)
    if (!canViewAudits) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Construire la requête avec filtres
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        created_at,
        user_id,
        profiles!audit_logs_user_id_fkey(name, email)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Appliquer les filtres
    if (from) {
      query = query.gte('created_at', from)
    }
    if (to) {
      query = query.lte('created_at', to)
    }
    if (type) {
      if (type.includes('*')) {
        // Wildcard search
        const pattern = type.replace('*', '%')
        query = query.like('action', pattern)
      } else {
        query = query.eq('action', type)
      }
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: auditLogs, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total count pour pagination
    const { count: totalCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', membership.org_id)

    // Formatter les données pour l'UI
    const formattedLogs = auditLogs.map(log => ({
      id: log.id,
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      details: log.details,
      created_at: log.created_at,
      user_name: log.profiles?.name || log.profiles?.email || 'Système',
      user_id: log.user_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent
    }))

    // Types d'événements disponibles pour les filtres
    const { data: eventTypes } = await supabase
      .from('audit_logs')
      .select('action')
      .eq('org_id', membership.org_id)
      .order('action')

    const uniqueEventTypes = [...new Set(eventTypes?.map(e => e.action) || [])]

    return NextResponse.json({
      data: formattedLogs,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        has_more: (totalCount || 0) > offset + limit
      },
      filters: {
        from,
        to,
        type,
        user: userId
      },
      available_event_types: uniqueEventTypes
    })

  } catch (error) {
    console.error('Audit logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}