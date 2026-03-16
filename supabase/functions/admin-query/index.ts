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

    const { action, params } = await req.json()

    let result: any = null

    switch (action) {
      // ===== STATS =====
      case 'get_stats': {
        const [profiles, courses, batches, orgs, leads, payments] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('batches').select('id', { count: 'exact', head: true }),
          supabase.from('organizations').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase.from('payments').select('id', { count: 'exact', head: true }),
        ])
        const roles = await supabase.from('user_roles').select('role')
        const roleCounts: Record<string, number> = {}
        for (const r of roles.data ?? []) {
          roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
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
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
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
        const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'create_lead': {
        const { data, error } = await supabase.from('leads').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_lead': {
        const { id, ...updates } = params
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
        const { data: enrollments } = await supabase.from('batch_students').select('*').order('enrolled_at', { ascending: false })
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
        let query = supabase.from('schedules').select('*, batches(name, courses(name))').order('day_of_week').order('start_time')
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_schedule': {
        const { data, error } = await supabase.from('schedules').insert(params).select().single()
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
        let query = supabase.from('attendance').select('*').order('date', { ascending: false })
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        if (params?.date) query = query.eq('date', params.date)
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
        const { data } = await supabase.from('live_classes').select('*, batches(name), schedules(date, start_time, end_time, title, room)').order('scheduled_at', { ascending: false })
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
        let query = supabase.from('materials').select('*, courses(name)').order('created_at', { ascending: false })
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_material': {
        const { data, error } = await supabase.from('materials').insert(params).select().single()
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
        const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false })
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
        const { data, error } = await supabase.from('payments').insert(params).select().single()
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
        const { data } = await supabase.from('payroll').select('*').order('year', { ascending: false }).order('month', { ascending: false })
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
        const { data, error } = await supabase.from('payroll').insert(params).select().single()
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
        const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'create_notification': {
        const { data, error } = await supabase.from('notifications').insert(params).select().single()
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
      case 'list_students_with_batches': {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'student')
        const studentIds = (roles ?? []).map((r: any) => r.user_id)
        if (studentIds.length === 0) { result = []; break }
        const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', studentIds)
        const { data: enrollments } = await supabase.from('batch_students').select('student_id, batch_id, batches(name, courses(name))').in('student_id', studentIds)
        const enrollMap: Record<string, any[]> = {}
        for (const e of enrollments ?? []) {
          if (!enrollMap[e.student_id]) enrollMap[e.student_id] = []
          enrollMap[e.student_id].push(e)
        }
        result = (profiles ?? []).map((p: any) => ({ ...p, enrollments: enrollMap[p.user_id] || [] }))
        break
      }

      // ===== COURSES =====
      case 'list_courses': {
        const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'create_course': {
        const { name, description, created_by, grade_level, duration_days, total_hours, daily_hours, language, writing_style, includes_speed, fee } = params
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
        }).select().single()
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
        let query = supabase.from('batches').select('*, courses(name, duration_days, daily_hours, total_hours)')
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        const { data } = await query.order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'create_batch': {
        const { course_id, name, max_students } = params
        const { data, error } = await supabase.from('batches').insert({ course_id, name, max_students: max_students ?? 25 }).select().single()
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
        const { error } = await supabase.from('batch_students').insert({ batch_id: params.batch_id, student_id: params.student_id })
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
      case 'list_teachers': {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher')
        if (!roles?.length) { result = []; break }
        const ids = roles.map((r: any) => r.user_id)
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', ids)
        result = profiles ?? []
        break
      }
      case 'list_all_students': {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'student')
        if (!roles?.length) { result = []; break }
        const ids = roles.map((r: any) => r.user_id)
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', ids)
        result = profiles ?? []
        break
      }

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
        const { email } = params
        const { error: resetError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email,
        })
        if (resetError) throw resetError
        result = { success: true }
        break
      }

      // ===== ACTIVITY LOGS =====
      case 'list_activity_logs': {
        const { data: logs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200)
        const { data: loginLogs } = await supabase.from('login_attempts').select('*').order('attempted_at', { ascending: false }).limit(200)
        result = { activity_logs: logs ?? [], login_attempts: loginLogs ?? [] }
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
