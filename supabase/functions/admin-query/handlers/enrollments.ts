import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_enrollments': {
        let scopedBatchIds: string[] | null = null
        if (ctx.targetOrgId) {
          const { data: ob } = await ctx.supabase.from('batches').select('id').eq('organization_id', ctx.targetOrgId)
          scopedBatchIds = (ob ?? []).map((b: any) => b.id)
          if (scopedBatchIds.length === 0) { result = []; break }
        }
        let enrollQ: any = ctx.supabase.from('batch_students').select('*').order('enrolled_at', { ascending: false })
        if (scopedBatchIds) enrollQ = enrollQ.in('batch_id', scopedBatchIds)
        const { data: enrollments } = await enrollQ
        const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))]
        const batchIds = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))]
        let profiles: any[] = []
        let batches: any[] = []
        if (studentIds.length) {
          const { data } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', studentIds)
          profiles = data ?? []
        }
        if (batchIds.length) {
          const { data } = await ctx.supabase.from('batches').select('id, name, course_id, courses(name)').in('id', batchIds)
          batches = data ?? []
        }
        const pMap: Record<string, any> = {}
        for (const p of profiles) pMap[p.user_id] = p
        const bMap: Record<string, any> = {}
        for (const b of batches) bMap[b.id] = b
        result = (enrollments ?? []).map((e: any) => ({
          ...e,
          student_profile: pMap[e.student_id] || null,
          batch: bMap[e.batch_id] || null,
        }))
        break
      }
      case 'list_teachers':
      case 'list_all_students': {
        if (!ctx.callerUserId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const isSuperadmin = ctx.callerIsSuperadmin
        // Authoritative org scope: always use the upstream-resolved ctx.targetOrgId
        // (validated against the caller's memberships). Never fall back to
        // "first joined org" — that's exactly what was leaking other orgs.
        const callerOrgId: string | null = ctx.targetOrgId
        const applyOrgScope = !isSuperadmin || !!ctx.targetOrgId

        // Determine candidate user_ids based on role + org scope
        const wantTeachers = action === 'list_teachers'
        const targetRole = wantTeachers ? 'teacher' : 'student'

        // Base: all users with the target role
        const { data: roleRows } = await ctx.supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', targetRole)
        let candidateIds = new Set<string>((roleRows ?? []).map((r: any) => r.user_id))

        if (applyOrgScope) {
          if (!callerOrgId) { result = []; break }

          if (wantTeachers) {
            // Teachers in org: members of the org + teachers assigned to any batch in the org
            const orgIds = new Set<string>()
            const { data: members } = await ctx.supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', callerOrgId)
            for (const m of members ?? []) orgIds.add(m.user_id)
            const { data: orgBatches } = await ctx.supabase
              .from('batches')
              .select('teacher_id')
              .eq('organization_id', callerOrgId)
            for (const b of orgBatches ?? []) if (b.teacher_id) orgIds.add(b.teacher_id)
            candidateIds = new Set([...candidateIds].filter((id) => orgIds.has(id)))
          } else {
            // Students in org: anyone enrolled in any batch belonging to the org
            const { data: orgBatches } = await ctx.supabase
              .from('batches')
              .select('id')
              .eq('organization_id', callerOrgId)
            const batchIds = (orgBatches ?? []).map((b: any) => b.id)
            const orgStudentIds = new Set<string>()
            if (batchIds.length > 0) {
              const { data: enrollRows } = await ctx.supabase
                .from('batch_students')
                .select('student_id')
                .in('batch_id', batchIds)
              // batch_students.student_id stores auth user_id
              for (const r of enrollRows ?? []) orgStudentIds.add(r.student_id)
            }
            // Also include students who are explicit org members (e.g. created in org but not yet enrolled)
            const { data: members } = await ctx.supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', callerOrgId)
            for (const m of members ?? []) {
              if (candidateIds.has(m.user_id)) orgStudentIds.add(m.user_id)
            }
            candidateIds = new Set([...candidateIds].filter((id) => orgStudentIds.has(id)))
          }
        }

        const ids = [...candidateIds]
        if (ids.length === 0) { result = []; break }

        if (action === 'list_teachers' || action === 'list_all_students') {
          // Optionally hide teachers already assigned to any batch in this org
          // (used by the "Assign Teacher" dialog so admins pick from free ones).
          if (action === 'list_teachers' && params?.exclude_assigned && callerOrgId) {
            const { data: assigned } = await ctx.supabase
              .from('batches')
              .select('teacher_id')
              .eq('organization_id', callerOrgId)
              .not('teacher_id', 'is', null)
            const assignedSet = new Set<string>((assigned ?? []).map((r: any) => r.teacher_id))
            // keep the teacher currently assigned to *this* batch (so the dialog
            // can pre-select / re-pick them); plus all unassigned teachers.
            let keepBatchTeacher: string | null = null
            if (params?.batch_id) {
              const { data: b } = await ctx.supabase
                .from('batches').select('teacher_id').eq('id', params.batch_id).maybeSingle()
              keepBatchTeacher = b?.teacher_id ?? null
            }
            const filtered = [...candidateIds].filter(
              (id) => !assignedSet.has(id) || id === keepBatchTeacher
            )
            candidateIds = new Set(filtered)
          }
          const finalIds = [...candidateIds]
          if (finalIds.length === 0) { result = []; break }
          const { data: profiles } = await ctx.supabase
            .from('profiles')
            .select('id, user_id, display_name, email')
            .in('user_id', finalIds)
          result = profiles ?? []
          break
        }

        // list_students_with_batches
        const { data: profiles } = await ctx.supabase.from('profiles').select('*').in('user_id', ids)
        const { data: enrollments } = await ctx.supabase
          .from('batch_students')
          .select('student_id, batch_id, batches(name, organization_id, courses(name))')
          .in('student_id', ids)
        const enrollMap: Record<string, any[]> = {}
        for (const e of (enrollments ?? []) as any[]) {
          // Restrict enrollments to the scoped org (admin's org, or SuperAdmin's picked org)
          if (applyOrgScope && callerOrgId && e.batches?.organization_id !== callerOrgId) continue
          if (!enrollMap[e.student_id]) enrollMap[e.student_id] = []
          enrollMap[e.student_id].push(e)
        }
        result = (profiles ?? []).map((p: any) => ({ ...p, enrollments: enrollMap[p.user_id] || [] }))
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
