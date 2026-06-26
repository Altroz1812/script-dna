import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_live_classes': {
        let scopedBatchIds: string[] | null = null
        if (ctx.targetOrgId) {
          const { data: ob } = await ctx.supabase.from('batches').select('id').eq('organization_id', ctx.targetOrgId)
          scopedBatchIds = (ob ?? []).map((b: any) => b.id)
          if (scopedBatchIds.length === 0) { result = []; break }
        }
        let lcQ: any = ctx.supabase.from('live_classes').select('*, batches(name, teacher_id, organization_id, courses(name, total_hours, duration_days, delivery_mode)), schedules(date, start_time, end_time, title, room)').order('scheduled_at', { ascending: false })
        if (scopedBatchIds) lcQ = lcQ.in('batch_id', scopedBatchIds)
        const { data } = await lcQ
        result = data ?? []
        break
      }
      case 'create_live_class': {
        const { data, error } = await ctx.supabase.from('live_classes').insert(params).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_live_class': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('live_classes').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_live_class': {
        const { error } = await ctx.supabase.from('live_classes').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
