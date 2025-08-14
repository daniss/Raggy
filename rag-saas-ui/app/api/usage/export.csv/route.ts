import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Créer un ReadableStream CSV
function createCSVStream(data: any[]): ReadableStream {
  const headers = [
    'Date',
    'Tokens Utilisés',
    'Documents Ajoutés', 
    'Stockage (GB)',
    'Conversations'
  ]
  
  return new ReadableStream({
    start(controller) {
      // Headers CSV
      controller.enqueue(new TextEncoder().encode(headers.join(',') + '\n'))
      
      // Data rows
      for (const row of data) {
        const csvRow = [
          row.month,
          row.tokens_used || 0,
          row.documents_count || 0,
          Math.round((row.storage_bytes || 0) / (1024 * 1024 * 1024) * 1000) / 1000, // GB avec 3 décimales
          row.conversations_count || 0
        ].join(',') + '\n'
        
        controller.enqueue(new TextEncoder().encode(csvRow))
      }
      
      controller.close()
    }
  })
}

// GET - Export CSV des données d'utilisation
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const month = url.searchParams.get('month') // Format YYYY-MM pour un mois ou range
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Vérifier que c'est Pro+
    if (membership.organizations?.tier === 'starter') {
      return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })
    }

    // Construire la requête selon le mois
    let query = supabase
      .from('usage_monthly')
      .select('month, tokens_used, documents_count, storage_bytes, conversations_count')
      .eq('org_id', membership.org_id)
      .order('month', { ascending: true })

    if (month) {
      // Export pour un mois spécifique
      query = query.eq('month', month)
    } else {
      // Export pour l'année courante par défaut
      const currentYear = new Date().getFullYear()
      query = query.gte('month', `${currentYear}-01-01`).lte('month', `${currentYear}-12-31`)
    }

    const { data: usageData, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit pour l'export
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'usage.exported',
      resource_type: 'usage_data',
      details: { 
        month: month || 'current_year',
        records_count: usageData?.length || 0
      }
    })

    // Créer le stream CSV
    const csvStream = createCSVStream(usageData || [])

    // Nom du fichier avec date
    const filename = month 
      ? `usage-${month}.csv`
      : `usage-${new Date().getFullYear()}.csv`

    return new Response(csvStream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Usage export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}