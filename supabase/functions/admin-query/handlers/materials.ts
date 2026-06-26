// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_materials': {
        let query: any = ctx.supabase.from('materials').select('*, courses(name)').order('created_at', { ascending: false })
        if (params?.course_id) query = query.eq('course_id', params.course_id)
        if (ctx.targetOrgId) query = query.eq('organization_id', ctx.targetOrgId)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_material': {
        const row = { ...params }
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('materials').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_material': {
        const { error } = await ctx.supabase.from('materials').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
