// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_leads': {
        let q: any = ctx.supabase.from('leads').select('*').order('created_at', { ascending: false })
        if (ctx.targetOrgId) q = q.eq('organization_id', ctx.targetOrgId)
        const { data } = await q
        result = data ?? []
        break
      }
      case 'get_support_overview': {
        const leadsQ = ctx.supabase.from('leads').select('id', { count: 'exact', head: true })
        const paymentsQ = ctx.supabase.from('payments').select('id, status')
        let leadsCount = 0
        let enrollmentsCount = 0
        let openPayments = 0
        if (ctx.targetOrgId) {
          const [{ count: lc }, { data: ob }] = await Promise.all([
            leadsQ.eq('organization_id', ctx.targetOrgId),
            ctx.supabase.from('batches').select('id').eq('organization_id', ctx.targetOrgId),
          ])
          leadsCount = lc ?? 0
          const batchIds = (ob ?? []).map((b: any) => b.id)
          if (batchIds.length > 0) {
            const { count: ec } = await ctx.supabase
              .from('batch_students')
              .select('id', { count: 'exact', head: true })
              .in('batch_id', batchIds)
            enrollmentsCount = ec ?? 0
          }
          const { data: pays } = await paymentsQ
          openPayments = (pays ?? []).filter((p: any) => p.status === 'pending').length
        } else {
          const [{ count: lc }, { count: ec }, { data: pays }] = await Promise.all([
            leadsQ,
            ctx.supabase.from('batch_students').select('id', { count: 'exact', head: true }),
            paymentsQ,
          ])
          leadsCount = lc ?? 0
          enrollmentsCount = ec ?? 0
          openPayments = (pays ?? []).filter((p: any) => p.status === 'pending').length
        }
        result = { totalLeads: leadsCount, totalEnrollments: enrollmentsCount, openPayments }
        break
      }
      case 'create_lead': {
        const row = { ...params }
        if (!row.organization_id && ctx.targetOrgId) row.organization_id = ctx.targetOrgId
        const { data, error } = await ctx.supabase.from('leads').insert(row).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'update_lead': {
        const { id, ...updates } = params
        if (!ctx.callerIsSuperadmin) delete (updates as any).organization_id
        const { error } = await ctx.supabase.from('leads').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_lead': {
        const { error } = await ctx.supabase.from('leads').delete().eq('id', params.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'approve_lead': {
        const { id, allow_partial } = params as { id: string; allow_partial?: boolean }
        if (!id) throw new Error('id required')
        if (!ctx.callerIsSuperadmin && !ctx.callerIsAdmin) {
          throw new Error('Only admins can approve leads')
        }
        const { data: lead, error: leadErr } = await ctx.supabase
          .from('leads').select('*').eq('id', id).maybeSingle()
        if (leadErr) throw leadErr
        if (!lead) throw new Error('Lead not found')
        if (!ctx.callerIsSuperadmin && lead.organization_id && !ctx.callerOrgMemberships.includes(lead.organization_id)) {
          throw new Error('Forbidden: lead belongs to another organization')
        }
        const meta: any = lead.metadata ?? {}
        const students: any[] = Array.isArray(meta.students) ? meta.students : []
        if (students.length === 0) throw new Error('No student details on lead')

        // Payment gate: require recorded payments to cover final_amount unless
        // caller explicitly allows partial approval.
        const payments: any[] = Array.isArray(meta.payments) ? meta.payments : []
        const totalDue = Number(meta.final_amount ?? 0)
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
        const paymentStatus = totalDue <= 0
          ? 'unpaid'
          : (totalPaid >= totalDue ? 'full' : (totalPaid > 0 ? 'partial' : 'unpaid'))
        if (paymentStatus !== 'full' && !allow_partial) {
          throw new Error(
            `Payment not confirmed. Recorded ₹${totalPaid.toFixed(0)} of ₹${totalDue.toFixed(0)}. ` +
            'Record full payment or check "Approve with partial payment".'
          )
        }

        const orgId = lead.organization_id ?? ctx.targetOrgId ?? null
        const created: any[] = []
        const enrolled: any[] = []
        // Generate org-prefixed Student IDs (e.g. SUN-482917); password = ID.
        let orgPrefix = 'STU'
        if (orgId) {
          const { data: orgRow } = await ctx.supabase
            .from('organizations').select('slug, name').eq('id', orgId).maybeSingle()
          const src = (orgRow?.slug || orgRow?.name || 'STU') as string
          const cleaned = src.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
          if (cleaned.length >= 2) orgPrefix = cleaned
        }
        const SYNTHETIC_DOMAIN = 'students.aurapen.local'
        const genDigits = (n: number) => {
          let s = ''
          for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString()
          return s
        }
        const generateUniqueStudentId = async (): Promise<string> => {
          for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = `${orgPrefix}-${genDigits(6)}`
            const { data: dup } = await ctx.supabase
              .from('profiles').select('user_id').eq('student_login_id', candidate).maybeSingle()
            if (!dup) return candidate
          }
          throw new Error('Could not generate unique student ID')
        }
        for (let idx = 0; idx < students.length; idx++) {
          const s = students[idx]
          if (!s?.name) continue
          const studentLoginId = await generateUniqueStudentId()
          const childEmail = `${studentLoginId.toLowerCase()}@${SYNTHETIC_DOMAIN}`
          const tempPassword = studentLoginId // password equals ID
          const { data: authData, error: authError } = await ctx.supabase.auth.admin.createUser({
            email: childEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { display_name: s.name, student_login_id: studentLoginId },
          })
          if (authError) {
            console.error('createUser failed', authError.message)
            continue
          }
          const newUserId = authData.user.id
          await ctx.supabase.from('profiles')
            .update({
              display_name: s.name,
              organization_id: orgId,
              student_login_id: studentLoginId,
              email: childEmail,
            })
            .eq('user_id', newUserId)
          // Ensure role = student (trigger already inserts 'student', but be safe)
          const { data: existingRole } = await ctx.supabase
            .from('user_roles').select('id').eq('user_id', newUserId).maybeSingle()
          if (!existingRole) {
            await ctx.supabase.from('user_roles').insert({ user_id: newUserId, role: 'student' })
          }
          if (orgId) {
            await ctx.supabase.from('organization_members')
              .insert({ organization_id: orgId, user_id: newUserId })
              .select().maybeSingle().then(() => {}, () => {})
          }
          // Link parent → child if we know the parent user id.
          if (meta.parent_user_id) {
            await ctx.supabase.from('parent_children').insert({
              parent_id: meta.parent_user_id, child_id: newUserId,
            }).then(() => {}, () => {})
          }
          // Enroll into batch
          if (s.batch_id) {
            const { error: enrollErr } = await ctx.supabase.from('batch_students').insert({
              batch_id: s.batch_id, student_id: newUserId,
            })
            if (!enrollErr) enrolled.push({ student_id: newUserId, batch_id: s.batch_id })
          }
          created.push({
            student_id: newUserId,
            name: s.name,
            email: childEmail,
            student_login_id: studentLoginId,
            temp_password: tempPassword,
            batch_id: s.batch_id ?? null,
          })
        }

        // Materialize recorded lead payments into the payments table now that
        // we have real student rows. Each recorded payment is attached to the
        // first created student with a description tagging the lead + mode.
        const paymentRows: any[] = []
        if (created.length > 0 && payments.length > 0) {
          const anchorStudentId = created[0].student_id
          for (const p of payments) {
            const amt = Number(p.amount || 0)
            if (!(amt > 0)) continue
            const desc = [
              `Lead ${id.slice(0, 8)}`,
              p.mode ? `via ${p.mode}` : null,
              p.reference ? `ref ${p.reference}` : null,
              p.notes || null,
            ].filter(Boolean).join(' · ')
            const { data: pay, error: payErr } = await ctx.supabase.from('payments').insert({
              student_id: anchorStudentId,
              organization_id: orgId,
              amount: amt,
              currency: 'INR',
              status: 'completed',
              payment_date: p.date || new Date().toISOString().slice(0, 10),
              description: desc,
            }).select().maybeSingle()
            if (!payErr && pay) paymentRows.push(pay)
          }
        }

        await ctx.supabase.from('leads')
          .update({
            status: 'converted',
            metadata: {
              ...meta,
              approved_at: new Date().toISOString(),
              created_students: created,
              payment_status: paymentStatus,
              total_paid: totalPaid,
              payment_rows_created: paymentRows.length,
            },
          })
          .eq('id', id)
        result = {
          success: true,
          created_count: created.length,
          enrolled_count: enrolled.length,
          payments_created: paymentRows.length,
          payment_status: paymentStatus,
          total_paid: totalPaid,
          total_due: totalDue,
          created,
        }
        break
      }
      case 'record_lead_payment': {
        const { id, amount, mode, reference, date, notes } = params as {
          id: string; amount: number; mode: string;
          reference?: string; date?: string; notes?: string;
        }
        if (!id) throw new Error('id required')
        if (!(Number(amount) > 0)) throw new Error('amount must be > 0')
        if (!mode) throw new Error('mode required')
        if (!ctx.callerIsSuperadmin && !ctx.callerIsAdmin && !ctx.callerIsSupport) {
          throw new Error('Only admins / support can record lead payments')
        }
        const { data: lead, error: leadErr } = await ctx.supabase
          .from('leads').select('id, organization_id, metadata, status').eq('id', id).maybeSingle()
        if (leadErr) throw leadErr
        if (!lead) throw new Error('Lead not found')
        if (!ctx.callerIsSuperadmin && lead.organization_id && !ctx.callerOrgMemberships.includes(lead.organization_id)) {
          throw new Error('Forbidden: lead belongs to another organization')
        }
        const meta: any = lead.metadata ?? {}
        const existing: any[] = Array.isArray(meta.payments) ? meta.payments : []
        const entry = {
          id: crypto.randomUUID(),
          amount: Number(amount),
          mode: String(mode),
          reference: reference ?? null,
          date: date || new Date().toISOString().slice(0, 10),
          notes: notes ?? null,
          recorded_at: new Date().toISOString(),
          recorded_by: userId,
        }
        const nextPayments = [...existing, entry]
        const totalDue = Number(meta.final_amount ?? 0)
        const totalPaid = nextPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
        const paymentStatus = totalDue <= 0
          ? 'unpaid'
          : (totalPaid >= totalDue ? 'full' : (totalPaid > 0 ? 'partial' : 'unpaid'))
        const { error: upErr } = await ctx.supabase.from('leads').update({
          metadata: { ...meta, payments: nextPayments, total_paid: totalPaid, payment_status: paymentStatus },
        }).eq('id', id)
        if (upErr) throw upErr
        result = { success: true, total_paid: totalPaid, total_due: totalDue, payment_status: paymentStatus, entry }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
