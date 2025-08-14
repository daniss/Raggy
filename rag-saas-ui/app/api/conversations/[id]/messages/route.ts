import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Get messages for a conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createSupabaseServerClient()
    const { id: conversationId } = await params
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        org_id,
        memberships!inner(user_id)
      `)
      .eq('id', conversationId)
      .eq('memberships.user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found or access denied" }, { status: 404 })
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, role, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    const formattedMessages = messages?.map(msg => ({
      id: msg.id,
      type: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.created_at
    })) || []

    return NextResponse.json(formattedMessages)

  } catch (error) {
    console.error('Messages API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Add new message to conversation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createSupabaseServerClient()
    const { id: conversationId } = await params
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, role } = await request.json()

    if (!content || !role || !['user', 'assistant'].includes(role)) {
      return NextResponse.json({ error: "Valid content and role are required" }, { status: 400 })
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        org_id,
        memberships!inner(user_id, role)
      `)
      .eq('id', conversationId)
      .eq('memberships.user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found or access denied" }, { status: 404 })
    }

    // Only allow editor+ to add messages
    if (!['owner', 'admin', 'editor'].includes((conversation as any).memberships.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Add message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role
      })
      .select()
      .single()

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      id: message.id,
      type: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
      timestamp: message.created_at
    })

  } catch (error) {
    console.error('Add message error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}