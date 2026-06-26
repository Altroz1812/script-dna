import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_schedules': {
        let query: any = ctx.supabase.from('schedules').select('*, batches(name, courses(name))').order('day_of_week').order('start_time')
        if (params?.batch_id) query = query.eq('batch_id', params.batch_id)
        if (ctx.targetOrgId) query = query.eq('organization_id', ctx.targetOrgId)
        const { data } = await query
        result = data ?? []
        break
      }
      case 'create_schedule': {
        const row = { ...params }
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('schedules').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_schedule': {
        const { id, ...updates } = params
        const { error } = await ctx.supabase.from('schedules').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_schedule': {
        const { error } = await ctx.supabase.from('schedules').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'bulk_create_schedules': {
        const { entries } = params
        if (!entries?.length) throw new Error('No schedule entries provided')
        const { error } = await ctx.supabase.from('schedules').insert(entries)
        if (error) throw error
        result = { success: true, count: entries.length }
        break
      }
      case 'check_teacher_conflicts': {
        if (!ctx.callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { teacher_id, batch_id } = params as { teacher_id?: string; batch_id?: string }
        if (!teacher_id || !batch_id) { result = []; break }
        const { data: otherBatches } = await ctx.supabase
          .from('batches').select('id, name')
          .eq('teacher_id', teacher_id).neq('id', batch_id)
        const otherIds = (otherBatches ?? []).map((b: any) => b.id)
        if (!otherIds.length) { result = []; break }
        const [{ data: mySch }, { data: otherSch }] = await Promise.all([
          ctx.supabase.from('schedules').select('date, day_of_week, start_time, end_time').eq('batch_id', batch_id),
          ctx.supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', otherIds),
        ])
        const nameMap: Record<string, string> = {}
        for (const b of otherBatches ?? []) nameMap[b.id] = b.name
        const conflicts: any[] = []
        for (const m of mySch ?? []) {
          for (const o of otherSch ?? []) {
            const sameWhen = m.date && o.date ? m.date === o.date : m.day_of_week === o.day_of_week
            if (!sameWhen) continue
            const aS = (m.start_time || '').slice(0,5), aE = (m.end_time || '').slice(0,5)
            const bS = (o.start_time || '').slice(0,5), bE = (o.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              conflicts.push({
                date: o.date, day_of_week: o.day_of_week,
                start_time: o.start_time, end_time: o.end_time,
                other_batch_id: o.batch_id, other_batch_name: nameMap[o.batch_id] || 'Unknown batch',
              })
            }
          }
        }
        result = conflicts
        break
      }
      case 'check_student_conflicts': {
        if (!ctx.callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // batch_students.student_id is the auth user_id. Accept either user_id
        // or profiles.id from the caller and normalize.
        const { student_id, batch_id } = params as { student_id?: string; batch_id?: string }
        if (!student_id || !batch_id) { result = []; break }
        let sid = student_id
        const { data: byUser } = await ctx.supabase
          .from('profiles').select('user_id').eq('user_id', sid).maybeSingle()
        if (!byUser) {
          const { data: byProf } = await ctx.supabase
            .from('profiles').select('user_id').eq('id', sid).maybeSingle()
          if (byProf?.user_id) sid = byProf.user_id
        }
        const { data: enrollments } = await ctx.supabase
          .from('batch_students').select('batch_id')
          .eq('student_id', sid).neq('batch_id', batch_id)
        const otherIds = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
        if (!otherIds.length) { result = []; break }
        const [{ data: otherBatches }, { data: mySch }, { data: otherSch }] = await Promise.all([
          ctx.supabase.from('batches').select('id, name').in('id', otherIds),
          ctx.supabase.from('schedules').select('date, day_of_week, start_time, end_time').eq('batch_id', batch_id),
          ctx.supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', otherIds),
        ])
        const nameMap: Record<string, string> = {}
        for (const b of otherBatches ?? []) nameMap[b.id] = b.name
        const conflicts: any[] = []
        for (const m of mySch ?? []) {
          for (const o of otherSch ?? []) {
            const sameWhen = m.date && o.date ? m.date === o.date : m.day_of_week === o.day_of_week
            if (!sameWhen) continue
            const aS = (m.start_time || '').slice(0,5), aE = (m.end_time || '').slice(0,5)
            const bS = (o.start_time || '').slice(0,5), bE = (o.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              conflicts.push({
                date: o.date, day_of_week: o.day_of_week,
                start_time: o.start_time, end_time: o.end_time,
                other_batch_id: o.batch_id, other_batch_name: nameMap[o.batch_id] || 'Unknown batch',
              })
            }
          }
        }
        result = conflicts
        break
      }
      case 'check_slot_conflicts': {
        if (!ctx.callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const {
          teacher_id, student_ids, date, day_of_week,
          start_time, end_time, exclude_batch_id,
        } = params as {
          teacher_id?: string | null
          student_ids?: string[]
          date?: string | null
          day_of_week?: number
          start_time?: string
          end_time?: string
          exclude_batch_id?: string | null
        }
        if (!start_time || !end_time || (day_of_week === undefined && !date)) {
          result = { teacher_conflicts: [], student_conflicts: [] }
          break
        }
        const aS = start_time.slice(0,5), aE = end_time.slice(0,5)

        const collectFromBatches = async (batchIds: string[]) => {
          if (!batchIds.length) return [] as any[]
          const [{ data: batchRows }, { data: schRows }] = await Promise.all([
            ctx.supabase.from('batches').select('id, name').in('id', batchIds),
            ctx.supabase.from('schedules').select('batch_id, date, day_of_week, start_time, end_time').in('batch_id', batchIds),
          ])
          const nameMap: Record<string, string> = {}
          for (const b of batchRows ?? []) nameMap[b.id] = b.name
          const out: any[] = []
          for (const s of schRows ?? []) {
            const sameWhen = date && s.date ? date === s.date : s.day_of_week === day_of_week
            if (!sameWhen) continue
            const bS = (s.start_time || '').slice(0,5), bE = (s.end_time || '').slice(0,5)
            if (aS < bE && bS < aE) {
              out.push({
                date: s.date, day_of_week: s.day_of_week,
                start_time: s.start_time, end_time: s.end_time,
                other_batch_id: s.batch_id, other_batch_name: nameMap[s.batch_id] || 'Unknown batch',
              })
            }
          }
          return out
        }

        let teacher_conflicts: any[] = []
        if (teacher_id) {
          let q = ctx.supabase.from('batches').select('id').eq('teacher_id', teacher_id)
          if (exclude_batch_id) q = q.neq('id', exclude_batch_id)
          const { data: tBatches } = await q
          teacher_conflicts = await collectFromBatches((tBatches ?? []).map((b: any) => b.id))
        }

        let student_conflicts: any[] = []
        if (Array.isArray(student_ids) && student_ids.length) {
          // Normalize: accept profiles.id or user_id, persist user_id in DB.
          const { data: pByUser } = await ctx.supabase
            .from('profiles').select('user_id').in('user_id', student_ids)
          const userIds = new Set<string>((pByUser ?? []).map((p: any) => p.user_id))
          const unknown = student_ids.filter((id) => !userIds.has(id))
          if (unknown.length) {
            const { data: pByProf } = await ctx.supabase
              .from('profiles').select('user_id').in('id', unknown)
            for (const p of pByProf ?? []) userIds.add(p.user_id)
          }
          const normalizedIds = [...userIds]
          let q = ctx.supabase.from('batch_students').select('batch_id, student_id').in('student_id', normalizedIds)
          if (exclude_batch_id) q = q.neq('batch_id', exclude_batch_id)
          const { data: enrollments } = await q
          const ids = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
          student_conflicts = await collectFromBatches(ids)
        }

        result = { teacher_conflicts, student_conflicts }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
