import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userRes.user.id;
    const createdAt = new Date(userRes.user.created_at).getTime();
    const ageMinutes = (Date.now() - createdAt) / 60000;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roles, error: roleErr } = await admin
      .from('user_roles').select('role').eq('user_id', userId);
    if (roleErr) throw roleErr;

    const current = (roles ?? []).map((r: any) => r.role);

    if (current.includes('parent')) {
      return new Response(JSON.stringify({ ok: true, role: 'parent', already: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety: only auto-promote if user is brand new (<= 15 min old)
    // AND has only the default 'student' role and nothing else.
    const onlyStudent = current.length === 1 && current[0] === 'student';
    if (!onlyStudent || ageMinutes > 15) {
      return new Response(JSON.stringify({
        ok: false,
        reason: 'role_not_eligible',
        current_role: current[0] ?? null,
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Replace student row with parent
    const { error: delErr } = await admin
      .from('user_roles').delete().eq('user_id', userId).eq('role', 'student');
    if (delErr) throw delErr;
    const { error: insErr } = await admin
      .from('user_roles').insert({ user_id: userId, role: 'parent' });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, role: 'parent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});