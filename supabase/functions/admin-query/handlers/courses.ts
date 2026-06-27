import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_courses': {
        let q: any = ctx.supabase.from('courses').select('*').is('deleted_at', null).order('created_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_course': {
        const { name, description, created_by, grade_level, duration_days, total_hours, daily_hours, language, writing_style, includes_speed, fee, delivery_mode, center, organization_id } = params
        const { data, error } = await ctx.supabase.from('courses').insert({
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
          organization_id: organization_id || ctx.targetOrgId || null,
        }).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_course': {
        const { id, ...updates } = params
        const { data, error } = await ctx.supabase.from('courses').update(updates).eq('id', id).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_course': {
        // Soft delete: mark course + all related rows as deleted_at = now().
        // Admin can restore within the retention window from the Recycle Bin.
        const now = new Date().toISOString()
        const courseId = params.id
        if (!courseId) throw new Error('course id required')
        // 1. Soft-delete batches owned by this course and their dependents
        const { data: batchRows } = await ctx.supabase
          .from('batches').select('id').eq('course_id', courseId).is('deleted_at', null)
        const batchIds = (batchRows ?? []).map((b: any) => b.id)
        if (batchIds.length) {
          await Promise.all([
            ctx.supabase.from('batches').update({ deleted_at: now, deleted_by: ctx.callerUserId ?? null, deleted_cause: 'course' }).in('id', batchIds),
            ctx.supabase.from('batch_students').update({ deleted_at: now }).in('batch_id', batchIds).is('deleted_at', null),
            ctx.supabase.from('schedules').update({ deleted_at: now }).in('batch_id', batchIds).is('deleted_at', null),
            ctx.supabase.from('live_classes').update({ deleted_at: now }).in('batch_id', batchIds).is('deleted_at', null),
            ctx.supabase.from('attendance').update({ deleted_at: now }).in('batch_id', batchIds).is('deleted_at', null),
            ctx.supabase.from('class_extension_requests').update({ deleted_at: now }).in('batch_id', batchIds).is('deleted_at', null),
          ])
        }
        // 2. Soft-delete course-scoped dependents
        const { data: moduleRows } = await ctx.supabase.from('course_modules').select('id').eq('course_id', courseId).is('deleted_at', null)
        const moduleIds = (moduleRows ?? []).map((m: any) => m.id)
        await Promise.all([
          ctx.supabase.from('course_modules').update({ deleted_at: now }).eq('course_id', courseId).is('deleted_at', null),
          moduleIds.length ? ctx.supabase.from('lessons').update({ deleted_at: now }).in('module_id', moduleIds).is('deleted_at', null) : Promise.resolve(),
          ctx.supabase.from('materials').update({ deleted_at: now }).eq('course_id', courseId).is('deleted_at', null),
          ctx.supabase.from('practice_assignments').update({ deleted_at: now }).eq('course_id', courseId).is('deleted_at', null),
          ctx.supabase.from('certificates').update({ deleted_at: now }).eq('course_id', courseId).is('deleted_at', null),
          ctx.supabase.from('student_progress').update({ deleted_at: now }).eq('course_id', courseId).is('deleted_at', null),
        ])
        // 3. Soft-delete the course itself
        const { error } = await ctx.supabase.from('courses')
          .update({ deleted_at: now, deleted_by: ctx.callerUserId ?? null })
          .eq('id', courseId)
        if (error) throw error
        result = { success: true, soft_deleted: true }
        break
      }
      case 'restore_course': {
        const courseId = params.id
        if (!courseId) throw new Error('course id required')
        const { data: course } = await ctx.supabase.from('courses').select('id, deleted_at').eq('id', courseId).maybeSingle()
        if (!course) throw new Error('Course not found')
        if (!course.deleted_at) { result = { success: true, already_active: true }; break }
        // Restore course + everything that was cascaded with the course
        await Promise.all([
          ctx.supabase.from('courses').update({ deleted_at: null, deleted_by: null }).eq('id', courseId),
          ctx.supabase.from('course_modules').update({ deleted_at: null }).eq('course_id', courseId),
          ctx.supabase.from('materials').update({ deleted_at: null }).eq('course_id', courseId),
          ctx.supabase.from('practice_assignments').update({ deleted_at: null }).eq('course_id', courseId),
          ctx.supabase.from('certificates').update({ deleted_at: null }).eq('course_id', courseId),
          ctx.supabase.from('student_progress').update({ deleted_at: null }).eq('course_id', courseId),
        ])
        // Restore lessons under restored modules
        const { data: mods } = await ctx.supabase.from('course_modules').select('id').eq('course_id', courseId)
        const modIds = (mods ?? []).map((m: any) => m.id)
        if (modIds.length) {
          await ctx.supabase.from('lessons').update({ deleted_at: null }).in('module_id', modIds)
        }
        // Restore batches that were cascaded because of this course
        const { data: batches } = await ctx.supabase
          .from('batches').select('id').eq('course_id', courseId).eq('deleted_cause', 'course')
        const batchIds = (batches ?? []).map((b: any) => b.id)
        if (batchIds.length) {
          await Promise.all([
            ctx.supabase.from('batches').update({ deleted_at: null, deleted_by: null, deleted_cause: null }).in('id', batchIds),
            ctx.supabase.from('batch_students').update({ deleted_at: null }).in('batch_id', batchIds),
            ctx.supabase.from('schedules').update({ deleted_at: null }).in('batch_id', batchIds),
            ctx.supabase.from('live_classes').update({ deleted_at: null }).in('batch_id', batchIds),
            ctx.supabase.from('attendance').update({ deleted_at: null }).in('batch_id', batchIds),
            ctx.supabase.from('class_extension_requests').update({ deleted_at: null }).in('batch_id', batchIds),
          ])
        }
        result = { success: true }
        break
      }
      case 'list_deleted_courses': {
        let q: any = ctx.supabase.from('courses').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data } = await q
        result = data ?? []
        break
      }
      case 'purge_course': {
        // Hard delete – only callable after the retention window has passed.
        const { error } = await ctx.supabase.from('courses').delete().eq('id', params.id).not('deleted_at', 'is', null)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'course_delete_impact': {
        const courseId = params.id
        if (!courseId) throw new Error('course id required')
        const [batches, modules, lessons, materials, assignments, certificates, progress] = await Promise.all([
          ctx.supabase.from('batches').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          ctx.supabase.from('course_modules').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          ctx.supabase.from('lessons').select('id, module_id, course_modules!inner(course_id)', { count: 'exact', head: true }).eq('course_modules.course_id', courseId),
          ctx.supabase.from('materials').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          ctx.supabase.from('practice_assignments').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          ctx.supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          ctx.supabase.from('student_progress').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
        ])
        result = {
          batches: batches.count ?? 0,
          modules: modules.count ?? 0,
          lessons: lessons.count ?? 0,
          materials: materials.count ?? 0,
          assignments: assignments.count ?? 0,
          certificates: certificates.count ?? 0,
          student_progress: progress.count ?? 0,
        }
        break
      }
      case 'list_course_modules': {
        if (!ctx.callerIsSuperadmin && ctx.targetOrgId && params.course_id) {
          const { data: c } = await ctx.supabase.from('courses').select('organization_id').eq('id', params.course_id).maybeSingle()
          if (!c || c.organization_id !== ctx.targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: course outside your organization' }), {
              status: 403, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { data } = await ctx.supabase.from('course_modules').select('*, lessons(*)').eq('course_id', params.course_id).order('sort_order')
        for (const m of data ?? []) {
          if (m.lessons) m.lessons.sort((a: any, b: any) => a.sort_order - b.sort_order)
        }
        result = data ?? []
        break
      }
      case 'create_course_module': {
        const { data, error } = await ctx.supabase.from('course_modules').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_course_module': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('course_modules').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_course_module': {
        const { error } = await ctx.supabase.from('course_modules').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'create_lesson': {
        const { data, error } = await ctx.supabase.from('lessons').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_lesson': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('lessons').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_lesson': {
        const { error } = await ctx.supabase.from('lessons').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
