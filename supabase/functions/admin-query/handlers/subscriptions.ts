import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_subscription_plans': {
        const { data } = await ctx.supabase.from('subscription_plans').select('*').order('price')
        result = data ?? []
        break
      }
      case 'create_subscription_plan': {
        const { data, error } = await ctx.supabase.from('subscription_plans').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_subscription_plan': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('subscription_plans').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_subscription_plan': {
        const { error } = await ctx.supabase.from('subscription_plans').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_org_subscriptions': {
        const { data } = await ctx.supabase.from('org_subscriptions').select('*, organizations(name), subscription_plans(name, price, billing_cycle)').order('created_at', { ascending: false })
        result = data ?? []
        break
      }
      case 'assign_org_subscription': {
        const { organization_id, plan_id, expires_at } = params
        // upsert
        const { data: existing } = await ctx.supabase.from('org_subscriptions').select('id').eq('organization_id', organization_id).maybeSingle()
        if (existing) {
          const { error } = await ctx.supabase.from('org_subscriptions').update({ plan_id, status: 'active', starts_at: new Date().toISOString(), expires_at: expires_at || null }).eq('organization_id', organization_id)
          if (error) throw error
        } else {
          const { error } = await ctx.supabase.from('org_subscriptions').insert({ organization_id, plan_id, expires_at: expires_at || null })
          if (error) throw error
        }
        result = { success: true }
        break
      }
      case 'cancel_org_subscription': {
        const { error } = await ctx.supabase.from('org_subscriptions').update({ status: 'cancelled' }).eq('organization_id', params.organization_id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
