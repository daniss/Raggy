import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Accept invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 })
    }

    // Find the invitation by token
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        org_id,
        role,
        expires_at,
        organizations (
          name,
          tier
        )
      `)
      .eq('token', token)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 })
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 })
    }

    // Check if the invitation email matches the current user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profile?.email !== invitation.email) {
      return NextResponse.json({ 
        error: "Invitation email does not match your account email",
        expected_email: invitation.email,
        your_email: profile?.email
      }, { status: 400 })
    }

    // Check if user is already a member of this organization
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', invitation.org_id)
      .single()

    if (existingMembership) {
      return NextResponse.json({ error: "You are already a member of this organization" }, { status: 400 })
    }

    // Check seat limits before accepting
    const { data: currentMembers } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', invitation.org_id)

    const currentSeats = currentMembers?.length || 0
    const orgTier = invitation.organizations?.tier || 'starter'

    const { checkLimit } = await import('@/lib/limits')
    const limitCheck = checkLimit(orgTier as any, 'seats', currentSeats, 1)

    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: "Organization has reached its seat limit",
        code: "SEATS_EXCEEDED",
        message: "Cette organisation a atteint sa limite de sièges. Contactez l'administrateur pour mettre à niveau le plan."
      }, { status: 402 })
    }

    // Create the membership
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        org_id: invitation.org_id,
        role: invitation.role,
        joined_at: new Date().toISOString()
      })

    if (membershipError) {
      console.error('Membership creation error:', membershipError)
      return NextResponse.json({ error: "Failed to create membership" }, { status: 500 })
    }

    // Delete the invitation now that it's been accepted
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitation.id)

    if (deleteError) {
      console.error('Invitation deletion error:', deleteError)
      // Non-fatal error, membership was created successfully
    }

    // Create audit log entry
    try {
      await supabase
        .from('audit_logs')
        .insert({
          org_id: invitation.org_id,
          user_id: user.id,
          action: 'invitation_accepted',
          resource_type: 'membership',
          resource_id: invitation.org_id,
          details: {
            role: invitation.role,
            email: invitation.email
          }
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Non-fatal error
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: invitation.org_id,
        name: invitation.organizations?.name,
        tier: invitation.organizations?.tier,
        role: invitation.role
      }
    })

  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}