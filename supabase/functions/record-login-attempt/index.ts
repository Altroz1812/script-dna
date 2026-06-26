import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Reuse a single service-role client across warm invocations.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
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

    // Note: user_sessions lifecycle is owned by the `heartbeat` function
    // to avoid duplicate inserts and row-contention on login bursts.
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})