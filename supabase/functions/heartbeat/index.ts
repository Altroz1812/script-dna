import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Module-scoped admin client — reused across warm invocations to avoid
// reopening Postgres connections on every heartbeat ping (critical at scale).
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: u, error: ue } = await admin.auth.getUser(token)
    if (ue || !u?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = u.user.id
    const body = await req.json().catch(() => ({}))
    const end = !!body?.end
    const ip = (req.headers.get('cf-connecting-ip')
      || (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || null) as string | null
    const ua = req.headers.get('user-agent') ?? null

    // Find most recent open session for this user
    const { data: open } = await admin
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()

    if (open?.id) {
      const patch: any = { last_seen_at: now }
      if (end) patch.ended_at = now
      await admin.from('user_sessions').update(patch).eq('id', open.id)
      return new Response(JSON.stringify({ ok: true, session_id: open.id, ended: end }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No open session (e.g. process restarted after login pre-edge-deploy). Create one unless ending.
    if (!end) {
      const { data: sess } = await admin.from('user_sessions').insert({
        user_id: userId, ip_address: ip, user_agent: ua,
      }).select('id').single()
      return new Response(JSON.stringify({ ok: true, session_id: sess?.id ?? null, created: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, noop: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})