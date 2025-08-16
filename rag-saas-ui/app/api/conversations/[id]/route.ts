import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Update conversation (mainly for title updates)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createSupabaseServerClient()
    const { id: conversationId } = await params
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title } = await request.json()

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: "Valid title is required" }, { status: 400 })
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        org_id,
        user_id
      `)
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is a member of the organization with editor+ permissions
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', conversation.org_id)
      .single()

    if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Update conversation title
    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update({ 
        title: title.trim(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      id: updatedConversation.id,
      title: updatedConversation.title,
      updatedAt: updatedConversation.updated_at
    })

  } catch (error) {
    console.error('Update conversation error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete conversation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
        user_id
      `)
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is a member of the organization 
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', conversation.org_id)
      .single()

    // Only allow editor+ to delete conversations, or the owner of the conversation
    const isConversationOwner = conversation.user_id === user.id
    
    if (!membership || (!['owner', 'admin', 'editor'].includes(membership.role) && !isConversationOwner)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Delete conversation (messages will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}