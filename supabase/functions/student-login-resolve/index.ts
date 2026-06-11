// Resolves a student_login_id to its synthetic auth email so the client
// can call signInWithPassword. Public (no JWT required).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const raw = String(body?.student_login_id || '').trim().toUpperCase()
  if (!raw || raw.length < 4 || raw.length > 24 || !/^[A-Z0-9-]+$/.test(raw)) {
    return json({ error: 'invalid_id' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await admin
    .from('profiles')
    .select('email')
    .eq('student_login_id', raw)
    .maybeSingle()

  if (error) return json({ error: 'lookup_failed' }, 500)
  if (!data?.email) return json({ error: 'not_found' }, 404)

  return json({ email: data.email })
})