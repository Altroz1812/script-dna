import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_activity_logs': {
        let scopedUserIds: string[] | null = null
        if (ctx.targetOrgId) {
          const { data: members } = await ctx.supabase
            .from('organization_members').select('user_id').eq('organization_id', ctx.targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { activity_logs: [], login_attempts: [] }; break }
        }
        // Show all activity rows. System/trigger rows have user_id = null and are surfaced as "System".
        let actQ: any = ctx.supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500)
        if (scopedUserIds) actQ = actQ.or(`user_id.in.(${scopedUserIds.join(',')}),user_id.is.null`)
        const [activityRes, loginRes] = await Promise.all([
          actQ,
          (ctx.callerIsSuperadmin || !ctx.targetOrgId)
            ? ctx.supabase.from('login_attempts').select('*').order('attempted_at', { ascending: false }).limit(200)
            : Promise.resolve({ data: [] as any[] }),
        ])
        const userIds = [...new Set((activityRes.data ?? []).map((a: any) => a.user_id).filter(Boolean))]
        let profileMap: Record<string, { name: string; email: string }> = {}
        if (userIds.length) {
          const { data: profs } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
          for (const p of profs ?? []) profileMap[p.user_id] = { name: p.display_name || p.email || 'Unknown', email: p.email || '—' }
        }
        const enrichedLogs = (activityRes.data ?? []).map((a: any) => ({
          ...a,
          user_name: a.user_id ? (profileMap[a.user_id]?.name || 'Unknown') : 'System',
          user_email: a.user_id ? (profileMap[a.user_id]?.email || '—') : '—',
        }))
        result = { activity_logs: enrichedLogs, login_attempts: loginRes.data ?? [] }
        break
      }
      case 'list_active_sessions': {
        const sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        let scopedUserIds: string[] | null = null
        if (ctx.targetOrgId) {
          const { data: members } = await ctx.supabase
            .from('organization_members').select('user_id').eq('organization_id', ctx.targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { sessions: [] }; break }
        }
        let q: any = ctx.supabase.from('user_sessions')
          .select('*')
          .is('ended_at', null)
          .gt('last_seen_at', sinceIso)
          .order('last_seen_at', { ascending: false })
          .limit(200)
        if (scopedUserIds) q = q.in('user_id', scopedUserIds)
        const { data: sessions } = await q
        const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id))]
        let profileMap: Record<string, any> = {}
        let roleMap: Record<string, string> = {}
        if (userIds.length) {
          const [{ data: profs }, { data: roles }] = await Promise.all([
            ctx.supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', userIds),
            ctx.supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
          ])
          for (const p of profs ?? []) profileMap[p.user_id] = p
          for (const r of roles ?? []) roleMap[r.user_id] = r.role
        }
        result = {
          sessions: (sessions ?? []).map((s: any) => ({
            ...s,
            user_name: profileMap[s.user_id]?.display_name || profileMap[s.user_id]?.email || 'Unknown',
            user_email: profileMap[s.user_id]?.email || '—',
            avatar_url: profileMap[s.user_id]?.avatar_url || null,
            role: roleMap[s.user_id] || null,
          })),
        }
        break
      }
      case 'list_session_history': {
        const limit = Math.min(Number(params?.limit) || 100, 500)
        let scopedUserIds: string[] | null = null
        if (ctx.targetOrgId) {
          const { data: members } = await ctx.supabase
            .from('organization_members').select('user_id').eq('organization_id', ctx.targetOrgId)
          scopedUserIds = (members ?? []).map((m: any) => m.user_id)
          if (scopedUserIds.length === 0) { result = { sessions: [] }; break }
        }
        let q: any = ctx.supabase.from('user_sessions').select('*')
          .order('started_at', { ascending: false }).limit(limit)
        if (params?.user_id) q = q.eq('user_id', params.user_id)
        if (scopedUserIds) q = q.in('user_id', scopedUserIds)
        const { data: sessions } = await q
        const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id))]
        let profileMap: Record<string, any> = {}
        let roleMap: Record<string, string> = {}
        if (userIds.length) {
          const [{ data: profs }, { data: roles }] = await Promise.all([
            ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds),
            ctx.supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
          ])
          for (const p of profs ?? []) profileMap[p.user_id] = p
          for (const r of roles ?? []) roleMap[r.user_id] = r.role
        }
        result = {
          sessions: (sessions ?? []).map((s: any) => ({
            ...s,
            user_name: profileMap[s.user_id]?.display_name || profileMap[s.user_id]?.email || 'Unknown',
            user_email: profileMap[s.user_id]?.email || '—',
            role: roleMap[s.user_id] || null,
          })),
        }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
