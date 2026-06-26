import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_coupons': {
        let q: any = ctx.supabase.from('coupons').select('*').order('created_at', { ascending: false })
        if (ctx.targetOrgId) {
          q = q.or(`organization_id.is.null,organization_id.eq.${ctx.targetOrgId}`)
        }
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_coupon': {
        const row = { ...params }
        if (row.organization_id === undefined && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('coupons').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_coupon': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('coupons').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_coupon': {
        const { error } = await ctx.supabase.from('coupons').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
