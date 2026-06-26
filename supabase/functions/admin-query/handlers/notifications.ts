// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_notifications': {
        let q: any = ctx.supabase.from('notifications').select('*').order('created_at', { ascending: false })
        if (ctx.targetOrgId) {
          q = q.or(`organization_id.eq.${ctx.targetOrgId},target_org_id.eq.${ctx.targetOrgId}`)
        }
        const { data } = await q
        result = data ?? []
        break
      }
      case 'create_notification': {
        const row = { ...params }
        if (!row.organization_id && !row.target_org_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('notifications').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'mark_read': {
        const { error } = await ctx.supabase.from('notifications').update({ read: true }).eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_notification': {
        const { error } = await ctx.supabase.from('notifications').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
