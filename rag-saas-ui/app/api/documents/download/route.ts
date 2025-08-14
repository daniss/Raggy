import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const url = new URL(request.url)
    const filePath = url.searchParams.get('path')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 })
    }

    // Verify user has access to this document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        id,
        org_id,
        memberships!inner(user_id)
      `)
      .eq('file_path', filePath)
      .eq('memberships.user_id', user.id)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 })
    }

    // Generate signed URL for download (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600)

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 })
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })

  } catch (error) {
    console.error('Download API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}