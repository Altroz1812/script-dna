import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_payments': {
        let q: any = ctx.supabase.from('payments').select('*').order('created_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data } = await q
        const sIds = [...new Set((data ?? []).map((p: any) => p.student_id))]
        let profs: any[] = []
        if (sIds.length) {
          const { data: p } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((p: any) => ({ ...p, student_profile: pm[p.student_id] || null }))
        break
      }
      case 'create_payment': {
        const row = { ...params }
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        if (!row.organization_id && row.student_id) {
          const { data: m } = await ctx.supabase
            .from('organization_members').select('organization_id')
            .eq('user_id', row.student_id).order('joined_at').limit(1).maybeSingle()
          if (m?.organization_id) row.organization_id = m.organization_id
        }
        const { data, error } = await ctx.supabase.from('payments').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_payment': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('payments').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
