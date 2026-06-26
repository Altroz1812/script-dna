import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_parent_children': {
        const { parent_id } = params
        let query = ctx.supabase.from('parent_children').select('*')
        if (parent_id) query = query.eq('parent_id', parent_id)
        const { data } = await query.order('created_at', { ascending: false })
        // enrich with profiles
        const parentIds = [...new Set((data ?? []).map((d: any) => d.parent_id))]
        const childIds = [...new Set((data ?? []).map((d: any) => d.child_id))]
        const allIds = [...new Set([...parentIds, ...childIds])]
        let profiles: any[] = []
        if (allIds.length) {
          const { data: p } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', allIds)
          profiles = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profiles) pm[p.user_id] = p
        result = (data ?? []).map((d: any) => ({
          ...d,
          parent_profile: pm[d.parent_id] || null,
          child_profile: pm[d.child_id] || null,
        }))
        break
      }
      case 'add_parent_child': {
        const { parent_id, child_id } = params
        const { error } = await ctx.supabase.from('parent_children').insert({ parent_id, child_id })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_parent_child': {
        const { id } = params
        const { error } = await ctx.supabase.from('parent_children').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_parents': {
        const { data: roles } = await ctx.supabase.from('user_roles').select('user_id').eq('role', 'parent')
        if (!roles?.length) { result = []; break }
        const ids = roles.map((r: any) => r.user_id)
        const { data: profiles } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', ids)
        result = profiles ?? []
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
