import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Get documents
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')
    
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

    let query = supabase
      .from('documents')
      .select(`
        id,
        name,
        original_name,
        file_path,
        mime_type,
        size_bytes,
        status,
        tags,
        created_at,
        updated_at,
        profiles!documents_uploaded_by_fkey (
          name,
          email
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    // Filter by status
    if (status && status !== 'all') {
      // Map frontend status to database status
      const dbStatus = status === 'uploaded' ? 'processing' : status
      query = query.eq('status', dbStatus as 'processing' | 'ready' | 'error')
    }

    // Search in document names
    if (q) {
      query = query.ilike('name', `%${q}%`)
    }

    const { data: documents, error: documentsError } = await query

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 })
    }

    const formattedDocuments = documents?.map(doc => ({
      id: doc.id,
      name: doc.name,
      originalName: doc.original_name,
      type: doc.mime_type?.split('/')[1]?.toUpperCase() || 'FILE',
      size: doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
      uploadedAt: doc.created_at,
      status: doc.status === 'ready' ? 'Prêt' : 
              doc.status === 'processing' ? 'En cours' : 'Erreur',
      tags: doc.tags || [],
      uploadedBy: doc.profiles?.name || doc.profiles?.email || 'Unknown',
      filePath: doc.file_path
    })) || []

    return NextResponse.json(formattedDocuments)

  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete document
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId, orgId } = await request.json()

    if (!documentId || !orgId) {
      return NextResponse.json({ error: "documentId and orgId are required" }, { status: 400 })
    }

    // Verify user has editor+ role
    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get document info first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .eq('org_id', orgId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Delete from storage if file exists
    if (document.file_path) {
      const { error: storageError } = await supabase
        .storage
        .from('documents')
        .remove([document.file_path])

      if (storageError) {
        console.error('Storage delete error:', storageError)
      }
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('org_id', orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}