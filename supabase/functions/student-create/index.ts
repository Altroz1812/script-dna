// Creates a student auth account using an org-prefixed numeric login ID.
// Caller must be SuperAdmin, Admin, or Support.
// Inputs: { organization_id, display_name, parent_user_id?, batch_id?, custom_id? }
// Output: { user_id, student_login_id, password, email }

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYNTHETIC_DOMAIN = 'students.aurapen.local'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function genDigits(n: number) {
  let s = ''
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString()
  return s
}

function normalizePrefix(raw: string) {
  const cleaned = (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  return cleaned.length >= 2 ? cleaned : 'STU'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  // Validate caller JWT and resolve user
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
  const callerId = userData.user.id

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Role check: superadmin / admin / support
  const { data: roles } = await admin
    .from('user_roles').select('role').eq('user_id', callerId)
  const roleSet = new Set((roles ?? []).map((r: any) => r.role))
  const isSA = roleSet.has('superadmin')
  const isAllowed = isSA || roleSet.has('admin') || roleSet.has('support')
  if (!isAllowed) return json({ error: 'forbidden' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const organization_id: string | undefined = body?.organization_id
  const display_name: string = (body?.display_name || '').toString().trim()
  const parent_user_id: string | undefined = body?.parent_user_id || undefined
  const batch_id: string | undefined = body?.batch_id || undefined
  const custom_id: string | undefined = body?.custom_id
    ? String(body.custom_id).toUpperCase().replace(/[^A-Z0-9-]/g, '')
    : undefined

  if (!organization_id) return json({ error: 'organization_id_required' }, 400)
  if (!display_name || display_name.length < 2) {
    return json({ error: 'display_name_required' }, 400)
  }

  // Non-superadmin must belong to the target org
  if (!isSA) {
    const { data: mem } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', callerId)
      .eq('organization_id', organization_id)
      .maybeSingle()
    if (!mem) return json({ error: 'forbidden_org' }, 403)
  }

  // Resolve prefix from org slug
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id, slug, name')
    .eq('id', organization_id)
    .maybeSingle()
  if (orgErr || !org) return json({ error: 'organization_not_found' }, 404)
  const prefix = normalizePrefix((org.slug as string) || (org.name as string) || 'STU').slice(0, 3)

  // Generate a unique student_login_id (or use custom)
  let studentLoginId = ''
  if (custom_id) {
    studentLoginId = custom_id
    const { data: dup } = await admin
      .from('profiles').select('user_id').eq('student_login_id', custom_id).maybeSingle()
    if (dup) return json({ error: 'id_taken' }, 409)
  } else {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `${prefix}-${genDigits(6)}`
      const { data: dup } = await admin
        .from('profiles').select('user_id').eq('student_login_id', candidate).maybeSingle()
      if (!dup) {
        studentLoginId = candidate
        break
      }
    }
    if (!studentLoginId) return json({ error: 'id_generation_failed' }, 500)
  }

  const syntheticEmail = `${studentLoginId.toLowerCase()}@${SYNTHETIC_DOMAIN}`
  const password = studentLoginId // password equals ID; user can change later

  // Create the auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name, student_login_id: studentLoginId },
  })
  if (createErr || !created?.user) {
    return json({ error: createErr?.message || 'create_user_failed' }, 500)
  }
  const newUserId = created.user.id

  // Update profile (handle_new_user trigger already inserted a row)
  await admin.from('profiles').update({
    display_name,
    organization_id,
    student_login_id: studentLoginId,
    email: syntheticEmail,
  }).eq('user_id', newUserId)

  // Ensure role = student
  const { data: existingRole } = await admin
    .from('user_roles').select('id').eq('user_id', newUserId).maybeSingle()
  if (!existingRole) {
    await admin.from('user_roles').insert({ user_id: newUserId, role: 'student' })
  }

  // Add to organization
  await admin.from('organization_members').insert({
    organization_id, user_id: newUserId,
  }).then(() => {}, () => {})

  // Link parent
  if (parent_user_id) {
    await admin.from('parent_children').insert({
      parent_id: parent_user_id, child_id: newUserId,
    }).then(() => {}, () => {})
  }

  // Enroll in batch
  let enrolled = false
  if (batch_id) {
    const { error: enrollErr } = await admin.from('batch_students').insert({
      batch_id, student_id: newUserId,
    })
    enrolled = !enrollErr
  }

  return json({
    user_id: newUserId,
    student_login_id: studentLoginId,
    password,
    email: syntheticEmail,
    enrolled,
  })
})