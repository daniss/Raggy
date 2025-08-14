import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get invitations
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

    // Get all invitations
    const { data: invitations, error: invitationsError } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        profiles!invitations_invited_by_fkey (
          name,
          email
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (invitationsError) {
      return NextResponse.json({ error: invitationsError.message }, { status: 500 })
    }

    const formattedInvitations = invitations?.map(invitation => ({
      id: invitation.id,
      email: invitation.email,
      roles: [invitation.role],
      invitedBy: invitation.profiles?.name || invitation.profiles?.email || 'Unknown',
      invitedAt: invitation.created_at,
      expiresAt: invitation.expires_at
    })) || []

    return NextResponse.json(formattedInvitations)

  } catch (error) {
    console.error('Invitations API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create invitations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { emails, roles, orgId } = await request.json()

    if (!emails || !Array.isArray(emails) || !roles || !Array.isArray(roles) || !orgId) {
      return NextResponse.json({ error: "emails, roles, and orgId are required" }, { status: 400 })
    }

    // Verify user has admin/owner role and get org info
    const { data: userMembership } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations (
          tier
        )
      `)
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const orgTier = userMembership.organizations?.tier || 'starter'

    // Check seat limits
    const { data: currentMembers } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)

    const currentSeats = currentMembers?.length || 0
    const newInvitations = emails.length

    // Import limits check
    const { checkLimit, TIER_LIMITS } = await import('@/lib/limits')
    const limitCheck = checkLimit(orgTier as any, 'seats', currentSeats, newInvitations)

    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: "Seat limit exceeded",
        code: "SEATS_EXCEEDED",
        current_usage: currentSeats,
        limit: limitCheck.limit,
        suggested_tier: limitCheck.suggested_tier,
        message: `Votre plan ${orgTier} permet ${limitCheck.limit} sièges. Vous en utilisez actuellement ${currentSeats} et tentez d'inviter ${newInvitations} personnes supplémentaires.`
      }, { status: 402 })
    }

    const role = roles[0] // Take first role for now
    const invitationsToCreate = emails.map(email => ({
      email: email.trim().toLowerCase(),
      org_id: orgId,
      role,
      invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }))

    // Create invitations
    const { data: createdInvitations, error: createError } = await supabase
      .from('invitations')
      .insert(invitationsToCreate)
      .select()

    if (createError) {
      // Handle duplicate email error
      if (createError.code === '23505') {
        return NextResponse.json({ error: "One or more email addresses are already invited" }, { status: 400 })
      }
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // TODO: Send actual email invitations here
    // For now, just log the invitations
    console.log('Invitations created:', createdInvitations?.map(inv => inv.email))

    return NextResponse.json({ 
      success: true, 
      invitations: createdInvitations?.length || 0 
    })

  } catch (error) {
    console.error('Create invitations error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete invitation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invitationId, orgId } = await request.json()

    if (!invitationId || !orgId) {
      return NextResponse.json({ error: "invitationId and orgId are required" }, { status: 400 })
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

    // Delete invitation
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('org_id', orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete invitation error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}