import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get conversations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 })
    }

    // Verify user belongs to org
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const search = url.searchParams.get('search') || ''
    
    const offset = (page - 1) * limit

    // Build query with pagination
    let query = supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('org_id', orgId)

    // Add search filter if provided
    if (search) {
      query = query.ilike('title', `%${search}%`)
    }

    // Add pagination and ordering
    const { data: conversations, error: conversationsError, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (conversationsError) {
      return NextResponse.json({ error: conversationsError.message }, { status: 500 })
    }

    // Get message counts for each conversation (separate query for performance)
    const conversationIds = conversations?.map(c => c.id) || []
    const { data: messageCounts } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .then(result => {
        if (result.error) return { data: {} as Record<string, number> }
        
        // Count messages per conversation
        const counts: Record<string, number> = {}
        result.data?.forEach(msg => {
          counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1
        })
        return { data: counts }
      })

    const formattedConversations = conversations?.map(conv => ({
      id: conv.id,
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      message_count: messageCounts?.[conv.id] || 0
    })) || []

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: ((count || 0) > offset + limit)
      }
    })

  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId, title } = await request.json()

    if (!orgId || !title) {
      return NextResponse.json({ error: "orgId and title are required" }, { status: 400 })
    }

    // Verify user belongs to org and has editor+ role
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Create conversation
    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        title,
        org_id: orgId,
        user_id: user.id
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      lastMessage: "Maintenant",
      messages: 0,
      updatedAt: conversation.created_at
    })

  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}