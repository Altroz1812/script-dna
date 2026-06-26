import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'get_stats': {
        // Read from precomputed dashboard tables; no joins/aggregation on hot path.
        if (ctx.targetOrgId) {
          const { data: row } = await ctx.supabase
            .from('org_dashboard_stats')
            .select('*')
            .eq('organization_id', ctx.targetOrgId)
            .maybeSingle()
          result = {
            totalUsers: row?.total_members ?? 0,
            totalCourses: row?.total_courses ?? 0,
            totalBatches: row?.total_batches ?? 0,
            totalOrgs: 1,
            totalLeads: row?.total_leads ?? 0,
            totalPayments: row?.total_payments ?? 0,
            roleCounts: row?.role_counts ?? {},
          }
        } else {
          // SuperAdmin global view: use legacy dashboard_stats singleton row.
          const { data: row } = await ctx.supabase
            .from('dashboard_stats').select('*').eq('id', 1).maybeSingle()
          result = {
            totalUsers: row?.total_users ?? 0,
            totalCourses: row?.total_courses ?? 0,
            totalBatches: row?.total_batches ?? 0,
            totalOrgs: row?.total_orgs ?? 0,
            totalLeads: row?.total_leads ?? 0,
            totalPayments: row?.total_payments ?? 0,
            roleCounts: row?.role_counts ?? {},
          }
        }
        break
      }
      case 'get_teacher_dashboard': {
        const teacherId = params?.teacher_id || ctx.callerUserId
        const { data: row } = await ctx.supabase
          .from('teacher_dashboard_stats').select('*').eq('teacher_id', teacherId).maybeSingle()
        result = {
          batchCount: row?.batch_count ?? 0,
          studentCount: row?.student_count ?? 0,
          upcomingClassCount: row?.upcoming_class_count ?? 0,
          pendingSubmissions: row?.pending_submissions ?? 0,
        }
        break
      }
      case 'get_student_dashboard': {
        const studentId = params?.student_id || ctx.callerUserId
        const { data: row } = await ctx.supabase
          .from('student_dashboard_stats').select('*').eq('student_id', studentId).maybeSingle()
        result = {
          enrolledCourses: row?.enrolled_courses ?? 0,
          enrolledBatches: row?.enrolled_batches ?? 0,
          upcomingClassCount: row?.upcoming_class_count ?? 0,
          recentSubmissionCount: row?.recent_submission_count ?? 0,
          avgCompletionPct: row?.avg_completion_pct ?? 0,
          certificateCount: row?.certificate_count ?? 0,
        }
        break
      }
      case 'get_parent_dashboard': {
        const parentId = params?.parent_id || ctx.callerUserId
        const { data: row } = await ctx.supabase
          .from('parent_dashboard_stats').select('*').eq('parent_id', parentId).maybeSingle()
        result = {
          childrenCount: row?.children_count ?? 0,
          avgCompletionPct: row?.avg_completion_pct ?? 0,
          recentPaymentCount: row?.recent_payment_count ?? 0,
          upcomingClassCount: row?.upcoming_class_count ?? 0,
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
      case 'metric_breakdown': {
        // Cheap per-window counts for drill-down. Uses head:true count requests
        // (no row payload) plus a single created_at filter — touches indexes only.
        const metric: string = String(params?.metric || '')
        const orgFilter = (q: any) => (ctx.targetOrgId ? q.eq('organization_id', ctx.targetOrgId) : q)

        const now = new Date()
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
        const start7 = new Date(now.getTime() - 7 * 86400_000)
        const start30 = new Date(now.getTime() - 30 * 86400_000)
        const start90 = new Date(now.getTime() - 90 * 86400_000)

        // Resolve the source table + optional role filter for the requested metric.
        const sources: Record<string, { table: string; scopeOrg: boolean; extra?: (q: any) => any }> = {
          users:         { table: 'profiles',             scopeOrg: true },
          students:      { table: 'profiles',             scopeOrg: true,  extra: (q) => q.eq('role', 'student') },
          teachers:      { table: 'profiles',             scopeOrg: true,  extra: (q) => q.eq('role', 'teacher') },
          courses:       { table: 'courses',              scopeOrg: true },
          batches:       { table: 'batches',              scopeOrg: true },
          organizations: { table: 'organizations',        scopeOrg: false },
          leads:         { table: 'leads',                scopeOrg: true },
          payments:      { table: 'payments',             scopeOrg: true },
        }
        const src = sources[metric]
        if (!src) { result = { error: 'unknown_metric', metric, windows: [] }; break }

        const build = (since?: Date) => {
          let q: any = ctx.supabase.from(src.table).select('id', { count: 'exact', head: true })
          if (src.scopeOrg) q = orgFilter(q)
          if (src.extra) q = src.extra(q)
          if (since) q = q.gte('created_at', since.toISOString())
          return q
        }

        const [allRes, todayRes, w7Res, w30Res, w90Res] = await Promise.all([
          build(),
          build(startOfToday),
          build(start7),
          build(start30),
          build(start90),
        ])

        const windows = [
          { key: 'today',  label: 'Today',     count: todayRes.count ?? 0 },
          { key: '7d',     label: 'Last 7 days',  count: w7Res.count ?? 0 },
          { key: '30d',    label: 'Last 30 days', count: w30Res.count ?? 0 },
          { key: '90d',    label: 'Last 90 days', count: w90Res.count ?? 0 },
          { key: 'all',    label: 'All time',     count: allRes.count ?? 0 },
        ]

        // Optional: payments → also surface revenue per window (sum amount where paid/completed).
        let extras: any = null
        if (metric === 'payments') {
          const sumIn = async (since?: Date) => {
            let q: any = ctx.supabase.from('payments').select('amount, status, created_at')
            q = orgFilter(q)
            if (since) q = q.gte('created_at', since.toISOString())
            const { data } = await q
            const rows = (data ?? []).filter((p: any) => p.status === 'paid' || p.status === 'completed')
            return rows.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          }
          const [rAll, rT, r7, r30, r90] = await Promise.all([
            sumIn(), sumIn(startOfToday), sumIn(start7), sumIn(start30), sumIn(start90),
          ])
          extras = { revenue: { today: rT, w7: r7, w30: r30, w90: r90, all: rAll } }
        }

        // Role split for users/students/teachers helps the drill-down show composition.
        if (metric === 'users') {
          const { data: roles } = await ctx.supabase.from('user_roles').select('role, user_id')
          const roleCounts: Record<string, number> = {}
          for (const r of roles ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
          extras = { ...(extras || {}), roleCounts }
        }

        result = { metric, windows, extras }
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
        const orgIds = list.map((o: any) => o.id)
        if (orgIds.length === 0) { result = []; break }

        // One round-trip per dimension instead of one per org. Counts are
        // grouped client-side from the (cheap) id-only rows.
        const [membersR, coursesR, batchesR, paymentsR] = await Promise.all([
          ctx.supabase.from('organization_members').select('organization_id').in('organization_id', orgIds),
          ctx.supabase.from('courses').select('organization_id').in('organization_id', orgIds),
          ctx.supabase.from('batches').select('organization_id').in('organization_id', orgIds),
          ctx.supabase.from('payments').select('organization_id, amount, status').in('organization_id', orgIds),
        ])

        const tally = (rows: any[] | null | undefined) => {
          const m: Record<string, number> = {}
          for (const r of rows ?? []) m[r.organization_id] = (m[r.organization_id] ?? 0) + 1
          return m
        }
        const memberCounts = tally(membersR.data)
        const courseCounts = tally(coursesR.data)
        const batchCounts = tally(batchesR.data)

        const revenueByOrg: Record<string, number> = {}
        for (const p of paymentsR.data ?? []) {
          if (p.status !== 'completed') continue
          revenueByOrg[p.organization_id] = (revenueByOrg[p.organization_id] ?? 0) + (Number(p.amount) || 0)
        }

        result = list.map((o: any) => ({
          id: o.id,
          name: o.name,
          is_active: o.is_active,
          members: memberCounts[o.id] ?? 0,
          courses: courseCounts[o.id] ?? 0,
          batches: batchCounts[o.id] ?? 0,
          revenue: revenueByOrg[o.id] ?? 0,
        }))
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
