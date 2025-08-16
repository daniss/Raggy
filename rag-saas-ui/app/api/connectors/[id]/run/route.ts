import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Rate limiting pour les runs (2/min par connecteur)
const runRateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRunRateLimit(connectorId: string): boolean {
  const now = Date.now()
  const key = `run:${connectorId}`
  const current = runRateLimitMap.get(key)
  
  if (!current || now > current.resetTime) {
    runRateLimitMap.set(key, { count: 1, resetTime: now + 60000 }) // 1 minute
    return true
  }
  
  if (current.count >= 2) {
    return false
  }
  
  current.count++
  return true
}

// POST - Lancer une synchronisation de connecteur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { data: connector } = await supabase
      .from('connectors')
      .select('id, name, type, status, org_id')
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .single()

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
    }

    // Vérifier que le connecteur n'est pas déjà en cours d'exécution
    if (connector.status === 'running') {
      return NextResponse.json({ error: 'Connector is already running' }, { status: 400 })
    }

    // Rate limiting
    if (!checkRunRateLimit(id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    // Mettre le connecteur en mode running
    await supabase
      .from('connectors')
      .update({ status: 'running' })
      .eq('id', id)
      .eq('org_id', membership.org_id)

    // Créer un run
    const { data: connectorRun, error: runError } = await supabase
      .from('connector_runs')
      .insert({
        connector_id: id,
        status: 'running',
        stats: { started_by: user.id },
        started_at: new Date().toISOString()
      })
      .select('id, started_at')
      .single()

    if (runError) {
      // Restaurer le statut du connecteur en cas d'erreur
      await supabase
        .from('connectors')
        .update({ status: 'idle' })
        .eq('id', id)
        .eq('org_id', membership.org_id)

      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // TODO: Ici on lancerait la vraie synchronisation en arrière-plan
    // Pour l'instant, on simule avec un délai puis completion
    setTimeout(async () => {
      try {
        // Simulation de travail avec résultats aléatoires
        const isSuccess = Math.random() > 0.2 // 80% de succès
        const duration = Math.floor(Math.random() * 30000) + 5000 // 5-35 secondes
        const docsProcessed = isSuccess ? Math.floor(Math.random() * 100) + 1 : 0
        const errors = isSuccess ? 0 : Math.floor(Math.random() * 5) + 1

        const stats = {
          documents_processed: docsProcessed,
          errors_count: errors,
          started_by: user.id
        }

        // Mettre à jour le run
        await supabase
          .from('connector_runs')
          .update({
            status: isSuccess ? 'success' : 'error',
            duration_ms: duration,
            stats: stats,
            error_message: isSuccess ? null : 'Erreur de simulation',
            completed_at: new Date().toISOString()
          })
          .eq('id', connectorRun.id)

        // Mettre à jour le statut du connecteur
        await supabase
          .from('connectors')
          .update({ status: isSuccess ? 'idle' : 'error' })
          .eq('id', id)

      } catch (error) {
        console.error('Background run simulation error:', error)
      }
    }, 2000) // Délai de 2 secondes pour voir le changement

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'connector.run.started',
      resource_type: 'connector',
      resource_id: id,
      details: { 
        connector_name: connector.name,
        run_id: connectorRun.id
      }
    })

    return NextResponse.json({
      run_id: connectorRun.id,
      connector_id: id,
      status: 'running',
      started_at: connectorRun.started_at,
      message: `Synchronisation du connecteur "${connector.name}" démarrée`
    })

  } catch (error) {
    console.error('Connector run error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}