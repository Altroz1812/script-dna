import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_practice_assignments': {
        let q: any = ctx.supabase
          .from('practice_assignments')
          .select('*, batches(name, course_id)')
          .order('created_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        if (params?.batch_id) q = q.eq('batch_id', params.batch_id)
        // Teachers only see their own assignments
        if (ctx.callerIsTeacher && !ctx.callerIsSuperadmin && !ctx.callerIsAdmin && !ctx.callerIsSupport && ctx.callerUserId) {
          q = q.eq('teacher_id', ctx.callerUserId)
        }
        const { data, error } = await q
        if (error) throw error
        const rows = data ?? []
        const lessonIds = [...new Set(rows.map((r: any) => r.lesson_id).filter(Boolean))]
        const moduleIds = [...new Set(rows.map((r: any) => r.module_id).filter(Boolean))]
        const [lessonsRes, modulesRes] = await Promise.all([
          lessonIds.length ? ctx.supabase.from('lessons').select('id,title,file_url,lesson_type,content').in('id', lessonIds) : Promise.resolve({ data: [] } as any),
          moduleIds.length ? ctx.supabase.from('course_modules').select('id,title').in('id', moduleIds) : Promise.resolve({ data: [] } as any),
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
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase
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
        if (!ctx.callerIsSuperadmin && ctx.targetOrgId) {
          const { data: existing } = await ctx.supabase
            .from('practice_assignments')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== ctx.targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: assignment outside organization' }), {
              status: 403, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await ctx.supabase.from('practice_assignments').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_practice_assignment': {
        const { id } = params
        if (!ctx.callerIsSuperadmin && ctx.targetOrgId) {
          const { data: existing } = await ctx.supabase
            .from('practice_assignments')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== ctx.targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: assignment outside organization' }), {
              status: 403, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await ctx.supabase.from('practice_assignments').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_student_submissions': {
        let q: any = ctx.supabase
          .from('student_submissions')
          .select('*, practice_assignments(title, batch_id, batches(name))')
          .order('created_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data, error } = await q
        if (error) throw error
        result = data ?? []
        break
      }
      case 'review_student_submission': {
        const { id, score, teacher_feedback, status } = params
        if (!ctx.callerIsSuperadmin && ctx.targetOrgId) {
          const { data: existing } = await ctx.supabase
            .from('student_submissions')
            .select('organization_id')
            .eq('id', id)
            .maybeSingle()
          if (!existing || existing.organization_id !== ctx.targetOrgId) {
            return new Response(JSON.stringify({ error: 'Forbidden: submission outside organization' }), {
              status: 403, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        const { error } = await ctx.supabase
          .from('student_submissions')
          .update({ score: score ?? null, teacher_feedback: teacher_feedback ?? null, status: status ?? 'reviewed' })
          .eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
