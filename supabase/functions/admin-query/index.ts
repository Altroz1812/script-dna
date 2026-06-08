import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Per-instance micro-cache for hot read-only actions. Lives only while the
// worker is warm; absorbs bursty navigation (e.g. user flipping between
// /users, /students, /payments) without serving stale data for long.
const READ_CACHE_TTL_MS = 5_000
const READ_CACHEABLE_ACTIONS = new Set<string>([
  'get_stats',
  'get_support_overview',
  'list_courses',
  'list_teachers',
  'list_all_students',
  'list_students_with_batches',
  'list_batches',
  'list_organizations',
  'list_subscription_plans',
])
type CacheEntry = { expiresAt: number; payload: any }
const readCache = new Map<string, CacheEntry>()
function cacheKey(action: string, callerId: string | null, orgId: string | null, params: any): string {
  return `${action}|${callerId ?? 'anon'}|${orgId ?? 'global'}|${JSON.stringify(params ?? {})}`
}
function readFromCache(key: string): any | undefined {
  const e = readCache.get(key)
  if (!e) return undefined
  if (e.expiresAt < Date.now()) { readCache.delete(key); return undefined }
  return e.payload
}
function writeToCache(key: string, payload: any) {
  // Bound memory: simple FIFO eviction when over 200 entries.
  if (readCache.size > 200) {
    const first = readCache.keys().next().value
    if (first) readCache.delete(first)
  }
  readCache.set(key, { expiresAt: Date.now() + READ_CACHE_TTL_MS, payload })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const action = body.action
    let params = body.params ?? {}

    // Active organization scope. The client (any role) sets `target_org_id` to
    // narrow the request to a single tenant. We validate it against the
    // caller's memberships so admins / support / teachers cannot peek at orgs
    // they don't belong to.
    const requestedOrgId: string | null = (params && typeof params.target_org_id === 'string')
      ? params.target_org_id
      : null
    if (params && 'target_org_id' in params) {
      const { target_org_id: _omit, ...rest } = params
      params = rest
    }

    // Resolve caller identity + roles (best-effort; many actions also re-check)
    let callerUserId: string | null = null
    try {
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace(/^Bearer\s+/i, '')
      if (token) {
        const { data: u } = await supabase.auth.getUser(token)
        callerUserId = u?.user?.id ?? null
      }
    } catch (_e) { /* anonymous fallback */ }

    let callerIsSuperadmin = false
    let callerRoles: string[] = []
    let callerIsAdmin = false
    let callerIsSupport = false
    let callerIsTeacher = false
    let callerOrgMemberships: string[] = []
    if (callerUserId) {
      const { data: roleRows } = await supabase
        .from('user_roles').select('role').eq('user_id', callerUserId)
      callerRoles = (roleRows ?? []).map((r: any) => r.role)
      callerIsSuperadmin = callerRoles.includes('superadmin')
      callerIsAdmin = callerRoles.includes('admin')
      callerIsSupport = callerRoles.includes('support')
      callerIsTeacher = callerRoles.includes('teacher')
      if (!callerIsSuperadmin) {
        const { data: memb } = await supabase
          .from('organization_members').select('organization_id').eq('user_id', callerUserId)
        callerOrgMemberships = (memb ?? []).map((m: any) => m.organization_id)
      }
    }

    // Final resolved scope used by every "if (targetOrgId)" branch below.
    // - SuperAdmin: trust requestedOrgId verbatim (null = global view).
    // - Other roles: must be one of their memberships. If they sent something
    //   they don't own, reject. If they sent nothing and have exactly one org,
    //   auto-scope to it (preserves single-tenant convenience).
    let targetOrgId: string | null = null
    if (callerIsSuperadmin) {
      targetOrgId = requestedOrgId
    } else if (requestedOrgId) {
      if (!callerOrgMemberships.includes(requestedOrgId)) {
        return new Response(JSON.stringify({ error: 'Forbidden: organization not accessible' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      targetOrgId = requestedOrgId
    } else if (callerOrgMemberships.length === 1) {
      targetOrgId = callerOrgMemberships[0]
    }

    // Defense-in-depth: actions in this set are tenant-scoped data reads /
    // writes. A non-superadmin caller MUST end up with a resolved org scope —
    // either by passing target_org_id, or by being a single-org member.
    // Multi-org callers who didn't pick (frontend bug) get a 403 instead of
    // an unscoped result that could leak cross-org data.
    const ORG_SCOPED_ACTIONS = new Set<string>([
      'get_stats',
      'list_users', 'create_user',
      'list_leads', 'create_lead', 'update_lead', 'delete_lead',
      'approve_lead',
      'record_lead_payment',
      'list_enrollments',
      'list_schedules', 'create_schedule', 'update_schedule', 'delete_schedule', 'bulk_create_schedules',
      'list_attendance', 'save_attendance',
      'list_live_classes', 'create_live_class', 'update_live_class', 'delete_live_class',
      'list_materials', 'create_material', 'delete_material',
      'list_payments', 'create_payment', 'update_payment',
      'list_payroll', 'create_payroll', 'update_payroll',
      'list_notifications', 'create_notification',
      'list_courses', 'create_course', 'update_course', 'delete_course',
      'list_coupons', 'create_coupon', 'update_coupon', 'delete_coupon',
      'list_activity_logs',
      'list_active_sessions',
      'list_session_history',
      'get_support_overview',
      'list_course_modules', 'create_course_module', 'update_course_module', 'delete_course_module',
      'create_lesson', 'update_lesson', 'delete_lesson',
      'list_students_with_batches', 'list_all_students', 'list_teachers',
      'list_batches', 'create_batch', 'update_batch', 'delete_batch',
      'get_batch_detail',
      'list_batch_students', 'add_batch_student', 'remove_batch_student', 'batch_student_count',
      'revenue_analytics', 'org_performance', 'student_trends',
      'system_health',
      'list_practice_assignments', 'create_practice_assignment', 'update_practice_assignment', 'delete_practice_assignment',
      'list_student_submissions', 'review_student_submission',
    ])
    if (!callerIsSuperadmin && ORG_SCOPED_ACTIONS.has(action) && !targetOrgId) {
      return new Response(JSON.stringify({ error: 'Forbidden: no active organization scope' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let result: any = null

    // Try cache for read-only hot actions before doing any DB work.
    const cKey = READ_CACHEABLE_ACTIONS.has(action)
      ? cacheKey(action, callerUserId, targetOrgId, params)
      : null
    if (cKey) {
      const hit = readFromCache(cKey)
      if (hit !== undefined) {
        return new Response(JSON.stringify(hit), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        })
      }
    }

    switch (action) {
      // ===== STATS =====
      case 'get_stats': {
        const scope = <T extends any>(q: T): T => (targetOrgId ? (q as any).eq('organization_id', targetOrgId) : q)
        const [profiles, courses, batches, orgs, leads, payments] = await Promise.all([
          scope(supabase.from('profiles').select('id', { count: 'exact', head: true })),
          scope(supabase.from('courses').select('id', { count: 'exact', head: true })),
          scope(supabase.from('batches').select('id', { count: 'exact', head: true })),
          supabase.from('organizations').select('id', { count: 'exact', head: true }),
          scope(supabase.from('leads').select('id', { count: 'exact', head: true })),
          scope(supabase.from('payments').select('id', { count: 'exact', head: true })),
        ])
        const roleCounts: Record<string, number> = {}
        if (targetOrgId) {
          const { data: members } = await supabase
            .from('organization_members').select('user_id').eq('organization_id', targetOrgId)
          const memberIds = (members ?? []).map((m: any) => m.user_id)
          if (memberIds.length) {
            const { data: roles } = await supabase
              .from('user_roles').select('role').in('user_id', memberIds)
            for (const r of roles ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
          }
        } else {
          const roles = await supabase.from('user_roles').select('role')
          for (const r of roles.data ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
        }
        result = {
          totalUsers: profiles.count ?? 0,
          totalCourses: courses.count ?? 0,
          totalBatches: batches.count ?? 0,
          totalOrgs: orgs.count ?? 0,
          totalLeads: leads.count ?? 0,
          totalPayments: payments.count ?? 0,
          roleCounts,
        }
        break
      }

      // ===== USERS =====
      case 'list_users': {
        let profilesQ: any = supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (targetOrgId) profilesQ = profilesQ.eq('organization_id', targetOrgId)
        const { data: profiles } = await profilesQ
        const { data: roles } = await supabase.from('user_roles').select('user_id, role')
        const roleMap: Record<string, string> = {}
        for (const r of roles ?? []) roleMap[r.user_id] = r.role
        const { data: memberships } = await supabase.from('organization_members').select('user_id, organization_id')
        const orgMap: Record<string, string[]> = {}
        for (const m of memberships ?? []) {
          if (!orgMap[m.user_id]) orgMap[m.user_id] = []
          orgMap[m.user_id].push(m.organization_id)
        }
        result = (profiles ?? []).map((p: any) => ({
          ...p,
          role: roleMap[p.user_id] || 'student',
          organization_ids: orgMap[p.user_id] || [],
        }))
        break
      }
      case 'update_user': {
        const { user_id, display_name } = params
        const { error } = await supabase.from('profiles').update({ display_name }).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_user': {
        const { user_id } = params
        await supabase.from('profiles').delete().eq('user_id', user_id)
        await supabase.from('user_roles').delete().eq('user_id', user_id)
        result = { success: true }
        break
      }
      case 'change_role': {
        const { user_id, role } = params
        const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', user_id).maybeSingle()
        if (existing) {
          await supabase.from('user_roles').update({ role }).eq('user_id', user_id)
        } else {
          await supabase.from('user_roles').insert({ user_id, role })
        }
        result = { success: true }
        break
      }

      // ===== ORGANIZATIONS =====
      case 'list_organizations': {
        const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
        const { data: members } = await supabase.from('organization_members').select('organization_id')
        const countMap: Record<string, number> = {}
        for (const m of members ?? []) countMap[m.organization_id] = (countMap[m.organization_id] || 0) + 1
        result = (orgs ?? []).map((o: any) => ({ ...o, member_count: countMap[o.id] || 0 }))
        break
      }
      case 'create_organization': {
        const { name, slug } = params
        const { data, error } = await supabase.from('organizations').insert({ name, slug }).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_organization': {
        const { id } = params
        await supabase.from('organization_members').delete().eq('organization_id', id)
        const { error } = await supabase.from('organizations').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_org_members': {
        const { organization_id } = params
        const { data: members } = await supabase.from('organization_members').select('*').eq('organization_id', organization_id)
        const userIds = (members ?? []).map((m: any) => m.user_id)
        let profiles: any[] = []
        if (userIds.length > 0) {
          const { data } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
          profiles = data ?? []
        }
        const profileMap: Record<string, any> = {}
        for (const p of profiles) profileMap[p.user_id] = p
        result = (members ?? []).map((m: any) => ({ ...m, profile: profileMap[m.user_id] || null }))
        break
      }
      case 'add_org_member': {
        const { organization_id, user_id } = params
        const { error } = await supabase.from('organization_members').insert({ organization_id, user_id })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_org_member': {
        const { organization_id, user_id } = params
        const { error } = await supabase.from('organization_members').delete().eq('organization_id', organization_id).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'set_user_organizations': {
        // Replace the full set of org memberships for a user.
        const { user_id, organization_ids } = params as { user_id: string; organization_ids: string[] }
        if (!user_id || !Array.isArray(organization_ids)) {
          throw new Error('user_id and organization_ids[] are required')
        }
        const { data: current } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user_id)
        const currentIds = new Set((current ?? []).map((r: any) => r.organization_id))
        const nextIds = new Set(organization_ids)
        const toAdd = [...nextIds].filter((id) => !currentIds.has(id))
        const toRemove = [...currentIds].filter((id) => !nextIds.has(id))
        if (toRemove.length > 0) {
          const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('user_id', user_id)
            .in('organization_id', toRemove)
          if (error) throw error
        }
        if (toAdd.length > 0) {
          const rows = toAdd.map((organization_id) => ({ user_id, organization_id }))
          const { error } = await supabase.from('organization_members').insert(rows)
          if (error) throw error
        }
        result = { success: true, added: toAdd.length, removed: toRemove.length }
        break
      }

      // ===== LEADS =====
      case 'list_leads': {
        let q: any = supabase.from('leads').select('*').order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data } = await q
        result = data ?? []
        break
      }
      // Consolidated counts for Support dashboard. One round-trip instead of
      // three separate list_* fetches.
      case 'get_support_overview': {
        const leadsQ = supabase.from('leads').select('id', { count: 'exact', head: true })
        const paymentsQ = supabase.from('payments').select('id, status')
        let leadsCount = 0
        let enrollmentsCount = 0
        let openPayments = 0
        if (targetOrgId) {
          const [{ count: lc }, { data: ob }] = await Promise.all([
            leadsQ.eq('organization_id', targetOrgId),
            supabase.from('batches').select('id').eq('organization_id', targetOrgId),
          ])
          leadsCount = lc ?? 0
          const batchIds = (ob ?? []).map((b: any) => b.id)
          if (batchIds.length > 0) {
            const { count: ec } = await supabase
              .from('batch_students')
              .select('id', { count: 'exact', head: true })
              .in('batch_id', batchIds)
            enrollmentsCount = ec ?? 0
          }
          const { data: pays } = await paymentsQ
          openPayments = (pays ?? []).filter((p: any) => p.status === 'pending').length
        } else {
          const [{ count: lc }, { count: ec }, { data: pays }] = await Promise.all([
            leadsQ,
            supabase.from('batch_students').select('id', { count: 'exact', head: true }),
            paymentsQ,
          ])
          leadsCount = lc ?? 0
          enrollmentsCount = ec ?? 0
          openPayments = (pays ?? []).filter((p: any) => p.status === 'pending').length
        }
        result = { totalLeads: leadsCount, totalEnrollments: enrollmentsCount, openPayments }
        break
      }
      case 'create_lead': {
        const row = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('leads').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_lead': {
        const { id, ...updates } = params
        if (!callerIsSuperadmin) delete (updates as any).organization_id
        const { error } = await supabase.from('leads').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_lead': {
        const { error } = await supabase.from('leads').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== APPROVE LEAD: create student accounts + enroll into batches =====
      case 'approve_lead': {
        const { id } = params as { id: string }
        if (!id) throw new Error('id required')
        if (!callerIsSuperadmin && !callerIsAdmin) {
          throw new Error('Only admins can approve leads')
        }
        const { data: lead, error: leadErr } = await supabase
          .from('leads').select('*').eq('id', id).maybeSingle()
        if (leadErr) throw leadErr
        if (!lead) throw new Error('Lead not found')
        if (!callerIsSuperadmin && lead.organization_id && !callerOrgMemberships.includes(lead.organization_id)) {
          throw new Error('Forbidden: lead belongs to another organization')
        }
        const meta: any = lead.metadata ?? {}
        const students: any[] = Array.isArray(meta.students) ? meta.students : []
        if (students.length === 0) throw new Error('No student details on lead')
        const orgId = lead.organization_id ?? targetOrgId ?? null
        const created: any[] = []
        const enrolled: any[] = []
        const slugify = (s: string) => (s || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'student'
        const parentEmail: string | null = meta.parent_email ?? lead.email ?? null
        const emailDomain = parentEmail && parentEmail.includes('@') ? parentEmail.split('@')[1] : 'aurapen.app'
        const stamp = Date.now().toString(36)
        for (let idx = 0; idx < students.length; idx++) {
          const s = students[idx]
          if (!s?.name) continue
          const childEmail = `${slugify(s.name)}.${stamp}${idx}@${emailDomain}`
          // Random initial password the admin can reset.
          const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 12) + 'A1!'
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: childEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { display_name: s.name },
          })
          if (authError) {
            console.error('createUser failed', authError.message)
            continue
          }
          const newUserId = authData.user.id
          await supabase.from('profiles')
            .update({ display_name: s.name, organization_id: orgId })
            .eq('user_id', newUserId)
          // Ensure role = student (trigger already inserts 'student', but be safe)
          const { data: existingRole } = await supabase
            .from('user_roles').select('id').eq('user_id', newUserId).maybeSingle()
          if (!existingRole) {
            await supabase.from('user_roles').insert({ user_id: newUserId, role: 'student' })
          }
          if (orgId) {
            await supabase.from('organization_members')
              .insert({ organization_id: orgId, user_id: newUserId })
              .select().maybeSingle().then(() => {}, () => {})
          }
          // Link parent → child if we know the parent user id.
          if (meta.parent_user_id) {
            await supabase.from('parent_children').insert({
              parent_id: meta.parent_user_id, child_id: newUserId,
            }).then(() => {}, () => {})
          }
          // Enroll into batch
          if (s.batch_id) {
            const { error: enrollErr } = await supabase.from('batch_students').insert({
              batch_id: s.batch_id, student_id: newUserId,
            })
            if (!enrollErr) enrolled.push({ student_id: newUserId, batch_id: s.batch_id })
          }
          created.push({
            student_id: newUserId, name: s.name, email: childEmail,
            temp_password: tempPassword, batch_id: s.batch_id ?? null,
          })
        }
        await supabase.from('leads')
          .update({
            status: 'converted',
            metadata: { ...meta, approved_at: new Date().toISOString(), created_students: created },
          })
          .eq('id', id)
        result = { success: true, created_count: created.length, enrolled_count: enrolled.length, created }
        break
      }

      // ===== ENROLLMENTS =====
      case 'list_enrollments': {
        let scopedBatchIds: string[] | null = null
        if (targetOrgId) {
          const { data: ob } = await supabase.from('batches').select('id').eq('organization_id', targetOrgId)
          scopedBatchIds = (ob ?? []).map((b: any) => b.id)
          if (scopedBatchIds.length === 0) { result = []; break }
        }
        let enrollQ: any = supabase.from('batch_students').select('*').order('enrolled_at', { ascending: false })
        if (scopedBatchIds) enrollQ = enrollQ.in('batch_id', scopedBatchIds)
        const { data: enrollments } = await enrollQ
        const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))]
        const batchIds = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
        let profiles: any[] = []
        let batches: any[] = []
        if (studentIds.length) {
          const { data } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', studentIds)
          profiles = data ?? []
        }
        if (batchIds.length) {
          const { data } = await supabase.from('batches').select('id, name, course_id, courses(name)').in('id', batchIds)
          batches = data ?? []
        }
        const pMap: Record<string, any> = {}
        for (const p of profiles) pMap[p.user_id] = p
        const bMap: Record<string, any> = {}
        for (const b of batches) bMap[b.id] = b
        result = (enrollments ?? []).map((e: any) => ({
          ...e,
          student_profile: pMap[e.student_id] || null,
          batch: bMap[e.batch_id] || null,
        }))
        break
      }

      // ===== SCHEDULES =====
      case 'list_schedules': {
        let query: any = supabase.from('schedules').select('*, batches(name, courses(name))').order('day_of_week').order('start_time')
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        if (targetOrgId) query = query.eq('organization_id', targetOrgId)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_schedule': {
        const row = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('schedules').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_schedule': {
        const { id, ...updates } = params
        const { error } = await supabase.from('schedules').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_schedule': {
        const { error } = await supabase.from('schedules').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== ATTENDANCE =====
      case 'list_attendance': {
        let query: any = supabase.from('attendance').select('*').order('date', { ascending: false })
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        if (params?.date) query = query.eq('date', params.date)
        if (targetOrgId) query = query.eq('organization_id', targetOrgId)
        const { data } = await query
        // enrich with student names
        const sIds = [...new Set((data ?? []).map((a: any) => a.student_id))]
        let profs: any[] = []
        if (sIds.length) {
          const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((a: any) => ({ ...a, student_profile: pm[a.student_id] || null }))
        break
      }
      case 'save_attendance': {
        // params: { batch_id, date, records: [{ student_id, status }] }
        const { batch_id, date, records } = params
        if (!callerIsSuperadmin) {
          const { data: b } = await supabase.from('batches').select('organization_id').eq('id', batch_id).maybeSingle()
          if (!b || !b.organization_id || !callerOrgMemberships.includes(b.organization_id)) {
            return new Response(JSON.stringify({ error: 'Forbidden: batch outside your organization' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        // delete existing for this batch+date
        await supabase.from('attendance').delete().eq('batch_id', batch_id).eq('date', date)
        if (records.length > 0) {
          const rows = records.map((r: any) => ({ batch_id, date, student_id: r.student_id, status: r.status }))
          const { error } = await supabase.from('attendance').insert(rows)
          if (error) throw error
        }
        result = { success: true }
        break
      }

      // ===== LIVE CLASSES =====
      case 'list_live_classes': {
        let scopedBatchIds: string[] | null = null
        if (targetOrgId) {
          const { data: ob } = await supabase.from('batches').select('id').eq('organization_id', targetOrgId)
          scopedBatchIds = (ob ?? []).map((b: any) => b.id)
          if (scopedBatchIds.length === 0) { result = []; break }
        }
        let lcQ: any = supabase.from('live_classes').select('*, batches(name, teacher_id, organization_id, courses(name, total_hours, duration_days, delivery_mode)), schedules(date, start_time, end_time, title, room)').order('scheduled_at', { ascending: false })
        if (scopedBatchIds) lcQ = lcQ.in('batch_id', scopedBatchIds)
        const { data } = await lcQ
        result = data ?? []
        break
      }
      case 'create_live_class': {
        const { data, error } = await supabase.from('live_classes').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_live_class': {
        const { id, ...updates } = params
        const { error } = await supabase.from('live_classes').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_live_class': {
        const { error } = await supabase.from('live_classes').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== MATERIALS =====
      case 'list_materials': {
        let query: any = supabase.from('materials').select('*, courses(name)').order('created_at', { ascending: false })
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        if (targetOrgId) query = query.eq('organization_id', targetOrgId)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_material': {
        const row = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('materials').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_material': {
        const { error } = await supabase.from('materials').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== PAYMENTS =====
      case 'list_payments': {
        let q: any = supabase.from('payments').select('*').order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data } = await q
        const sIds = [...new Set((data ?? []).map((p: any) => p.student_id))]
        let profs: any[] = []
        if (sIds.length) {
          const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((p: any) => ({ ...p, student_profile: pm[p.student_id] || null }))
        break
      }
      case 'create_payment': {
        const row = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        if (!row.organization_id && row.student_id) {
          const { data: m } = await supabase
            .from('organization_members').select('organization_id')
            .eq('user_id', row.student_id).order('joined_at').limit(1).maybeSingle()
          if (m?.organization_id) row.organization_id = m.organization_id
        }
        const { data, error } = await supabase.from('payments').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_payment': {
        const { id, ...updates } = params
        const { error } = await supabase.from('payments').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== PAYROLL =====
      case 'list_payroll': {
        let q: any = supabase.from('payroll').select('*').order('year', { ascending: false }).order('month', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data } = await q
        const tIds = [...new Set((data ?? []).map((p: any) => p.teacher_id))]
        let profs: any[] = []
        if (tIds.length) {
          const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', tIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((p: any) => ({ ...p, teacher_profile: pm[p.teacher_id] || null }))
        break
      }
      case 'create_payroll': {
        const row = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('payroll').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_payroll': {
        const { id, ...updates } = params
        const { error } = await supabase.from('payroll').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== NOTIFICATIONS =====
      case 'list_notifications': {
        let q: any = supabase.from('notifications').select('*').order('created_at', { ascending: false })
        if (targetOrgId) {
          q = q.or(`organization_id.eq.${targetOrgId},target_org_id.eq.${targetOrgId}`)
        }
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_notification': {
        const row = { ...params }
        if (!row.organization_id && !row.target_org_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('notifications').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'mark_read': {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_notification': {
        const { error } = await supabase.from('notifications').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== BATCH STUDENTS (for students page) =====
      case 'list_students_with_batches':
      case 'list_all_students':
      case 'list_teachers': {
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const isSuperadmin = callerIsSuperadmin
        // Authoritative org scope: always use the upstream-resolved targetOrgId
        // (validated against the caller's memberships). Never fall back to
        // "first joined org" — that's exactly what was leaking other orgs.
        const callerOrgId: string | null = targetOrgId
        const applyOrgScope = !isSuperadmin || !!targetOrgId

        // Determine candidate user_ids based on role + org scope
        const wantTeachers = action === 'list_teachers'
        const targetRole = wantTeachers ? 'teacher' : 'student'

        // Base: all users with the target role
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', targetRole)
        let candidateIds = new Set<string>((roleRows ?? []).map((r: any) => r.user_id))

        if (applyOrgScope) {
          if (!callerOrgId) { result = []; break }

          if (wantTeachers) {
            // Teachers in org: members of the org + teachers assigned to any batch in the org
            const orgIds = new Set<string>()
            const { data: members } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', callerOrgId)
            for (const m of members ?? []) orgIds.add(m.user_id)
            const { data: orgBatches } = await supabase
              .from('batches')
              .select('teacher_id')
              .eq('organization_id', callerOrgId)
            for (const b of orgBatches ?? []) if (b.teacher_id) orgIds.add(b.teacher_id)
            candidateIds = new Set([...candidateIds].filter((id) => orgIds.has(id)))
          } else {
            // Students in org: anyone enrolled in any batch belonging to the org
            const { data: orgBatches } = await supabase
              .from('batches')
              .select('id')
              .eq('organization_id', callerOrgId)
            const batchIds = (orgBatches ?? []).map((b: any) => b.id)
            const orgStudentIds = new Set<string>()
            if (batchIds.length > 0) {
              const { data: enrollRows } = await supabase
                .from('batch_students')
                .select('student_id')
                .in('batch_id', batchIds)
              // batch_students.student_id stores auth user_id
              for (const r of enrollRows ?? []) orgStudentIds.add(r.student_id)
            }
            // Also include students who are explicit org members (e.g. created in org but not yet enrolled)
            const { data: members } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', callerOrgId)
            for (const m of members ?? []) {
              if (candidateIds.has(m.user_id)) orgStudentIds.add(m.user_id)
            }
            candidateIds = new Set([...candidateIds].filter((id) => orgStudentIds.has(id)))
          }
        }

        const ids = [...candidateIds]
        if (ids.length === 0) { result = []; break }

        if (action === 'list_teachers' || action === 'list_all_students') {
          // Optionally hide teachers already assigned to any batch in this org
          // (used by the "Assign Teacher" dialog so admins pick from free ones).
          if (action === 'list_teachers' && params?.exclude_assigned && callerOrgId) {
            const { data: assigned } = await supabase
              .from('batches')
              .select('teacher_id')
              .eq('organization_id', callerOrgId)
              .not('teacher_id', 'is', null)
            const assignedSet = new Set<string>((assigned ?? []).map((r: any) => r.teacher_id))
            // keep the teacher currently assigned to *this* batch (so the dialog
            // can pre-select / re-pick them); plus all unassigned teachers.
            let keepBatchTeacher: string | null = null
            if (params?.batch_id) {
              const { data: b } = await supabase
                .from('batches').select('teacher_id').eq('id', params.batch_id).maybeSingle()
              keepBatchTeacher = b?.teacher_id ?? null
            }
            const filtered = [...candidateIds].filter(
              (id) => !assignedSet.has(id) || id === keepBatchTeacher
            )
            candidateIds = new Set(filtered)
          }
          const finalIds = [...candidateIds]
          if (finalIds.length === 0) { result = []; break }
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, user_id, display_name, email')
            .in('user_id', finalIds)
          result = profiles ?? []
          break
        }

        // list_students_with_batches
        const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', ids)
        const { data: enrollments } = await supabase
          .from('batch_students')
          .select('student_id, batch_id, batches(name, organization_id, courses(name))')
          .in('student_id', ids)
        const enrollMap: Record<string, any[]> = {}
        for (const e of enrollments ?? []) {
          // Restrict enrollments to the scoped org (admin's org, or SuperAdmin's picked org)
          if (applyOrgScope && callerOrgId && e.batches?.organization_id !== callerOrgId) continue
          if (!enrollMap[e.student_id]) enrollMap[e.student_id] = []
          enrollMap[e.student_id].push(e)
        }
        result = (profiles ?? []).map((p: any) => ({ ...p, enrollments: enrollMap[p.user_id] || [] }))
        break
      }

      // ===== COURSES =====
      case 'list_courses': {
        let q: any = supabase.from('courses').select('*').order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_course': {
        const { name, description, created_by, grade_level, duration_days, total_hours, daily_hours, language, writing_style, includes_speed, fee, delivery_mode, center, organization_id } = params
        const { data, error } = await supabase.from('courses').insert({
          name, description, created_by,
          grade_level: grade_level || null,
          duration_days: duration_days || null,
          total_hours: total_hours || null,
          daily_hours: daily_hours || null,
          language: language || null,
          writing_style: writing_style || null,
          includes_speed: includes_speed || false,
          fee: fee ?? 0,
          delivery_mode: delivery_mode || 'online',
          center: center || null,
          organization_id: organization_id || targetOrgId || null,
        }).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_course': {
        const { id, ...updates } = params
        const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_course': {
        const { error } = await supabase.from('courses').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== BATCHES =====
      case 'list_batches': {
        let query = supabase.from('batches').select('*, courses(name, duration_days, daily_hours, total_hours, delivery_mode)')
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        if (targetOrgId) query = query.eq('organization_id', targetOrgId)
        // Teachers (without admin/support/superadmin) only see batches they own.
        if (callerIsTeacher && !callerIsSuperadmin && !callerIsAdmin && !callerIsSupport && callerUserId) {
          query = query.eq('teacher_id', callerUserId)
        }
        const { data } = await query.order('created_at', { ascending: false })
        const batches = data ?? []
        const batchIds = batches.map((b: any) => b.id)
        const teacherIds = Array.from(new Set(batches.map((b: any) => b.teacher_id).filter(Boolean)))

        // Enrolled counts per batch
        const counts: Record<string, number> = {}
        if (batchIds.length) {
          const { data: bs } = await supabase
            .from('batch_students')
            .select('batch_id')
            .in('batch_id', batchIds)
          for (const row of bs ?? []) {
            counts[row.batch_id] = (counts[row.batch_id] ?? 0) + 1
          }
        }

        // Teacher names
        const teacherMap: Record<string, string> = {}
        if (teacherIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, display_name, email')
            .in('user_id', teacherIds)
          for (const p of profs ?? []) {
            teacherMap[p.user_id] = p.display_name || p.email || ''
          }
        }

        // Sessions per batch: total / completed / next upcoming
        const sessionStats: Record<string, { total: number; completed: number; next: any | null }> = {}
        if (batchIds.length) {
          const { data: lcs } = await supabase
            .from('live_classes')
            .select('id, batch_id, title, scheduled_at, duration_minutes, status')
            .in('batch_id', batchIds)
            .order('scheduled_at', { ascending: true })
          const now = Date.now()
          for (const id of batchIds) sessionStats[id] = { total: 0, completed: 0, next: null }
          for (const s of lcs ?? []) {
            const st = sessionStats[s.batch_id]
            if (!st) continue
            st.total++
            if (s.status === 'completed') st.completed++
            if (!st.next && s.status !== 'completed' && s.status !== 'cancelled' && new Date(s.scheduled_at).getTime() >= now) {
              st.next = { id: s.id, title: s.title, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes, status: s.status }
            }
          }
        }

        result = batches.map((b: any) => {
          const st = sessionStats[b.id] ?? { total: 0, completed: 0, next: null }
          const totalHours = b.courses?.total_hours ?? null
          const hoursCompleted = st.total ? +((st.completed / st.total) * (totalHours ?? 0)).toFixed(1) : 0
          const progress_pct = totalHours && totalHours > 0
            ? Math.min(100, Math.round((hoursCompleted / totalHours) * 100))
            : (st.total ? Math.round((st.completed / st.total) * 100) : 0)
          return {
            ...b,
            enrolled_count: counts[b.id] ?? 0,
            teacher_name: b.teacher_id ? (teacherMap[b.teacher_id] ?? null) : null,
            sessions_total: st.total,
            sessions_completed: st.completed,
            next_session: st.next,
            hours_completed: hoursCompleted,
            hours_total: totalHours,
            progress_pct,
          }
        })
        break
      }
      case 'create_batch': {
        const { course_id, name, max_students, organization_id } = params
        const orgIdForInsert = organization_id || targetOrgId || null
        const insertRow: any = { course_id, name, max_students: max_students ?? 25 }
        if (orgIdForInsert) insertRow.organization_id = orgIdForInsert
        const { data, error } = await supabase.from('batches').insert(insertRow).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_batch': {
        const { id, ...updates } = params
        const { error } = await supabase.from('batches').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_batch': {
        await supabase.from('batch_students').delete().eq('batch_id', params.id)
        const { error } = await supabase.from('batches').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'get_batch_detail': {
        const { id } = params
        if (!id) throw new Error('batch id required')
        const { data: batch, error: bErr } = await supabase
          .from('batches')
          .select('*, courses(*)')
          .eq('id', id)
          .maybeSingle()
        if (bErr) throw bErr
        if (!batch) throw new Error('Batch not found')
        if (targetOrgId && batch.organization_id !== targetOrgId) {
          throw new Error('Batch is outside your organization')
        }
        // Teachers can only view their own batches via admin-query
        if (callerIsTeacher && !callerIsSuperadmin && !callerIsAdmin && !callerIsSupport) {
          if (batch.teacher_id !== callerUserId) {
            throw new Error('You are not assigned to this batch')
          }
        }

        // Teacher profile
        let teacher: any = null
        if (batch.teacher_id) {
          const { data: t } = await supabase
            .from('profiles')
            .select('user_id, display_name, email, avatar_url')
            .eq('user_id', batch.teacher_id)
            .maybeSingle()
          teacher = t || null
        }

        // Enrolled students + progress
        const { data: enrollRows } = await supabase
          .from('batch_students')
          .select('student_id, enrolled_at')
          .eq('batch_id', id)
        const studentIds = (enrollRows ?? []).map((r: any) => r.student_id)
        let studentProfiles: any[] = []
        let progressRows: any[] = []
        if (studentIds.length) {
          const [{ data: profs }, { data: progs }] = await Promise.all([
            supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', studentIds),
            supabase.from('student_progress').select('student_id, completion_pct, sessions_attended, total_sessions').eq('batch_id', id),
          ])
          studentProfiles = profs ?? []
          progressRows = progs ?? []
        }
        const profMap: Record<string, any> = {}
        for (const p of studentProfiles) profMap[p.user_id] = p
        const progMap: Record<string, any> = {}
        for (const p of progressRows) progMap[p.student_id] = p
        const students = (enrollRows ?? []).map((r: any) => ({
          student_id: r.student_id,
          enrolled_at: r.enrolled_at,
          display_name: profMap[r.student_id]?.display_name || null,
          email: profMap[r.student_id]?.email || null,
          avatar_url: profMap[r.student_id]?.avatar_url || null,
          completion_pct: progMap[r.student_id]?.completion_pct ?? 0,
        }))

        // Sessions (live_classes) ordered by date
        const { data: sessions } = await supabase
          .from('live_classes')
          .select('id, title, scheduled_at, duration_minutes, status, meeting_url, schedule_id')
          .eq('batch_id', id)
          .order('scheduled_at', { ascending: true })

        const sList = sessions ?? []
        const completedMinutes = sList
          .filter((s: any) => s.status === 'completed')
          .reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0)
        const totalHours = batch.courses?.total_hours ?? null
        const hoursCompleted = +(completedMinutes / 60).toFixed(1)
        const hoursPending = totalHours != null ? Math.max(0, +(totalHours - hoursCompleted).toFixed(1)) : null

        result = {
          batch,
          teacher,
          students,
          student_count: students.length,
          sessions: sList,
          progress: {
            total_hours: totalHours,
            hours_completed: hoursCompleted,
            hours_pending: hoursPending,
            sessions_total: sList.length,
            sessions_completed: sList.filter((s: any) => s.status === 'completed').length,
            sessions_live: sList.filter((s: any) => s.status === 'live').length,
            sessions_upcoming: sList.filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date()).length,
            sessions_cancelled: sList.filter((s: any) => s.status === 'cancelled').length,
          },
        }
        break
      }
      case 'list_batch_students': {
        const { data } = await supabase.from('batch_students').select('*').eq('batch_id', params.batch_id)
        const sIds = (data ?? []).map((d: any) => d.student_id)
        let profs: any[] = []
        if (sIds.length) {
          // batch_students.student_id stores the auth user_id
          const { data: p } = await supabase.from('profiles').select('id, user_id, display_name, email').in('user_id', sIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((d: any) => ({ ...d, profile: pm[d.student_id] || null }))
        break
      }
      case 'add_batch_student': {
        // Enforce max_students seat limit
        if (!params?.batch_id || !params?.student_id) {
          throw new Error('batch_id and student_id are required')
        }
        // Accept either profiles.user_id or profiles.id; ALWAYS persist user_id
        // (auth uid) — that's what every student-side RLS policy filters on.
        let { data: studentProfile } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('user_id', params.student_id)
          .maybeSingle()
        if (!studentProfile) {
          const { data: byProfileId } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('id', params.student_id)
            .maybeSingle()
          studentProfile = byProfileId
        }
        if (!studentProfile) throw new Error('Student profile not found')
        const studentUserId = studentProfile.user_id

        const { data: batchInfo } = await supabase
          .from('batches')
          .select('max_students, organization_id')
          .eq('id', params.batch_id)
          .maybeSingle()
        if (!batchInfo) throw new Error('Batch not found')
        // Org scope check (non-superadmin only)
        if (!callerIsSuperadmin && targetOrgId && batchInfo.organization_id !== targetOrgId) {
          throw new Error('Batch is outside your organization')
        }
        const { data: member } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', batchInfo.organization_id)
          .eq('user_id', studentProfile.user_id)
          .maybeSingle()
        if (!member) throw new Error('Student is not assigned to this organization')
        const { count: currentCount } = await supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id)
        if ((currentCount ?? 0) >= batchInfo.max_students) {
          throw new Error(`Batch is full (${batchInfo.max_students}/${batchInfo.max_students} seats taken)`)
        }
        // Prevent duplicate enrollment with a friendly message
        const { data: existing } = await supabase
          .from('batch_students')
          .select('id')
          .eq('batch_id', params.batch_id)
          .eq('student_id', studentUserId)
          .maybeSingle()
        if (existing) throw new Error('Student is already enrolled in this batch')
        const { error } = await supabase
          .from('batch_students')
          .insert({ batch_id: params.batch_id, student_id: studentUserId })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_batch_student': {
        // Accept either user_id or profile.id — normalize to user_id
        let sid = params.student_id
        const { data: byUser } = await supabase
          .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
        if (!byUser) {
          const { data: byProf } = await supabase
            .from('profiles').select('user_id').eq('id', sid).maybeSingle()
          if (byProf?.user_id) sid = byProf.user_id
        }
        const { error } = await supabase.from('batch_students').delete().eq('batch_id', params.batch_id).eq('student_id', sid)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'batch_student_count': {
        const { count, error } = await supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id)
        if (error) throw error
        result = count ?? 0
        break
      }
      // (duplicate ungated handlers for list_teachers / list_all_students
      // were removed — they bypassed org scoping and are now consolidated in
      // the combined handler above.)

      // ===== BULK SCHEDULES =====
      case 'bulk_create_schedules': {
        const { entries } = params
        if (!entries?.length) throw new Error('No schedule entries provided')
        const { error } = await supabase.from('schedules').insert(entries)
        if (error) throw error
        result = { success: true, count: entries.length }
        break
      }

      // ===== TOGGLE ORG ACTIVE =====
      case 'toggle_org_active': {
        const { id, is_active } = params
        const { error } = await supabase.from('organizations').update({ is_active }).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== DEACTIVATE / REACTIVATE USER =====
      case 'toggle_user_active': {
        const { user_id, is_active } = params
        const { error } = await supabase.from('profiles').update({ is_active }).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== CREATE USER (admin) =====
      case 'create_user': {
        const { email, password, display_name, role } = params
        // Auto-map to caller's active org when not explicitly provided.
        // SuperAdmins acting globally (no targetOrgId) skip auto-mapping.
        const organization_id = params.organization_id ?? targetOrgId ?? null
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name },
        })
        if (authError) throw authError
        const newUserId = authData.user.id
        // Profile is created by trigger, update display_name
        await supabase.from('profiles').update({ display_name, organization_id }).eq('user_id', newUserId)
        // Set role
        if (role && role !== 'student') {
          await supabase.from('user_roles').update({ role }).eq('user_id', newUserId)
        }
        // Add to org if specified
        if (organization_id) {
          await supabase.from('organization_members').insert({ organization_id, user_id: newUserId })
        }
        result = { success: true, user_id: newUserId }
        break
      }

      // ===== ADMIN PASSWORD RESET =====
      case 'admin_reset_password': {
        const { user_id, new_password } = params
        if (!user_id || !new_password) throw new Error('user_id and new_password are required')
        if (new_password.length < 8) throw new Error('Password must be at least 8 characters')
        const { error: resetError } = await supabase.auth.admin.updateUserById(user_id, {
          password: new_password,
        })
        if (resetError) throw resetError
        result = { success: true }
        break
      }

      // ===== SUBSCRIPTION PLANS =====
      case 'list_subscription_plans': {
        const { data } = await supabase.from('subscription_plans').select('*').order('price')
        result = data ?? []
        break
      }
      case 'create_subscription_plan': {
        const { data, error } = await supabase.from('subscription_plans').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_subscription_plan': {
        const { id, ...updates } = params
        const { error } = await supabase.from('subscription_plans').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_subscription_plan': {
        const { error } = await supabase.from('subscription_plans').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== ORG SUBSCRIPTIONS =====
      case 'list_org_subscriptions': {
        const { data } = await supabase.from('org_subscriptions').select('*, organizations(name), subscription_plans(name, price, billing_cycle)').order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'assign_org_subscription': {
        const { organization_id, plan_id, expires_at } = params
        // upsert
        const { data: existing } = await supabase.from('org_subscriptions').select('id').eq('organization_id', organization_id).maybeSingle()
        if (existing) {
          const { error } = await supabase.from('org_subscriptions').update({ plan_id, status: 'active', starts_at: new Date().toISOString(), expires_at: expires_at || null }).eq('organization_id', organization_id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('org_subscriptions').insert({ organization_id, plan_id, expires_at: expires_at || null })
          if (error) throw error
        }
        result = { success: true }
        break
      }
      case 'cancel_org_subscription': {
        const { error } = await supabase.from('org_subscriptions').update({ status: 'cancelled' }).eq('organization_id', params.organization_id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== COUPONS =====
      case 'list_coupons': {
        let q: any = supabase.from('coupons').select('*').order('created_at', { ascending: false })
        if (targetOrgId) {
          q = q.or(`organization_id.is.null,organization_id.eq.${targetOrgId}`)
        }
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_coupon': {
        const row = { ...params }
        if (row.organization_id === undefined && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase.from('coupons').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_coupon': {
        const { id, ...updates } = params
        const { error } = await supabase.from('coupons').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_coupon': {
        const { error } = await supabase.from('coupons').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== WHITE-LABEL BRANDING =====
      case 'update_org_branding': {
        const { id, branding } = params
        // Mirror the branding logo into the dedicated logo_url column so listing
        // endpoints and white-label headers can rely on a single source.
        const updates: Record<string, unknown> = { branding }
        if (branding && typeof branding === 'object' && 'logo_url' in branding) {
          updates.logo_url = (branding as any).logo_url || null
        }
        const { error } = await supabase.from('organizations').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== CURRICULUM (MODULES & LESSONS) =====
      case 'list_course_modules': {
        if (!callerIsSuperadmin && targetOrgId && params.course_id) {
          const { data: c } = await supabase.from('courses').select('organization_id').eq('id', params.course_id).maybeSingle()
          if (!c || c.organization_id !== targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: course outside your organization' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { data } = await supabase.from('course_modules').select('*, lessons(*)').eq('course_id', params.course_id).order('sort_order')
        for (const m of data ?? []) {
          if (m.lessons) m.lessons.sort((a: any, b: any) => a.sort_order - b.sort_order)
        }
        result = data ?? []
        break
      }
      case 'create_course_module': {
        const { data, error } = await supabase.from('course_modules').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_course_module': {
        const { id, ...updates } = params
        const { error } = await supabase.from('course_modules').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_course_module': {
        const { error } = await supabase.from('course_modules').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'create_lesson': {
        const { data, error } = await supabase.from('lessons').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_lesson': {
        const { id, ...updates } = params
        const { error } = await supabase.from('lessons').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_lesson': {
        const { error } = await supabase.from('lessons').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== ACTIVITY LOGS (extended) =====
      case 'list_activity_logs': {
        let scopedUserIds: string[] | null = null
        if (targetOrgId) {
          const { data: members } = await supabase
            .from('organization_members').select('user_id').eq('organization_id', targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { activity_logs: [], login_attempts: [] }; break }
        }
        // Show all activity rows. System/trigger rows have user_id = null and are surfaced as "System".
        let actQ: any = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500)
        if (scopedUserIds) actQ = actQ.or(`user_id.in.(${scopedUserIds.join(',')}),user_id.is.null`)
        const [activityRes, loginRes] = await Promise.all([
          actQ,
          (callerIsSuperadmin || !targetOrgId)
            ? supabase.from('login_attempts').select('*').order('attempted_at', { ascending: false }).limit(200)
            : Promise.resolve({ data: [] as any[] }),
        ])
        const userIds = [...new Set((activityRes.data ?? []).map((a: any) => a.user_id).filter(Boolean))]
        let profileMap: Record<string, { name: string; email: string }> = {}
        if (userIds.length) {
          const { data: profs } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
          for (const p of profs ?? []) profileMap[p.user_id] = { name: p.display_name || p.email || 'Unknown', email: p.email || '—' }
        }
        const enrichedLogs = (activityRes.data ?? []).map((a: any) => ({
          ...a,
          user_name: a.user_id ? (profileMap[a.user_id]?.name || 'Unknown') : 'System',
          user_email: a.user_id ? (profileMap[a.user_id]?.email || '—') : '—',
        }))
        result = { activity_logs: enrichedLogs, login_attempts: loginRes.data ?? [] }
        break
      }

      // ===== ACTIVE SESSIONS =====
      case 'list_active_sessions': {
        const sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        let scopedUserIds: string[] | null = null
        if (targetOrgId) {
          const { data: members } = await supabase
            .from('organization_members').select('user_id').eq('organization_id', targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { sessions: [] }; break }
        }
        let q: any = supabase.from('user_sessions')
          .select('*')
          .is('ended_at', null)
          .gt('last_seen_at', sinceIso)
          .order('last_seen_at', { ascending: false })
          .limit(200)
        if (scopedUserIds) q = q.in('user_id', scopedUserIds)
        const { data: sessions } = await q
        const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id))]
        let profileMap: Record<string, any> = {}
        let roleMap: Record<string, string> = {}
        if (userIds.length) {
          const [{ data: profs }, { data: roles }] = await Promise.all([
            supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', userIds),
            supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
          ])
          for (const p of profs ?? []) profileMap[p.user_id] = p
          for (const r of roles ?? []) roleMap[r.user_id] = r.role
        }
        result = {
          sessions: (sessions ?? []).map((s: any) => ({
            ...s,
            user_name: profileMap[s.user_id]?.display_name || profileMap[s.user_id]?.email || 'Unknown',
            user_email: profileMap[s.user_id]?.email || '—',
            avatar_url: profileMap[s.user_id]?.avatar_url || null,
            role: roleMap[s.user_id] || null,
          })),
        }
        break
      }

      // ===== SESSION HISTORY =====
      case 'list_session_history': {
        const limit = Math.min(Number(params?.limit) || 100, 500)
        let scopedUserIds: string[] | null = null
        if (targetOrgId) {
          const { data: members } = await supabase
            .from('organization_members').select('user_id').eq('organization_id', targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { sessions: [] }; break }
        }
        let q: any = supabase.from('user_sessions').select('*')
          .order('started_at', { ascending: false }).limit(limit)
        if (params?.user_id) q = q.eq('user_id', params.user_id)
        if (scopedUserIds) q = q.in('user_id', scopedUserIds)
        const { data: sessions } = await q
        const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id))]
        let profileMap: Record<string, any> = {}
        let roleMap: Record<string, string> = {}
        if (userIds.length) {
          const [{ data: profs }, { data: roles }] = await Promise.all([
            supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds),
            supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
          ])
          for (const p of profs ?? []) profileMap[p.user_id] = p
          for (const r of roles ?? []) roleMap[r.user_id] = r.role
        }
        result = {
          sessions: (sessions ?? []).map((s: any) => ({
            ...s,
            user_name: profileMap[s.user_id]?.display_name || profileMap[s.user_id]?.email || 'Unknown',
            user_email: profileMap[s.user_id]?.email || '—',
            role: roleMap[s.user_id] || null,
          })),
        }
        break
      }

      // ===== SYSTEM MONITORING =====
      case 'system_health': {
        const orgFilter = (q: any) => (targetOrgId ? q.eq('organization_id', targetOrgId) : q)
        const [
          usersRes, coursesRes, batchesRes, orgsRes, paymentsRes, leadsRes,
          rolesRes, logsRes, loginsRes, subsRes, couponsRes, modulesRes, lessonsRes
        ] = await Promise.all([
          orgFilter(supabase.from('profiles').select('id', { count: 'exact', head: true })),
          orgFilter(supabase.from('courses').select('id', { count: 'exact', head: true })),
          orgFilter(supabase.from('batches').select('id', { count: 'exact', head: true })),
          supabase.from('organizations').select('id, is_active', { count: 'exact' }),
          orgFilter(supabase.from('payments').select('id, amount, status', { count: 'exact' })),
          orgFilter(supabase.from('leads').select('id', { count: 'exact', head: true })),
          supabase.from('user_roles').select('role'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }),
          callerIsSuperadmin
            ? supabase.from('login_attempts').select('id, success, attempted_at').order('attempted_at', { ascending: false }).limit(100)
            : Promise.resolve({ data: [] as any[], count: 0 }),
          targetOrgId
            ? supabase.from('org_subscriptions').select('id, status', { count: 'exact' }).eq('organization_id', targetOrgId)
            : supabase.from('org_subscriptions').select('id, status', { count: 'exact' }),
          orgFilter(supabase.from('coupons').select('id, is_active', { count: 'exact' })),
          supabase.from('course_modules').select('id', { count: 'exact', head: true }),
          supabase.from('lessons').select('id', { count: 'exact', head: true }),
        ])

        // Role distribution
        const roleCounts: Record<string, number> = {}
        for (const r of rolesRes.data ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1

        // Active vs inactive orgs
        const activeOrgs = (orgsRes.data ?? []).filter((o: any) => o.is_active).length
        const inactiveOrgs = (orgsRes.data ?? []).filter((o: any) => !o.is_active).length

        // Payment totals
        const completedPayments = (paymentsRes.data ?? []).filter((p: any) => p.status === 'completed')
        const totalRevenue = completedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
        const pendingPayments = (paymentsRes.data ?? []).filter((p: any) => p.status === 'pending').length

        // Login success rate (last 100)
        const logins = loginsRes.data ?? []
        const successLogins = logins.filter((l: any) => l.success).length
        const failedLogins = logins.filter((l: any) => !l.success).length

        // Active subscriptions
        const activeSubs = (subsRes.data ?? []).filter((s: any) => s.status === 'active').length
        const activeCoupons = (couponsRes.data ?? []).filter((c: any) => c.is_active).length

        result = {
          counts: {
            users: usersRes.count ?? 0,
            courses: coursesRes.count ?? 0,
            batches: batchesRes.count ?? 0,
            organizations: orgsRes.count ?? 0,
            leads: leadsRes.count ?? 0,
            payments: paymentsRes.count ?? 0,
            activityLogs: logsRes.count ?? 0,
            modules: modulesRes.count ?? 0,
            lessons: lessonsRes.count ?? 0,
          },
          roleCounts,
          orgHealth: { active: activeOrgs, inactive: inactiveOrgs },
          revenue: { total: totalRevenue, pendingCount: pendingPayments },
          loginHealth: { total: logins.length, success: successLogins, failed: failedLogins },
          subscriptions: { active: activeSubs, total: subsRes.count ?? 0 },
          coupons: { active: activeCoupons, total: couponsRes.count ?? 0 },
          timestamp: new Date().toISOString(),
        }
        break
      }

      // ===== REPORTS / ANALYTICS =====
      case 'revenue_analytics': {
        const orgFilter = (q: any) => (targetOrgId ? q.eq('organization_id', targetOrgId) : q)
        const since = new Date()
        since.setMonth(since.getMonth() - 11)
        since.setDate(1)
        const { data: payments } = await orgFilter(
          supabase.from('payments').select('amount, status, created_at').gte('created_at', since.toISOString())
        )
        const rows = payments ?? []
        const completed = rows.filter((p: any) => p.status === 'completed')
        const pending = rows.filter((p: any) => p.status === 'pending')
        const monthlyRevenue: Record<string, number> = {}
        // Seed last 12 months with 0
        for (let i = 0; i < 12; i++) {
          const d = new Date(since)
          d.setMonth(since.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthlyRevenue[key] = 0
        }
        for (const p of completed) {
          const d = new Date(p.created_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthlyRevenue) monthlyRevenue[key] += Number(p.amount) || 0
        }
        result = {
          totalRevenue: completed.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
          totalTransactions: completed.length,
          pendingRevenue: pending.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
          monthlyRevenue,
        }
        break
      }

      case 'org_performance': {
        // SuperAdmin sees all orgs; tenant-scoped users see only their active org.
        let orgQuery = supabase.from('organizations').select('id, name, is_active')
        if (targetOrgId) orgQuery = orgQuery.eq('id', targetOrgId)
        const { data: orgs } = await orgQuery
        const list = orgs ?? []
        const out: any[] = []
        for (const o of list) {
          const [membersR, coursesR, batchesR, paymentsR] = await Promise.all([
            supabase.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', o.id),
            supabase.from('courses').select('id', { count: 'exact', head: true }).eq('organization_id', o.id),
            supabase.from('batches').select('id', { count: 'exact', head: true }).eq('organization_id', o.id),
            supabase.from('payments').select('amount, status').eq('organization_id', o.id),
          ])
          const revenue = (paymentsR.data ?? [])
            .filter((p: any) => p.status === 'completed')
            .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          out.push({
            id: o.id,
            name: o.name,
            is_active: o.is_active,
            members: membersR.count ?? 0,
            courses: coursesR.count ?? 0,
            batches: batchesR.count ?? 0,
            revenue,
          })
        }
        result = out
        break
      }

      case 'student_trends': {
        const orgFilter = (q: any) => (targetOrgId ? q.eq('organization_id', targetOrgId) : q)
        const since = new Date()
        since.setMonth(since.getMonth() - 5)
        since.setDate(1)
        const sinceDate = since.toISOString().slice(0, 10)
        const { data: attendance } = await orgFilter(
          supabase.from('attendance').select('status, date').gte('date', sinceDate)
        )
        const monthlyAttendance: Record<string, { present: number; total: number }> = {}
        for (let i = 0; i < 6; i++) {
          const d = new Date(since)
          d.setMonth(since.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthlyAttendance[key] = { present: 0, total: 0 }
        }
        for (const a of attendance ?? []) {
          const d = new Date(a.date)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (!(key in monthlyAttendance)) continue
          monthlyAttendance[key].total += 1
          if (a.status === 'present') monthlyAttendance[key].present += 1
        }
        const { data: progress } = await orgFilter(
          supabase.from('student_progress').select('status, completion_pct')
        )
        const prows = progress ?? []
        const total = prows.length
        const completed = prows.filter((p: any) => p.status === 'completed').length
        const inProgress = prows.filter((p: any) => p.status !== 'completed').length
        const avgCompletion = total > 0
          ? prows.reduce((s: number, p: any) => s + Number(p.completion_pct || 0), 0) / total
          : 0
        result = {
          monthlyAttendance,
          progressSummary: { total, completed, inProgress, avgCompletion },
        }
        break
      }

      // ===== PARENT-CHILD LINKS =====
      case 'list_parent_children': {
        const { parent_id } = params
        let query = supabase.from('parent_children').select('*')
        if (parent_id) query = query.eq('parent_id', parent_id)
        const { data } = await query.order('created_at', { ascending: false })
        // enrich with profiles
        const parentIds = [...new Set((data ?? []).map((d: any) => d.parent_id))]
        const childIds = [...new Set((data ?? []).map((d: any) => d.child_id))]
        const allIds = [...new Set([...parentIds, ...childIds])]
        let profiles: any[] = []
        if (allIds.length) {
          const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', allIds)
          profiles = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profiles) pm[p.user_id] = p
        result = (data ?? []).map((d: any) => ({
          ...d,
          parent_profile: pm[d.parent_id] || null,
          child_profile: pm[d.child_id] || null,
        }))
        break
      }
      case 'add_parent_child': {
        const { parent_id, child_id } = params
        const { error } = await supabase.from('parent_children').insert({ parent_id, child_id })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_parent_child': {
        const { id } = params
        const { error } = await supabase.from('parent_children').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_parents': {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'parent')
        if (!roles?.length) { result = []; break }
        const ids = roles.map((r: any) => r.user_id)
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', ids)
        result = profiles ?? []
        break
      }

      // ===== PUBLIC: CHECK EMAIL EXISTS (for forgot password) =====
      case 'check_email_exists': {
        const { email } = params
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (error) throw error
        result = { exists: !!data }
        break
      }

      // ===== BATCHES (admin-aware, service role bypasses RLS but enforces org scoping in code) =====
      case 'list_batches':
      case 'create_batch':
      case 'update_batch':
      case 'delete_batch':
      case 'list_batch_students':
      case 'add_batch_student':
      case 'remove_batch_student':
      case 'batch_student_count': {
        // Resolve caller from JWT
        const authHeader = req.headers.get('Authorization') || ''
        const jwt = authHeader.replace('Bearer ', '').trim()
        let callerId: string | null = null
        if (jwt) {
          const { data: userData } = await supabase.auth.getUser(jwt)
          callerId = userData?.user?.id ?? null
        }
        if (!callerId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', callerId)
        const roleSet = new Set((rolesData ?? []).map((r: any) => r.role))
        const isSuperadmin = roleSet.has('superadmin')
        const isAdmin = roleSet.has('admin')
        if (!isSuperadmin && !isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Resolve admin's org (first org membership). Null for superadmin (no scoping).
        let callerOrgId: string | null = null
        if (!isSuperadmin) {
          const { data: memberRow } = await supabase
            .from('organization_members')
            .select('organization_id, joined_at')
            .eq('user_id', callerId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          callerOrgId = memberRow?.organization_id ?? null
        }

        // Helper: ensure a batch belongs to the admin's org
        const assertBatchInScope = async (batchId: string) => {
          if (isSuperadmin) return true
          if (!callerOrgId) throw new Error('Admin is not assigned to any organization')
          const { data: b } = await supabase
            .from('batches')
            .select('organization_id')
            .eq('id', batchId)
            .maybeSingle()
          if (!b) throw new Error('Batch not found')
          if (b.organization_id !== callerOrgId) throw new Error('Batch is outside your organization')
          return true
        }

        if (action === 'list_batches') {
          let q = supabase
            .from('batches')
            .select('*, courses(name, duration_days, daily_hours, total_hours)')
            .order('created_at', { ascending: false }) as any
          if (params?.course_id) q = q.eq('course_id', params.course_id)
          if (!isSuperadmin) {
            if (!callerOrgId) { result = []; break }
            q = q.eq('organization_id', callerOrgId)
          }
          const { data, error } = await q
          if (error) throw error
          result = data ?? []
          break
        }

        if (action === 'create_batch') {
          const { course_id, name, max_students } = params
          let organization_id = params?.organization_id ?? null
          if (!isSuperadmin) {
            if (!callerOrgId) throw new Error('Admin is not assigned to any organization')
            organization_id = callerOrgId
          } else if (!organization_id) {
            // Superadmin creating without org: inherit from course
            const { data: course } = await supabase
              .from('courses')
              .select('organization_id')
              .eq('id', course_id)
              .maybeSingle()
            organization_id = course?.organization_id ?? null
          }
          const { data, error } = await supabase
            .from('batches')
            .insert({ course_id, name, max_students: max_students ?? 25, organization_id })
            .select()
            .single()
          if (error) throw error
          result = data
          break
        }

        if (action === 'update_batch') {
          const { id, ...updates } = params
          await assertBatchInScope(id)
          // Prevent admins from re-homing a batch to another org
          if (!isSuperadmin) delete (updates as any).organization_id
          // Capture previous teacher to detect reassignment
          let previousTeacherId: string | null = null
          let batchName = ''
          if (Object.prototype.hasOwnProperty.call(updates, 'teacher_id')) {
            const { data: prev } = await supabase
              .from('batches')
              .select('teacher_id, name')
              .eq('id', id)
              .maybeSingle()
            previousTeacherId = prev?.teacher_id ?? null
            batchName = prev?.name ?? ''
          }
          const { error } = await supabase.from('batches').update(updates).eq('id', id)
          if (error) throw error
          // Notify on teacher reassignment (only when teacher_id actually changes)
          if (Object.prototype.hasOwnProperty.call(updates, 'teacher_id')) {
            const newTeacherId = (updates as any).teacher_id ?? null
            if (newTeacherId !== previousTeacherId) {
              const notifications: any[] = []
              if (newTeacherId) {
                notifications.push({
                  user_id: newTeacherId,
                  title: 'New batch assigned',
                  message: `You have been assigned to batch "${batchName}".`,
                })
              }
              if (previousTeacherId) {
                notifications.push({
                  user_id: previousTeacherId,
                  title: 'Batch reassigned',
                  message: `You are no longer assigned to batch "${batchName}".`,
                })
              }
              if (notifications.length > 0) {
                await supabase.from('notifications').insert(notifications)
              }
            }
          }
          result = { success: true }
          break
        }

        if (action === 'delete_batch') {
          await assertBatchInScope(params.id)
          await supabase.from('batch_students').delete().eq('batch_id', params.id)
          const { error } = await supabase.from('batches').delete().eq('id', params.id)
          if (error) throw error
          result = { success: true }
          break
        }

        if (action === 'list_batch_students') {
          await assertBatchInScope(params.batch_id)
          const { data } = await supabase.from('batch_students').select('*').eq('batch_id', params.batch_id)
          const sIds = (data ?? []).map((d: any) => d.student_id)
          let profs: any[] = []
          if (sIds.length) {
            const { data: p } = await supabase
              .from('profiles')
              .select('user_id, display_name, email')
              .in('user_id', sIds)
            profs = p ?? []
          }
          const pm: Record<string, any> = {}
          for (const p of profs) pm[p.user_id] = p
          result = (data ?? []).map((d: any) => ({ ...d, profile: pm[d.student_id] || null }))
          break
        }

        if (action === 'add_batch_student') {
          await assertBatchInScope(params.batch_id)
          // Normalize student_id to auth user_id
          let sid = params.student_id
          const { data: byUser } = await supabase
            .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
          if (!byUser) {
            const { data: byProf } = await supabase
              .from('profiles').select('user_id').eq('id', sid).maybeSingle()
            if (!byProf?.user_id) throw new Error('Student profile not found')
            sid = byProf.user_id
          }
          const { error } = await supabase
            .from('batch_students')
            .insert({ batch_id: params.batch_id, student_id: sid })
          if (error) throw error
          result = { success: true }
          break
        }

        if (action === 'remove_batch_student') {
          await assertBatchInScope(params.batch_id)
          let sid = params.student_id
          const { data: byUser } = await supabase
            .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
          if (!byUser) {
            const { data: byProf } = await supabase
              .from('profiles').select('user_id').eq('id', sid).maybeSingle()
            if (byProf?.user_id) sid = byProf.user_id
          }
          const { error } = await supabase
            .from('batch_students')
            .delete()
            .eq('batch_id', params.batch_id)
            .eq('student_id', sid)
          if (error) throw error
          result = { success: true }
          break
        }

        if (action === 'batch_student_count') {
          await assertBatchInScope(params.batch_id)
          const { count, error } = await supabase
            .from('batch_students')
            .select('id', { count: 'exact', head: true })
            .eq('batch_id', params.batch_id)
          if (error) throw error
          result = count ?? 0
          break
        }

        break
      }

      // ===== PRACTICE ASSIGNMENTS =====
      case 'list_practice_assignments': {
        let q: any = supabase
          .from('practice_assignments')
          .select('*, batches(name, course_id)')
          .order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        if (params?.batch_id) q = q.eq('batch_id', params.batch_id)
        // Teachers only see their own assignments
        if (callerIsTeacher && !callerIsSuperadmin && !callerIsAdmin && !callerIsSupport && callerUserId) {
          q = q.eq('teacher_id', callerUserId)
        }
        const { data, error } = await q
        if (error) throw error
        const rows = data ?? []
        const lessonIds = [...new Set(rows.map((r: any) => r.lesson_id).filter(Boolean))]
        const moduleIds = [...new Set(rows.map((r: any) => r.module_id).filter(Boolean))]
        const [lessonsRes, modulesRes] = await Promise.all([
          lessonIds.length ? supabase.from('lessons').select('id,title,file_url,lesson_type,content').in('id', lessonIds) : Promise.resolve({ data: [] } as any),
          moduleIds.length ? supabase.from('course_modules').select('id,title').in('id', moduleIds) : Promise.resolve({ data: [] } as any),
        ])
        const lessonsMap = new Map((lessonsRes.data ?? []).map((l: any) => [l.id, l]))
        const modulesMap = new Map((modulesRes.data ?? []).map((m: any) => [m.id, m]))
        result = rows.map((r: any) => ({
          ...r,
          lesson: r.lesson_id ? lessonsMap.get(r.lesson_id) ?? null : null,
          module: r.module_id ? modulesMap.get(r.module_id) ?? null : null,
        }))
        break
      }
      case 'create_practice_assignment': {
        const row: any = { ...params }
        if (!row.organization_id && targetOrgId) row.organization_id = targetOrgId
        const { data, error } = await supabase
          .from('practice_assignments')
          .insert(row)
          .select()
          .single()
        if (error) throw error
        result = data
        break
      }
      case 'update_practice_assignment': {
        const { id, ...updates } = params
        if (!callerIsSuperadmin && targetOrgId) {
          const { data: existing } = await supabase
            .from('practice_assignments')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: assignment outside organization' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await supabase.from('practice_assignments').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_practice_assignment': {
        const { id } = params
        if (!callerIsSuperadmin && targetOrgId) {
          const { data: existing } = await supabase
            .from('practice_assignments')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: assignment outside organization' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await supabase.from('practice_assignments').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== STUDENT SUBMISSIONS =====
      case 'list_student_submissions': {
        let q: any = supabase
          .from('student_submissions')
          .select('*, practice_assignments(title, batch_id, batches(name))')
          .order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data, error } = await q
        if (error) throw error
        result = data ?? []
        break
      }
      case 'review_student_submission': {
        const { id, score, teacher_feedback, status } = params
        if (!callerIsSuperadmin && targetOrgId) {
          const { data: existing } = await supabase
            .from('student_submissions')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: submission outside organization' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await supabase
          .from('student_submissions')
          .update({ score: score ?? null, teacher_feedback: teacher_feedback ?? null, status: status ?? 'reviewed' })
          .eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ===== CONFLICT CHECKS =====
      case 'check_teacher_conflicts': {
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { teacher_id, batch_id } = params as { teacher_id?: string; batch_id?: string }
        if (!teacher_id || !batch_id) { result = []; break }
        const { data: otherBatches } = await supabase
          .from('batches').select('id, name')
          .eq('teacher_id', teacher_id).neq('id', batch_id)
        const otherIds = (otherBatches ?? []).map((b: any) => b.id)
        if (!otherIds.length) { result = []; break }
        const [{ data: mySch }, { data: otherSch }] = await Promise.all([
          supabase.from('schedules').select('date, day_of_week, start_time, end_time').eq('batch_id', batch_id),
          supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', otherIds),
        ])
        const nameMap: Record<string, string> = {}
        for (const b of otherBatches ?? []) nameMap[b.id] = b.name
        const conflicts: any[] = []
        for (const m of mySch ?? []) {
          for (const o of otherSch ?? []) {
            const sameWhen = m.date && o.date ? m.date === o.date : m.day_of_week === o.day_of_week
            if (!sameWhen) continue
            const aS = (m.start_time || '').slice(0,5), aE = (m.end_time || '').slice(0,5)
            const bS = (o.start_time || '').slice(0,5), bE = (o.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              conflicts.push({
                date: o.date, day_of_week: o.day_of_week,
                start_time: o.start_time, end_time: o.end_time,
                other_batch_id: o.batch_id, other_batch_name: nameMap[o.batch_id] || 'Unknown batch',
              })
            }
          }
        }
        result = conflicts
        break
      }
      case 'check_student_conflicts': {
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // batch_students.student_id is the auth user_id. Accept either user_id
        // or profiles.id from the caller and normalize.
        const { student_id, batch_id } = params as { student_id?: string; batch_id?: string }
        if (!student_id || !batch_id) { result = []; break }
        let sid = student_id
        const { data: byUser } = await supabase
          .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
        if (!byUser) {
          const { data: byProf } = await supabase
            .from('profiles').select('user_id').eq('id', sid).maybeSingle()
          if (byProf?.user_id) sid = byProf.user_id
        }
        const { data: enrollments } = await supabase
          .from('batch_students').select('batch_id')
          .eq('student_id', sid).neq('batch_id', batch_id)
        const otherIds = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
        if (!otherIds.length) { result = []; break }
        const [{ data: otherBatches }, { data: mySch }, { data: otherSch }] = await Promise.all([
          supabase.from('batches').select('id, name').in('id', otherIds),
          supabase.from('schedules').select('date, day_of_week, start_time, end_time').eq('batch_id', batch_id),
          supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', otherIds),
        ])
        const nameMap: Record<string, string> = {}
        for (const b of otherBatches ?? []) nameMap[b.id] = b.name
        const conflicts: any[] = []
        for (const m of mySch ?? []) {
          for (const o of otherSch ?? []) {
            const sameWhen = m.date && o.date ? m.date === o.date : m.day_of_week === o.day_of_week
            if (!sameWhen) continue
            const aS = (m.start_time || '').slice(0,5), aE = (m.end_time || '').slice(0,5)
            const bS = (o.start_time || '').slice(0,5), bE = (o.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              conflicts.push({
                date: o.date, day_of_week: o.day_of_week,
                start_time: o.start_time, end_time: o.end_time,
                other_batch_id: o.batch_id, other_batch_name: nameMap[o.batch_id] || 'Unknown batch',
              })
            }
          }
        }
        result = conflicts
        break
      }

      case 'check_slot_conflicts': {
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const {
          teacher_id, student_ids, date, day_of_week,
          start_time, end_time, exclude_batch_id,
        } = params as {
          teacher_id?: string | null
          student_ids?: string[]
          date?: string | null
          day_of_week?: number
          start_time?: string
          end_time?: string
          exclude_batch_id?: string | null
        }
        if (!start_time || !end_time || (day_of_week === undefined && !date)) {
          result = { teacher_conflicts: [], student_conflicts: [] }
          break
        }
        const aS = start_time.slice(0,5), aE = end_time.slice(0,5)

        const collectFromBatches = async (batchIds: string[]) => {
          if (!batchIds.length) return [] as any[]
          const [{ data: batchRows }, { data: schRows }] = await Promise.all([
            supabase.from('batches').select('id, name').in('id', batchIds),
            supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', batchIds),
          ])
          const nameMap: Record<string, string> = {}
          for (const b of batchRows ?? []) nameMap[b.id] = b.name
          const out: any[] = []
          for (const s of schRows ?? []) {
            const sameWhen = date && s.date ? date === s.date : s.day_of_week === day_of_week
            if (!sameWhen) continue
            const bS = (s.start_time || '').slice(0,5), bE = (s.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              out.push({
                date: s.date, day_of_week: s.day_of_week,
                start_time: s.start_time, end_time: s.end_time,
                other_batch_id: s.batch_id, other_batch_name: nameMap[s.batch_id] || 'Unknown batch',
              })
            }
          }
          return out
        }

        let teacher_conflicts: any[] = []
        if (teacher_id) {
          let q = supabase.from('batches').select('id').eq('teacher_id', teacher_id)
          if (exclude_batch_id) q = q.neq('id', exclude_batch_id)
          const { data: tBatches } = await q
          teacher_conflicts = await collectFromBatches((tBatches ?? []).map((b: any) => b.id))
        }

        let student_conflicts: any[] = []
        if (Array.isArray(student_ids) && student_ids.length) {
          // Normalize: accept profiles.id or user_id, persist user_id in DB.
          const { data: pByUser } = await supabase
            .from('profiles').select('user_id').in('user_id', student_ids)
          const userIds = new Set<string>((pByUser ?? []).map((p: any) => p.user_id))
          const unknown = student_ids.filter((id) => !userIds.has(id))
          if (unknown.length) {
            const { data: pByProf } = await supabase
              .from('profiles').select('user_id').in('id', unknown)
            for (const p of pByProf ?? []) userIds.add(p.user_id)
          }
          const normalizedIds = [...userIds]
          let q = supabase.from('batch_students').select('batch_id, student_id').in('student_id', normalizedIds)
          if (exclude_batch_id) q = q.neq('batch_id', exclude_batch_id)
          const { data: enrollments } = await q
          const ids = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
          student_conflicts = await collectFromBatches(ids)
        }

        result = { teacher_conflicts, student_conflicts }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (cKey) writeToCache(cKey, result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    // Return 200 with the error payload so the Supabase JS client surfaces
    // the actual message instead of the opaque "non-2xx status code" wrapper.
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
