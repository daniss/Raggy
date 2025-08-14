import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
      .select('org_id, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = membership.org_id

    // Get document counts and storage usage
    const { data: documents } = await supabase
      .from('documents')
      .select('status, size_bytes')
      .eq('org_id', orgId)

    const docsReady = documents?.filter(doc => doc.status === 'ready').length || 0
    const processing = documents?.filter(doc => doc.status === 'processing').length || 0
    const storageBytes = documents?.reduce((total, doc) => total + (doc.size_bytes || 0), 0) || 0

    // Get recent conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(5)

    // Get usage data (this month)
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('*')
      .eq('org_id', orgId)
      .eq('month', currentMonth)
      .single()

    // Get recent documents
    const { data: recentDocuments } = await supabase
      .from('documents')
      .select('id, name, status, created_at, size_bytes')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Build onboarding items
    const onboardingItems = [
      {
        key: 'upload-docs',
        label: 'Importer vos premiers documents',
        completed: docsReady > 0,
        description: 'Ajoutez des documents pour commencer à poser des questions'
      },
      {
        key: 'first-conversation',
        label: 'Poser votre première question',
        completed: conversations && conversations.length > 0,
        description: 'Testez votre assistant avec une question sur vos documents'
      },
      {
        key: 'invite-team',
        label: 'Inviter votre équipe',
        completed: false, // We'll check team members count later
        description: 'Collaborez avec votre équipe sur les documents'
      }
    ]

    return NextResponse.json({
      docsReady,
      processing,
      storageBytes,
      conversations: conversations || [],
      recentDocuments: recentDocuments || [],
      onboardingItems,
      usage: {
        tokens_used: usage?.tokens_used || 0,
        conversations_count: usage?.conversations_count || 0,
        documents_count: usage?.documents_count || 0
      },
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}