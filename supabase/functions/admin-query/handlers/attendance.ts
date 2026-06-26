// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_attendance': {
        let query: any = ctx.supabase.from('attendance').select('*').order('date', { ascending: false })
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        if (params?.date) query = query.eq('date', params.date)
        if (ctx.targetOrgId) query = query.eq('organization_id', ctx.targetOrgId)
        const { data } = await query
        // enrich with student names
        const sIds = [...new Set((data ?? []).map((a: any) => a.student_id))]
        let profs: any[] = []
        if (sIds.length) {
          const { data: p } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds)
          profs = p ?? []
        }
        const pm: Record<string, any> = {}
        for (const p of profs) pm[p.user_id] = p
        result = (data ?? []).map((a: any) => ({ ...a, student_profile: pm[a.student_id] || null }))
        break
      }
      case 'save_attendance': {
        // params: { batch_id, date, records: [{ student_id, status }] }
        const { batch_id, date, records } = params
        if (!ctx.callerIsSuperadmin) {
          const { data: b } = await ctx.supabase.from('batches').select('organization_id').eq('id', batch_id).maybeSingle()
          if (!b || !b.organization_id || !ctx.callerOrgMemberships.includes(b.organization_id)) {
            return new Response(JSON.stringify({ error: 'Forbidden: batch outside your organization' }), {
              status: 403, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        // delete existing for this batch+date
        await ctx.supabase.from('attendance').delete().eq('batch_id', batch_id).eq('date', date)
        if (records.length > 0) {
          const rows = records.map((r: any) => ({ batch_id, date, student_id: r.student_id, status: r.status }))
          const { error } = await ctx.supabase.from('attendance').insert(rows)
          if (error) throw error
        }
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
