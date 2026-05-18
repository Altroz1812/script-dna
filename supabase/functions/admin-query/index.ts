import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    let callerOrgMemberships: string[] = []
    if (callerUserId) {
      const { data: roleRows } = await supabase
        .from('user_roles').select('role').eq('user_id', callerUserId)
      callerIsSuperadmin = (roleRows ?? []).some((r: any) => r.role === 'superadmin')
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
      'list_course_modules', 'create_course_module', 'update_course_module', 'delete_course_module',
      'create_lesson', 'update_lesson', 'delete_lesson',
      'list_students_with_batches', 'list_all_students', 'list_teachers',
      'list_batches', 'create_batch', 'update_batch', 'delete_batch',
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
        result = (profiles ?? []).map((p: any) => ({ ...p, role: roleMap[p.user_id] || 'student' }))
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

      // ===== LEADS =====
      case 'list_leads': {
        let q: any = supabase.from('leads').select('*').order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        const { data } = await q
        result = data ?? []
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
        let lcQ: any = supabase.from('live_classes').select('*, batches(name, teacher_id, organization_id, courses(delivery_mode)), schedules(date, start_time, end_time, title, room)').order('scheduled_at', { ascending: false })
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
            .select('user_id, display_name, email')
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

        result = batches.map((b: any) => ({
          ...b,
          enrolled_count: counts[b.id] ?? 0,
          teacher_name: b.teacher_id ? (teacherMap[b.teacher_id] ?? null) : null,
        }))
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
      case 'list_batch_students': {
        const { data } = await supabase.from('batch_students').select('*').eq('batch_id', params.batch_id)
        const sIds = (data ?? []).map((d: any) => d.student_id)
        let profs: any[] = []
        if (sIds.length) {
          const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds)
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
        const { count: currentCount } = await supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id)
        if ((currentCount ?? 0) >= batchInfo.max_students) {
          throw new Error(`Batch is full (${batchInfo.max_students}/${batchInfo.max_students} seats taken)`)
        }
        // Prevent duplicate enrollment with a friendly message
        const { data: existing } = await supabase
          .from('batch_students')
          .select('id')
          .eq('batch_id', params.batch_id)
          .eq('student_id', params.student_id)
          .maybeSingle()
        if (existing) throw new Error('Student is already enrolled in this batch')
        const { error } = await supabase
          .from('batch_students')
          .insert({ batch_id: params.batch_id, student_id: params.student_id })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_batch_student': {
        const { error } = await supabase.from('batch_students').delete().eq('batch_id', params.batch_id).eq('student_id', params.student_id)
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
        const { email, password, display_name, role, organization_id } = params
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name },
        })
        if (authError) throw authError
        const newUserId = authData.user.id
        // Profile is created by trigger, update display_name
        await supabase.from('profiles').update({ display_name, organization_id: organization_id || null }).eq('user_id', newUserId)
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
        let actQ: any = supabase.from('activity_logs').select('*').not('user_id', 'is', null).order('created_at', { ascending: false }).limit(200)
        if (scopedUserIds) actQ = actQ.in('user_id', scopedUserIds)
        const [activityRes, loginRes] = await Promise.all([
          actQ,
          callerIsSuperadmin
            ? supabase.from('login_attempts').select('*').order('attempted_at', { ascending: false }).limit(200)
            : Promise.resolve({ data: [] as any[] }),
        ])
        const userIds = [...new Set((activityRes.data ?? []).map((a: any) => a.user_id))]
        let profileMap: Record<string, { name: string; email: string }> = {}
        if (userIds.length) {
          const { data: profs } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
          for (const p of profs ?? []) profileMap[p.user_id] = { name: p.display_name || p.email || 'Unknown', email: p.email || '—' }
        }
        const enrichedLogs = (activityRes.data ?? []).map((a: any) => ({
          ...a,
          user_name: profileMap[a.user_id]?.name || 'Unknown',
          user_email: profileMap[a.user_id]?.email || '—',
        }))
        result = { activity_logs: enrichedLogs, login_attempts: loginRes.data ?? [] }
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
          const { error } = await supabase
            .from('batch_students')
            .insert({ batch_id: params.batch_id, student_id: params.student_id })
          if (error) throw error
          result = { success: true }
          break
        }

        if (action === 'remove_batch_student') {
          await assertBatchInScope(params.batch_id)
          const { error } = await supabase
            .from('batch_students')
            .delete()
            .eq('batch_id', params.batch_id)
            .eq('student_id', params.student_id)
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
          .select('*, batches(name)')
          .order('created_at', { ascending: false })
        if (targetOrgId) q = q.eq('organization_id', targetOrgId)
        if (params?.batch_id) q = q.eq('batch_id', params.batch_id)
        const { data, error } = await q
        if (error) throw error
        result = data ?? []
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

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

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
