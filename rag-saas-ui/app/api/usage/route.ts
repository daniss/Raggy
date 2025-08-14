import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Résumé d'utilisation mensuelle
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const month = url.searchParams.get('month') // Format YYYY-MM
    
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

    // Utiliser le mois courant si pas spécifié
    const targetMonth = month || new Date().toISOString().slice(0, 7) // YYYY-MM

    // Get usage data pour le mois
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('*')
      .eq('org_id', membership.org_id)
      .eq('month', targetMonth)
      .single()

    // Get organization tier limits (mock pour l'instant, devrait venir des settings)
    const tierLimits = {
      starter: { tokens: 50000, documents: 100, storage_gb: 1 },
      pro: { tokens: 500000, documents: 1000, storage_gb: 10 },
      enterprise: { tokens: -1, documents: -1, storage_gb: -1 } // Illimité
    }

    const tier = membership.organizations?.tier || 'starter'
    const limits = tierLimits[tier as keyof typeof tierLimits]

    // Calculer les pourcentages d'utilisation
    const tokens_used = usage?.tokens_used || 0
    const documents_count = usage?.documents_count || 0
    const storage_bytes = usage?.storage_bytes || 0
    const storage_gb = storage_bytes / (1024 * 1024 * 1024)

    const usage_percentages = {
      tokens: limits.tokens === -1 ? 0 : Math.min(100, (tokens_used / limits.tokens) * 100),
      documents: limits.documents === -1 ? 0 : Math.min(100, (documents_count / limits.documents) * 100),
      storage: limits.storage_gb === -1 ? 0 : Math.min(100, (storage_gb / limits.storage_gb) * 100)
    }

    // Get historical data (derniers 6 mois)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const startDate = sixMonthsAgo.toISOString().slice(0, 7)

    const { data: historicalUsage } = await supabase
      .from('usage_monthly')
      .select('month, tokens_used, documents_count, storage_bytes, conversations_count')
      .eq('org_id', membership.org_id)
      .gte('month', startDate)
      .order('month', { ascending: true })

    // Trends (simple calcul dernier mois vs précédent)
    const trends = {
      tokens: 0,
      documents: 0,
      storage: 0,
      conversations: 0
    }

    if (historicalUsage && historicalUsage.length >= 2) {
      const current = historicalUsage[historicalUsage.length - 1]
      const previous = historicalUsage[historicalUsage.length - 2]
      
      if (previous.tokens_used) {
        trends.tokens = (((current.tokens_used || 0) - previous.tokens_used) / previous.tokens_used) * 100
      }
      if (previous.documents_count) {
        trends.documents = (((current.documents_count || 0) - previous.documents_count) / previous.documents_count) * 100
      }
      if (previous.storage_bytes) {
        trends.storage = (((current.storage_bytes || 0) - previous.storage_bytes) / previous.storage_bytes) * 100
      }
      if (previous.conversations_count) {
        trends.conversations = (((current.conversations_count || 0) - previous.conversations_count) / previous.conversations_count) * 100
      }
    }

    return NextResponse.json({
      month: targetMonth,
      current_usage: {
        tokens_used,
        documents_count,
        storage_bytes,
        storage_gb: Math.round(storage_gb * 1000) / 1000,
        conversations_count: usage?.conversations_count || 0
      },
      limits: {
        tokens: limits.tokens,
        documents: limits.documents,
        storage_gb: limits.storage_gb
      },
      usage_percentages,
      trends,
      historical_usage: historicalUsage || [],
      tier
    })

  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}