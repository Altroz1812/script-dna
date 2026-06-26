import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_courses': {
        let q: any = ctx.supabase.from('courses').select('*').order('created_at', { ascending: false })
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
        const { error } = await ctx.supabase.from('courses').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
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
