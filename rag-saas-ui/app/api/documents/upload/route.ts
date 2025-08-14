import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Initialize document upload
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { filename, mimeType, size, orgId } = await request.json()

    if (!filename || !mimeType || !size || !orgId) {
      return NextResponse.json({ 
        error: "filename, mimeType, size, and orgId are required" 
      }, { status: 400 })
    }

    // Verify user has editor+ role and get org info
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

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const orgTier = userMembership.organizations?.tier || 'starter'

    // Check document count and storage limits
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
    
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('documents_count, storage_bytes')
      .eq('org_id', orgId)
      .eq('month', currentMonth)
      .single()

    const currentDocs = usage?.documents_count || 0
    const currentStorage = usage?.storage_bytes || 0

    // Import limits check
    const { checkLimit } = await import('@/lib/limits')
    
    // Check document count limit
    const docLimitCheck = checkLimit(orgTier as any, 'documents_count', currentDocs, 1)
    if (!docLimitCheck.allowed) {
      return NextResponse.json({
        error: "Document limit exceeded",
        code: "DOCUMENTS_EXCEEDED",
        current_usage: currentDocs,
        limit: docLimitCheck.limit,
        suggested_tier: docLimitCheck.suggested_tier,
        message: `Votre plan ${orgTier} permet ${docLimitCheck.limit} documents. Vous en avez déjà ${currentDocs}.`
      }, { status: 402 })
    }

    // Check storage limit
    const storageLimitCheck = checkLimit(orgTier as any, 'storage_bytes', currentStorage, size)
    if (!storageLimitCheck.allowed) {
      const { formatStorageSize } = await import('@/lib/limits')
      return NextResponse.json({
        error: "Storage limit exceeded",
        code: "STORAGE_EXCEEDED",
        current_usage: currentStorage,
        limit: storageLimitCheck.limit,
        suggested_tier: storageLimitCheck.suggested_tier,
        message: `Votre plan ${orgTier} permet ${formatStorageSize(storageLimitCheck.limit!)}. Vous utilisez actuellement ${formatStorageSize(currentStorage)} et ce fichier fait ${formatStorageSize(size)}.`
      }, { status: 402 })
    }

    // Generate unique document ID and file path
    const documentId = randomUUID()
    const fileExtension = filename.split('.').pop() || ''
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${orgId}/${documentId}/${cleanFilename}`

    // Create document record in processing state
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        org_id: orgId,
        name: filename,
        original_name: filename,
        file_path: filePath,
        mime_type: mimeType,
        size_bytes: size,
        status: 'processing',
        uploaded_by: user.id
      })
      .select()
      .single()

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    // Generate signed URL for upload
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documents')
      .createSignedUploadUrl(filePath)

    if (uploadError) {
      // Cleanup document record if upload URL generation fails
      await supabase.from('documents').delete().eq('id', documentId)
      return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
    }

    return NextResponse.json({
      documentId: document.id,
      uploadUrl: uploadData.signedUrl,
      filePath
    })

  } catch (error) {
    console.error('Upload init error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Mark document as ready after successful upload
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId, orgId, status = 'ready' } = await request.json()

    if (!documentId || !orgId) {
      return NextResponse.json({ 
        error: "documentId and orgId are required" 
      }, { status: 400 })
    }

    // Verify user has editor+ role and document exists
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('org_id', orgId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { data: userMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (!userMembership || !['owner', 'admin', 'editor'].includes(userMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Update document status
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        status: status as 'ready' | 'error',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update usage stats and trigger indexation if document is ready
    if (status === 'ready') {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
      
      // Update or create usage record
      const { error: usageError } = await supabase
        .from('usage_monthly')
        .upsert({
          org_id: orgId,
          month: currentMonth,
          documents_count: 1,
          storage_bytes: document.size_bytes || 0
        }, {
          onConflict: 'org_id,month'
        })

      if (usageError) {
        console.error('Usage update error:', usageError)
      }

      // Déclencher indexation RAG automatique
      const ragBaseUrl = process.env.RAG_BASE_URL
      if (ragBaseUrl) {
        try {
          // Indexation asynchrone via FastAPI
          const indexResponse = await fetch(`${ragBaseUrl}/rag/index`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Request-ID': `doc-${documentId}-${Date.now()}`
            },
            body: JSON.stringify({
              org_id: orgId,
              document_id: documentId,
              correlation_id: `upload-${documentId}`
            }),
            // Ne pas bloquer la réponse si indexation lente
            signal: AbortSignal.timeout(2000) // 2s timeout
          })

          if (indexResponse.ok) {
            console.log(`Document ${documentId} queued for indexing`)
          } else {
            console.warn(`Indexation failed for document ${documentId}: ${indexResponse.status}`)
          }
        } catch (error) {
          // Log l'erreur mais ne fait pas échouer l'upload
          console.error(`Indexation error for document ${documentId}:`, error)
        }
      } else {
        console.info('RAG_BASE_URL not configured, skipping auto-indexation')
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Document status update error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}