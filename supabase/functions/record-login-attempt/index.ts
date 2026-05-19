import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json().catch(() => ({}))
    const email: string = (body.email ?? '').toString().trim().toLowerCase()
    const success: boolean = !!body.success
    const error_code: string | null = body.error_code ? String(body.error_code).slice(0, 120) : null

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ip = (req.headers.get('cf-connecting-ip')
      || (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || null) as string | null
    const ua = req.headers.get('user-agent') ?? null

    // Resolve user id by email (works whether success or not — for audit)
    let userId: string | null = null
    try {
      const { data: profileRow } = await supabase
        .from('profiles').select('user_id').eq('email', email).maybeSingle()
      userId = profileRow?.user_id ?? null
    } catch (_e) { /* ignore */ }

    await supabase.from('login_attempts').insert({
      email, success, ip_address: ip, user_agent: ua, error_code, user_id: userId,
    })

    let sessionId: string | null = null
    if (success && userId) {
      // Close any orphan open sessions for this user older than 12h
      await supabase.from('user_sessions')
        .update({ ended_at: new Date().toISOString() })
        .is('ended_at', null)
        .eq('user_id', userId)
        .lt('last_seen_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())

      const { data: sess } = await supabase.from('user_sessions').insert({
        user_id: userId, ip_address: ip, user_agent: ua,
      }).select('id').single()
      sessionId = sess?.id ?? null
    }

    return new Response(JSON.stringify({ ok: true, session_id: sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})