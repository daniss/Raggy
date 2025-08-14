import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Historique des runs d'un connecteur
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    
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

    // Vérifier Enterprise
    if (membership.organizations?.tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise tier required' }, { status: 403 })
    }

    // Vérifier que le connecteur existe et appartient à l'org
    const { data: connector } = await supabase
      .from('connectors')
      .select('id, name, org_id')
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .single()

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
    }

    // Get runs pour ce connecteur
    const { data: runs, error } = await supabase
      .from('connector_runs')
      .select('*')
      .eq('connector_id', id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('connector_runs')
      .select('*', { count: 'exact', head: true })
      .eq('connector_id', id)

    // Formatter pour l'UI
    const formattedRuns = runs.map(run => {
      const duration = run.duration_ms 
        ? `${Math.round(run.duration_ms / 1000)}s`
        : run.status === 'running' 
          ? 'En cours...'
          : '-'

      return {
        id: run.id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        duration,
        duration_ms: run.duration_ms,
        stats: run.stats,
        error_message: run.error_message
      }
    })

    // Stats générales
    const stats = {
      total_runs: totalCount || 0,
      success_count: runs.filter(r => r.status === 'success').length,
      error_count: runs.filter(r => r.status === 'error').length,
      running_count: runs.filter(r => r.status === 'running').length
    }

    return NextResponse.json({
      connector: {
        id: connector.id,
        name: connector.name
      },
      runs: formattedRuns,
      stats,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        has_more: (totalCount || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Connector runs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}