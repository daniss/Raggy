import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    
    // Vérifier l'authentification interne
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.RAG_INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient()
    
    // Get organization settings
    const { data: orgSettings, error: settingsError } = await supabase
      .from('org_settings')
      .select('settings')
      .eq('org_id', orgId)
      .single()

    if (settingsError) {
      console.error('Error fetching org settings:', settingsError)
      // Return null custom prompt if org not found or error
      return NextResponse.json({
        custom_prompt: null,
        org_id: orgId,
        source: 'default'
      })
    }

    const customPrompt = orgSettings?.settings ? 
      (orgSettings.settings as any).custom_prompt : null

    // Validate custom prompt is enabled and has content
    const isValidCustomPrompt = customPrompt && 
      customPrompt.enabled && 
      customPrompt.content && 
      typeof customPrompt.content === 'string' &&
      customPrompt.content.trim().length > 0

    return NextResponse.json({
      custom_prompt: isValidCustomPrompt ? {
        content: customPrompt.content,
        enabled: customPrompt.enabled,
        version: customPrompt.version || 1,
        updated_at: customPrompt.updated_at
      } : null,
      org_id: orgId,
      source: isValidCustomPrompt ? 'custom' : 'default'
    })

  } catch (error) {
    console.error('Internal org prompt API error:', error)
    const { orgId } = await params;
    // Always return a fallback response to avoid breaking RAG service
    return NextResponse.json({
      custom_prompt: null,
      org_id: orgId,
      source: 'default',
      error: 'Internal server error'
    }, { status: 200 }) // Return 200 to avoid breaking RAG flow
  }
}
