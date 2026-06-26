// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_payroll': {
        let q: any = ctx.supabase.from('payroll').select('*').order('year', { ascending: false }).order('month', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data } = await q
        const tIds = [...new Set((data ?? []).map((p: any) => p.teacher_id))]
        let profs: any[] = []
        if (tIds.length) {
          const { data: p } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', tIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((p: any) => ({ ...p, teacher_profile: pm[p.teacher_id] || null }))
        break
      }
      case 'create_payroll': {
        const row = { ...params }
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('payroll').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_payroll': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('payroll').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
