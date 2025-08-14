import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get team members
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

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('memberships')
      .select(`
        id,
        role,
        created_at,
        profiles (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    const formattedMembers = members?.map(member => ({
      id: member.profiles?.id,
      name: member.profiles?.name || member.profiles?.email || 'Unknown',
      email: member.profiles?.email || '',
      roles: [member.role],
      lastActivity: member.created_at,
      mfaEnabled: false, // TODO: Implement MFA checking
      avatar: member.profiles?.avatar_url,
      membershipId: member.id
    })) || []

    return NextResponse.json(formattedMembers)

  } catch (error) {
    console.error('Members API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update member role
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { memberId, orgId, roles } = await request.json()

    if (!memberId || !orgId || !roles || !Array.isArray(roles)) {
      return NextResponse.json({ error: "memberId, orgId, and roles are required" }, { status: 400 })
    }

    // Verify user has admin/owner role
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Update member role (take first role for now, as our DB supports single role per membership)
    const newRole = roles[0]
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: newRole })
      .eq('user_id', memberId)
      .eq('org_id', orgId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove member
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { memberId, orgId } = await request.json()

    if (!memberId || !orgId) {
      return NextResponse.json({ error: "memberId and orgId are required" }, { status: 400 })
    }

    // Verify user has admin/owner role
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Prevent removing self if owner
    if (memberId === user.id && userMembership.role === 'owner') {
      return NextResponse.json({ error: "Cannot remove organization owner" }, { status: 400 })
    }

    // Remove membership
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', memberId)
      .eq('org_id', orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}