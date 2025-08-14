import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

// Rate limiting simple in-memory (3 créations par org par minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const key = `apikey:${orgId}`
  const current = rateLimitMap.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 }) // 1 minute
    return true
  }
  
  if (current.count >= 3) {
    return false
  }
  
  current.count++
  return true
}

function generateApiKey(): string {
  // Format: rk_<32 bytes en base64url pour plus de compacité>
  return 'rk_' + randomBytes(32).toString('base64url')
}

async function hashApiKey(key: string): Promise<string> {
  // Utiliser bcrypt avec rounds=12 pour un bon équilibre sécurité/performance
  return await bcrypt.hash(key, 12)
}

async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(key, hash)
}

// GET - Liste des clés API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization avec vérification des permissions
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Vérifier les permissions (ADMIN/OWNER pour voir, BILLING_ADMIN en lecture seule)
    const canView = ['owner', 'admin'].includes(membership.role)
    const billingReadOnly = ['billing_admin', 'security_admin'].includes(membership.role)
    
    if (!canView && !billingReadOnly) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get API keys (sans le hash)
    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        name,
        created_at,
        last_used_at,
        expires_at,
        created_by,
        profiles!api_keys_created_by_fkey(name, email)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formattedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      created_by: key.profiles?.name || key.profiles?.email || 'Unknown',
      can_delete: canView // Seuls admin/owner peuvent supprimer
    }))

    return NextResponse.json({ 
      data: formattedKeys,
      permissions: {
        can_create: canView, // Seuls admin/owner peuvent créer
        can_delete: canView
      }
    })

  } catch (error) {
    console.error('API Keys list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Créer une nouvelle clé API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization avec vérification des permissions
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!membership?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Vérifier les permissions (ADMIN/OWNER seulement)
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Rate limiting
    if (!checkRateLimit(membership.org_id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    // Parse request body
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.length < 3) {
      return NextResponse.json({ error: 'Name is required and must be at least 3 characters' }, { status: 400 })
    }

    // Générer la clé API et son hash
    const plainKey = generateApiKey()
    const keyHash = await hashApiKey(plainKey)

    // Insérer en base
    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .insert({
        org_id: membership.org_id,
        name: name.trim(),
        key_hash: keyHash,
        created_by: user.id
      })
      .select('id, name, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      org_id: membership.org_id,
      user_id: user.id,
      action: 'apikey.created',
      resource_type: 'api_key',
      resource_id: apiKey.id,
      details: { key_name: name }
    }).select()

    // Retourner la clé en clair (une seule fois) - format standardisé
    return NextResponse.json({
      ok: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey, // Clé en clair - affichée une seule fois
        created_at: apiKey.created_at,
        warning: 'Cette clé ne sera plus jamais affichée. Copiez-la maintenant.',
        format: 'rk_*',
        usage: 'Ajoutez "Authorization: Bearer ' + plainKey + '" dans vos requêtes API'
      }
    })

  } catch (error) {
    console.error('API Key creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}