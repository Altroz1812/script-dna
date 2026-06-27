import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_batches': {
        let query = ctx.supabase.from('batches').select('*, courses(name, duration_days, daily_hours, total_hours, delivery_mode)')
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        if (ctx.targetOrgId) query = query.eq('organization_id', ctx.targetOrgId)
        // Teachers (without admin/support/superadmin) only see batches they own.
        if (ctx.callerIsTeacher && !ctx.callerIsSuperadmin && !ctx.callerIsAdmin && !ctx.callerIsSupport && ctx.callerUserId) {
          query = query.eq('teacher_id', ctx.callerUserId)
        }
        const { data } = await query.order('created_at', { ascending: false })
        const batches = data ?? []
        const batchIds = batches.map((b: any) => b.id)
        const teacherIds = Array.from(new Set(batches.map((b: any) => b.teacher_id).filter(Boolean)))

        // Fetch enrollment counts, teacher names, and session timelines in
        // parallel — these three lookups are independent.
        const [bsRes, profsRes, lcsRes] = await Promise.all([
          batchIds.length
            ? ctx.supabase.from('batch_students').select('batch_id').in('batch_id', batchIds)
            : Promise.resolve({ data: [] as any[] }),
          teacherIds.length
            ? ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', teacherIds)
            : Promise.resolve({ data: [] as any[] }),
          batchIds.length
            ? ctx.supabase
                .from('live_classes')
                .select('id, batch_id, title, scheduled_at, duration_minutes, status')
                .in('batch_id', batchIds)
                .order('scheduled_at', { ascending: true })
            : Promise.resolve({ data: [] as any[] }),
        ])

        const counts: Record<string, number> = {}
        for (const row of bsRes.data ?? []) {
          counts[row.batch_id] = (counts[row.batch_id] ?? 0) + 1
        }

        const teacherMap: Record<string, string> = {}
        for (const p of profsRes.data ?? []) {
          teacherMap[p.user_id] = p.display_name || p.email || ''
        }

        const sessionStats: Record<string, { total: number; completed: number; next: any | null }> = {}
        for (const id of batchIds) sessionStats[id] = { total: 0, completed: 0, next: null }
        const now = Date.now()
        for (const s of lcsRes.data ?? []) {
          const st = sessionStats[s.batch_id]
          if (!st) continue
          st.total++
          if (s.status === 'completed') st.completed++
            if (!st.next && s.status !== 'completed' && s.status !== 'cancelled' && new Date(s.scheduled_at).getTime() >= now) {
              st.next = { id: s.id, title: s.title, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes, status: s.status }
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
        const orgIdForInsert = organization_id || ctx.targetOrgId || null
        const insertRow: any = { course_id, name, max_students: max_students ?? 25 }
        if (orgIdForInsert) insertRow.organization_id = orgIdForInsert
        const { data, error } = await ctx.supabase.from('batches').insert(insertRow).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_batch': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('batches').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_batch': {
        await ctx.supabase.from('batch_students').delete().eq('batch_id', params.id)
        const { error } = await ctx.supabase.from('batches').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'batch_delete_impact': {
        const batchId = params.id
        if (!batchId) throw new Error('batch id required')
        const [students, schedules, liveClasses, attendance, assignments, certificates, extensions] = await Promise.all([
          ctx.supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('live_classes').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('practice_assignments').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
          ctx.supabase.from('class_extension_requests').select('id', { count: 'exact', head: true }).eq('batch_id', batchId),
        ])
        result = {
          students: students.count ?? 0,
          schedules: schedules.count ?? 0,
          live_classes: liveClasses.count ?? 0,
          attendance: attendance.count ?? 0,
          assignments: assignments.count ?? 0,
          certificates: certificates.count ?? 0,
          extension_requests: extensions.count ?? 0,
        }
        break
      }
      case 'get_batch_detail': {
        const { id } = params
        if (!id) throw new Error('batch id required')
        const { data: batch, error: bErr } = await ctx.supabase
          .from('batches')
          .select('*, courses(*)')
          .eq('id', id)
          .maybeSingle()
        if (bErr) throw bErr
        if (!batch) throw new Error('Batch not found')
        if (ctx.targetOrgId && batch.organization_id !== ctx.targetOrgId) {
          throw new Error('Batch is outside your organization')
        }
        // Teachers can only view their own batches via admin-query
        if (ctx.callerIsTeacher && !ctx.callerIsSuperadmin && !ctx.callerIsAdmin && !ctx.callerIsSupport) {
          if (batch.teacher_id !== ctx.callerUserId) {
            throw new Error('You are not assigned to this batch')
          }
        }

        // Teacher profile
        let teacher: any = null
        if (batch.teacher_id) {
          const { data: t } = await ctx.supabase
            .from('profiles')
            .select('user_id, display_name, email, avatar_url')
            .eq('user_id', batch.teacher_id)
            .maybeSingle()
          teacher = t || null
        }

        // Enrolled students + progress
        const { data: enrollRows } = await ctx.supabase
          .from('batch_students')
          .select('student_id, enrolled_at')
          .eq('batch_id', id)
        const studentIds = (enrollRows ?? []).map((r: any) => r.student_id)
        let studentProfiles: any[] = []
        let progressRows: any[] = []
        if (studentIds.length) {
          const [{ data: profs }, { data: progs }] = await Promise.all([
            ctx.supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', studentIds),
            ctx.supabase.from('student_progress').select('student_id, completion_pct, sessions_attended, total_sessions').eq('batch_id', id),
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
        const { data: sessions } = await ctx.supabase
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
        const { data } = await ctx.supabase.from('batch_students').select('*').eq('batch_id', params.batch_id)
        const sIds = (data ?? []).map((d: any) => d.student_id)
        let profs: any[] = []
        if (sIds.length) {
          // batch_students.student_id stores the auth user_id
          const { data: p } = await ctx.supabase.from('profiles').select('id, user_id, display_name, email').in('user_id', sIds)
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
        let { data: studentProfile } = await ctx.supabase
          .from('profiles')
          .select('id, user_id')
          .eq('user_id', params.student_id)
          .maybeSingle()
        if (!studentProfile) {
          const { data: byProfileId } = await ctx.supabase
            .from('profiles')
            .select('id, user_id')
            .eq('id', params.student_id)
            .maybeSingle()
          studentProfile = byProfileId
        }
        if (!studentProfile) throw new Error('Student profile not found')
        const studentUserId = studentProfile.user_id

        const { data: batchInfo } = await ctx.supabase
          .from('batches')
          .select('max_students, organization_id')
          .eq('id', params.batch_id)
          .maybeSingle()
        if (!batchInfo) throw new Error('Batch not found')
        // Org scope check (non-superadmin only)
        if (!ctx.callerIsSuperadmin && ctx.targetOrgId && batchInfo.organization_id !== ctx.targetOrgId) {
          throw new Error('Batch is outside your organization')
        }
        const { data: member } = await ctx.supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', batchInfo.organization_id)
          .eq('user_id', studentProfile.user_id)
          .maybeSingle()
        if (!member) throw new Error('Student is not assigned to this organization')
        const { count: currentCount } = await ctx.supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id)
        if ((currentCount ?? 0) >= batchInfo.max_students) {
          throw new Error(`Batch is full (${batchInfo.max_students}/${batchInfo.max_students} seats taken)`)
        }
        // Prevent duplicate enrollment with a friendly message
        const { data: existing } = await ctx.supabase
          .from('batch_students')
          .select('id')
          .eq('batch_id', params.batch_id)
          .eq('student_id', studentUserId)
          .maybeSingle()
        if (existing) throw new Error('Student is already enrolled in this batch')
        const { error } = await ctx.supabase
          .from('batch_students')
          .insert({ batch_id: params.batch_id, student_id: studentUserId })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_batch_student': {
        // Accept either user_id or profile.id — normalize to user_id
        let sid = params.student_id
        const { data: byUser } = await ctx.supabase
          .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
        if (!byUser) {
          const { data: byProf } = await ctx.supabase
            .from('profiles').select('user_id').eq('id', sid).maybeSingle()
          if (byProf?.user_id) sid = byProf.user_id
        }
        const { error } = await ctx.supabase.from('batch_students').delete().eq('batch_id', params.batch_id).eq('student_id', sid)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'batch_student_count': {
        const { count, error } = await ctx.supabase.from('batch_students').select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id)
        if (error) throw error
        result = count ?? 0
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
