// Auto-generated handler module. Do not hand-edit case bodies; edit the
// originating logic and re-run the splitter if you need to regenerate.
import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'get_stats': {
        const scope = <T extends any>(q: T): T => (ctx.targetOrgId ? (q as any).eq('organization_id', ctx.targetOrgId) : q)
        const [profiles, courses, batches, orgs, leads, payments] = await Promise.all([
          scope(ctx.supabase.from('profiles').select('id', { count: 'exact', head: true })),
          scope(ctx.supabase.from('courses').select('id', { count: 'exact', head: true })),
          scope(ctx.supabase.from('batches').select('id', { count: 'exact', head: true })),
          ctx.supabase.from('organizations').select('id', { count: 'exact', head: true }),
          scope(ctx.supabase.from('leads').select('id', { count: 'exact', head: true })),
          scope(ctx.supabase.from('payments').select('id', { count: 'exact', head: true })),
        ])
        const roleCounts: Record<string, number> = {}
        if (ctx.targetOrgId) {
          const { data: members } = await ctx.supabase
            .from('organization_members').select('user_id').eq('organization_id', ctx.targetOrgId)
          const memberIds = (members ?? []).map((m: any) => m.user_id)
          if (memberIds.length) {
            const { data: roles } = await ctx.supabase
              .from('user_roles').select('role').in('user_id', memberIds)
            for (const r of roles ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
          }
        } else {
          const roles = await ctx.supabase.from('user_roles').select('role')
          for (const r of roles.data ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
        }
        result = {
          totalUsers: profiles.count ?? 0,
          totalCourses: courses.count ?? 0,
          totalBatches: batches.count ?? 0,
          totalOrgs: orgs.count ?? 0,
          totalLeads: leads.count ?? 0,
          totalPayments: payments.count ?? 0,
          roleCounts,
        }
        break
      }
      case 'system_health': {
        const orgFilter = (q: any) => (ctx.targetOrgId ? q.eq('organization_id', ctx.targetOrgId) : q)
        const [
          usersRes, coursesRes, batchesRes, orgsRes, paymentsRes, leadsRes,
          rolesRes, logsRes, loginsRes, subsRes, couponsRes, modulesRes, lessonsRes
        ] = await Promise.all([
          orgFilter(ctx.supabase.from('profiles').select('id', { count: 'exact', head: true })),
          orgFilter(ctx.supabase.from('courses').select('id', { count: 'exact', head: true })),
          orgFilter(ctx.supabase.from('batches').select('id', { count: 'exact', head: true })),
          ctx.supabase.from('organizations').select('id, is_active', { count: 'exact' }),
          orgFilter(ctx.supabase.from('payments').select('id, amount, status', { count: 'exact' })),
          orgFilter(ctx.supabase.from('leads').select('id', { count: 'exact', head: true })),
          ctx.supabase.from('user_roles').select('role'),
          ctx.supabase.from('activity_logs').select('id', { count: 'exact', head: true }),
          ctx.callerIsSuperadmin
            ? ctx.supabase.from('login_attempts').select('id, success, attempted_at').order('attempted_at', { ascending: false }).limit(100)
            : Promise.resolve({ data: [] as any[], count: 0 }),
          ctx.targetOrgId
            ? ctx.supabase.from('org_subscriptions').select('id, status', { count: 'exact' }).eq('organization_id', ctx.targetOrgId)
            : ctx.supabase.from('org_subscriptions').select('id, status', { count: 'exact' }),
          orgFilter(ctx.supabase.from('coupons').select('id, is_active', { count: 'exact' })),
          ctx.supabase.from('course_modules').select('id', { count: 'exact', head: true }),
          ctx.supabase.from('lessons').select('id', { count: 'exact', head: true }),
        ])

        // Role distribution
        const roleCounts: Record<string, number> = {}
        for (const r of rolesRes.data ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1

        // Active vs inactive orgs
        const activeOrgs = (orgsRes.data ?? []).filter((o: any) => o.is_active).length
        const inactiveOrgs = (orgsRes.data ?? []).filter((o: any) => !o.is_active).length

        // Payment totals
        const completedPayments = (paymentsRes.data ?? []).filter((p: any) => p.status === 'completed')
        const totalRevenue = completedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
        const pendingPayments = (paymentsRes.data ?? []).filter((p: any) => p.status === 'pending').length

        // Login success rate (last 100)
        const logins = loginsRes.data ?? []
        const successLogins = logins.filter((l: any) => l.success).length
        const failedLogins = logins.filter((l: any) => !l.success).length

        // Active subscriptions
        const activeSubs = (subsRes.data ?? []).filter((s: any) => s.status === 'active').length
        const activeCoupons = (couponsRes.data ?? []).filter((c: any) => c.is_active).length

        result = {
          counts: {
            users: usersRes.count ?? 0,
            courses: coursesRes.count ?? 0,
            batches: batchesRes.count ?? 0,
            organizations: orgsRes.count ?? 0,
            leads: leadsRes.count ?? 0,
            payments: paymentsRes.count ?? 0,
            activityLogs: logsRes.count ?? 0,
            modules: modulesRes.count ?? 0,
            lessons: lessonsRes.count ?? 0,
          },
          roleCounts,
          orgHealth: { active: activeOrgs, inactive: inactiveOrgs },
          revenue: { total: totalRevenue, pendingCount: pendingPayments },
          loginHealth: { total: logins.length, success: successLogins, failed: failedLogins },
          subscriptions: { active: activeSubs, total: subsRes.count ?? 0 },
          coupons: { active: activeCoupons, total: couponsRes.count ?? 0 },
          timestamp: new Date().toISOString(),
        }
        break
      }
      case 'revenue_analytics': {
        const orgFilter = (q: any) => (ctx.targetOrgId ? q.eq('organization_id', ctx.targetOrgId) : q)
        const since = new Date()
        since.setMonth(since.getMonth() - 11)
        since.setDate(1)
        const { data: payments } = await orgFilter(
          ctx.supabase.from('payments').select('amount, status, created_at').gte('created_at', since.toISOString())
        )
        const rows = payments ?? []
        const completed = rows.filter((p: any) => p.status === 'completed')
        const pending = rows.filter((p: any) => p.status === 'pending')
        const monthlyRevenue: Record<string, number> = {}
        // Seed last 12 months with 0
        for (let i = 0; i < 12; i++) {
          const d = new Date(since)
          d.setMonth(since.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthlyRevenue[key] = 0
        }
        for (const p of completed) {
          const d = new Date(p.created_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthlyRevenue) monthlyRevenue[key] += Number(p.amount) || 0
        }
        result = {
          totalRevenue: completed.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
          totalTransactions: completed.length,
          pendingRevenue: pending.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
          monthlyRevenue,
        }
        break
      }
      case 'org_performance': {
        // SuperAdmin sees all orgs; tenant-scoped users see only their active org.
        let orgQuery = ctx.supabase.from('organizations').select('id, name, is_active')
        if (ctx.targetOrgId) orgQuery = orgQuery.eq('id', ctx.targetOrgId)
        const { data: orgs } = await orgQuery
        const list = orgs ?? []
        const out: any[] = []
        for (const o of list) {
          const [membersR, coursesR, batchesR, paymentsR] = await Promise.all([
            ctx.supabase.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', o.id),
            ctx.supabase.from('courses').select('id', { count: 'exact', head: true }).eq('organization_id', o.id),
            ctx.supabase.from('batches').select('id', { count: 'exact', head: true }).eq('organization_id', o.id),
            ctx.supabase.from('payments').select('amount, status').eq('organization_id', o.id),
          ])
          const revenue = (paymentsR.data ?? [])
            .filter((p: any) => p.status === 'completed')
            .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          out.push({
            id: o.id,
            name: o.name,
            is_active: o.is_active,
            members: membersR.count ?? 0,
            courses: coursesR.count ?? 0,
            batches: batchesR.count ?? 0,
            revenue,
          })
        }
        result = out
        break
      }
      case 'student_trends': {
        const orgFilter = (q: any) => (ctx.targetOrgId ? q.eq('organization_id', ctx.targetOrgId) : q)
        const since = new Date()
        since.setMonth(since.getMonth() - 5)
        since.setDate(1)
        const sinceDate = since.toISOString().slice(0, 10)
        const { data: attendance } = await orgFilter(
          ctx.supabase.from('attendance').select('status, date').gte('date', sinceDate)
        )
        const monthlyAttendance: Record<string, { present: number; total: number }> = {}
        for (let i = 0; i < 6; i++) {
          const d = new Date(since)
          d.setMonth(since.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthlyAttendance[key] = { present: 0, total: 0 }
        }
        for (const a of attendance ?? []) {
          const d = new Date(a.date)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (!(key in monthlyAttendance)) continue
          monthlyAttendance[key].total += 1
          if (a.status === 'present') monthlyAttendance[key].present += 1
        }
        const { data: progress } = await orgFilter(
          ctx.supabase.from('student_progress').select('status, completion_pct')
        )
        const prows = progress ?? []
        const total = prows.length
        const completed = prows.filter((p: any) => p.status === 'completed').length
        const inProgress = prows.filter((p: any) => p.status !== 'completed').length
        const avgCompletion = total > 0
          ? prows.reduce((s: number, p: any) => s + Number(p.completion_pct || 0), 0) / total
          : 0
        result = {
          monthlyAttendance,
          progressSummary: { total, completed, inProgress, avgCompletion },
        }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
