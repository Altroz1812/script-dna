import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
    case 'set_student_completion': {
      // params: { batch_id, items: [{ student_id, status, notes? }] }
      const batchId = params?.batch_id
      const items: Array<{ student_id: string; status: string; notes?: string }> = params?.items ?? []
      if (!batchId || !items.length) throw new Error('batch_id and items required')

      const { data: batch } = await ctx.supabase
        .from('batches')
        .select('id, teacher_id, organization_id, course_id, courses(name, duration_days, total_hours)')
        .eq('id', batchId)
        .maybeSingle()
      if (!batch) throw new Error('Batch not found')

      const isBatchTeacher = ctx.callerUserId && batch.teacher_id === ctx.callerUserId
      if (!ctx.callerIsAdmin && !ctx.callerIsSuperadmin && !isBatchTeacher) {
        throw new Error('Not authorized')
      }

      const completedIds: string[] = []
      for (const it of items) {
        if (!['pending', 'completed', 'needs_improvement'].includes(it.status)) continue
        await ctx.supabase
          .from('batch_students')
          .update({
            completion_status: it.status,
            completion_notes: it.notes ?? null,
            completion_marked_at: new Date().toISOString(),
            completion_marked_by: ctx.callerUserId,
          })
          .eq('batch_id', batchId)
          .eq('student_id', it.student_id)
        if (it.status === 'completed') completedIds.push(it.student_id)
      }

      // Auto-issue certificates for newly completed students (skip if already issued)
      let issued = 0
      if (completedIds.length) {
        const { data: existing } = await ctx.supabase
          .from('certificates')
          .select('student_id')
          .eq('batch_id', batchId)
          .in('student_id', completedIds)
        const have = new Set((existing ?? []).map((r: any) => r.student_id))
        const toIssue = completedIds.filter((id) => !have.has(id))
        if (toIssue.length) {
          const { data: profs } = await ctx.supabase
            .from('profiles').select('user_id, display_name, email').in('user_id', toIssue)
          const pm: Record<string, any> = {}
          for (const p of profs ?? []) pm[p.user_id] = p
          const course: any = batch.courses
          const parts: string[] = []
          if (course?.duration_days) parts.push(`${course.duration_days} day${course.duration_days === 1 ? '' : 's'}`)
          if (course?.total_hours) parts.push(`${course.total_hours} hrs`)
          const duration = parts.join(' • ') || null
          const rows = toIssue.map((sid) => ({
            student_id: sid,
            batch_id: batch.id,
            course_id: batch.course_id,
            organization_id: batch.organization_id,
            student_name: pm[sid]?.display_name || pm[sid]?.email || 'Student',
            course_name: course?.name || 'Course',
            course_duration: duration,
            completion_date: new Date().toISOString().slice(0, 10),
            issued_by: ctx.callerUserId,
            status: 'issued',
          }))
          const { error } = await ctx.supabase.from('certificates').insert(rows)
          if (error) throw error
          issued = rows.length
        }
      }
      result = { success: true, issued }
      break
    }

    case 'create_extension_request': {
      // params: { batch_id, student_ids[], num_classes, extension_mode, fee_per_class?, reason? }
      const { batch_id, student_ids = [], num_classes, extension_mode = 'free', fee_per_class, reason } = params || {}
      if (!batch_id || !num_classes) throw new Error('batch_id and num_classes required')
      if (!['free', 'paid'].includes(extension_mode)) throw new Error('extension_mode must be free or paid')

      const { data: batch } = await ctx.supabase
        .from('batches').select('id, teacher_id, organization_id').eq('id', batch_id).maybeSingle()
      if (!batch) throw new Error('Batch not found')

      const isBatchTeacher = ctx.callerUserId && batch.teacher_id === ctx.callerUserId
      if (!ctx.callerIsAdmin && !ctx.callerIsSuperadmin && !isBatchTeacher) {
        throw new Error('Not authorized')
      }

      const amount = extension_mode === 'paid' && fee_per_class
        ? Number(fee_per_class) * Number(num_classes) * Math.max(1, student_ids.length || 1)
        : null

      const { data: inserted, error } = await ctx.supabase
        .from('class_extension_requests')
        .insert({
          batch_id,
          requested_by: ctx.callerUserId,
          request_type: 'add_classes',
          num_classes,
          extension_mode,
          student_ids,
          fee_per_class: fee_per_class ?? null,
          amount,
          organization_id: batch.organization_id,
          reason: reason ?? null,
          status: 'pending',
        })
        .select('*')
        .single()
      if (error) throw error
      result = inserted
      break
    }

    case 'list_extension_requests': {
      let q = ctx.supabase
        .from('class_extension_requests')
        .select('*, batches!inner(id, name, organization_id, teacher_id, courses(name))')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (params?.status) q = q.eq('status', params.status)
      if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
      if (ctx.callerIsTeacher && !ctx.callerIsAdmin && !ctx.callerIsSuperadmin && ctx.callerUserId) {
        q = q.eq('requested_by', ctx.callerUserId)
      }
      const { data, error } = await q
      if (error) throw error
      const rows = data ?? []
      const reqIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean)))
      let profMap: Record<string, any> = {}
      if (reqIds.length) {
        const { data: profs } = await ctx.supabase
          .from('profiles').select('user_id, display_name, email').in('user_id', reqIds)
        for (const p of profs ?? []) profMap[p.user_id] = p
      }
      const allStudentIds = Array.from(new Set(rows.flatMap((r: any) => r.student_ids ?? [])))
      let studentMap: Record<string, any> = {}
      if (allStudentIds.length) {
        const { data: sp } = await ctx.supabase
          .from('profiles').select('user_id, display_name, email').in('user_id', allStudentIds)
        for (const p of sp ?? []) studentMap[p.user_id] = p
      }
      result = rows.map((r: any) => ({
        ...r,
        requester: profMap[r.requested_by] ?? null,
        students: (r.student_ids ?? []).map((id: string) => studentMap[id] ?? { user_id: id }),
      }))
      break
    }

    case 'approve_extension_request':
    case 'reject_extension_request': {
      if (!ctx.callerIsAdmin && !ctx.callerIsSuperadmin) throw new Error('Admin only')
      const id = params?.id
      if (!id) throw new Error('id required')
      const status = action === 'approve_extension_request' ? 'approved' : 'rejected'
      const patch: any = {
        status,
        approved_by: ctx.callerUserId,
        approved_at: new Date().toISOString(),
      }
      if (status === 'rejected') patch.rejected_reason = params?.reason ?? null
      const { data, error } = await ctx.supabase
        .from('class_extension_requests').update(patch).eq('id', id).select('*').single()
      if (error) throw error

      // On approval, lift batch out of "needs_improvement" so teacher can schedule extra classes.
      if (status === 'approved' && data?.batch_id) {
        await ctx.supabase
          .from('batches')
          .update({ teacher_review_status: 'additional_classes_required', batch_status: 'active' })
          .eq('id', data.batch_id)
      }
      result = data
      break
    }

    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}