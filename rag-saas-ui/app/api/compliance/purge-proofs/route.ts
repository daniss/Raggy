import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// GET - Liste des preuves de purge
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
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

    // Vérifier que c'est Pro+ et permissions adequates
    if (membership.organizations?.tier === 'starter') {
      return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })
    }

    // Permissions pour voir la conformité : SECURITY_ADMIN, ADMIN, OWNER
    const canViewCompliance = ['owner', 'admin', 'security_admin'].includes(membership.role)
    if (!canViewCompliance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get purge proofs
    const { data: purgeProofs, error } = await supabase
      .from('purge_proofs')
      .select(`
        id,
        document_id,
        stats_before,
        stats_after,
        proof_hash,
        created_at,
        requested_by,
        profiles!purge_proofs_requested_by_fkey(name, email)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('purge_proofs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', membership.org_id)

    // Formatter pour l'UI
    const formattedProofs = purgeProofs.map(proof => ({
      id: proof.id,
      document_id: proof.document_id,
      stats_before: proof.stats_before,
      stats_after: proof.stats_after,
      proof_hash: proof.proof_hash,
      created_at: proof.created_at,
      requested_by: proof.profiles?.name || proof.profiles?.email || 'Unknown'
    }))

    return NextResponse.json({
      data: formattedProofs,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        has_more: (totalCount || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Purge proofs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Créer une preuve de purge (appelé automatiquement lors de suppression de document)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await request.json()
    const { document_id, stats_before, stats_after } = body

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Créer un hash cryptographique de la preuve
    const proofData = {
      document_id,
      stats_before,
      stats_after,
      org_id: membership.org_id,
      timestamp: new Date().toISOString()
    }
    
    const proofHash = createHash('sha256')
      .update(JSON.stringify(proofData))
      .digest('hex')

    // Insérer la preuve
    const { data: purgeProof, error } = await supabase
      .from('purge_proofs')
      .insert({
        org_id: membership.org_id,
        document_id,
        stats_before,
        stats_after,
        proof_hash: proofHash,
        requested_by: user.id
      })
      .select('id, proof_hash, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'compliance.purge_proof_created',
      resource_type: 'purge_proof',
      resource_id: purgeProof.id,
      details: { document_id, proof_hash: proofHash }
    })

    return NextResponse.json({
      id: purgeProof.id,
      proof_hash: purgeProof.proof_hash,
      created_at: purgeProof.created_at
    })

  } catch (error) {
    console.error('Purge proof creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}