import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

const DEFAULTS = {
  max_participants: 400,
  active_speaker_gate: 12,
  rolling_window_size: 6,
  non_speaker_video_enabled: false,
}

function assertAdmin(ctx: HandlerCtx, orgId?: string | null) {
  if (ctx.callerIsSuperadmin) return
  if (!(ctx.callerIsAdmin || ctx.callerIsSupport)) {
    throw new Error('Forbidden: admin role required')
  }
  if (orgId && !ctx.callerOrgMemberships.includes(orgId)) {
    throw new Error('Forbidden: not a member of target organization')
  }
}

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
    case 'list_classroom_settings': {
      const orgId = params?.organization_id ?? ctx.targetOrgId
      assertAdmin(ctx, orgId)
      const { data, error } = await ctx.supabase
        .from('classroom_settings')
        .select('*, batches(id, batch_name, meeting_room)')
        .eq('organization_id', orgId)
        .order('batch_id', { nullsFirst: true })
      if (error) throw error
      result = data ?? []
      break
    }
    case 'upsert_classroom_settings': {
      const {
        organization_id,
        batch_id = null,
        max_participants,
        active_speaker_gate,
        rolling_window_size,
        non_speaker_video_enabled,
      } = params ?? {}
      const orgId = organization_id ?? ctx.targetOrgId
      assertAdmin(ctx, orgId)
      if (!orgId) throw new Error('organization_id required')

      const payload: Record<string, any> = {
        organization_id: orgId,
        batch_id,
        max_participants: clampInt(max_participants, DEFAULTS.max_participants, 2, 500),
        active_speaker_gate: clampInt(active_speaker_gate, DEFAULTS.active_speaker_gate, 2, 500),
        rolling_window_size: clampInt(rolling_window_size, DEFAULTS.rolling_window_size, 1, 50),
        non_speaker_video_enabled: !!non_speaker_video_enabled,
        updated_by: ctx.callerUserId,
      }

      // Manual upsert keyed on (org, batch_id) since the unique index uses COALESCE.
      const existingQuery = ctx.supabase
        .from('classroom_settings')
        .select('id')
        .eq('organization_id', orgId)
        .limit(1)
      const existing = batch_id
        ? await existingQuery.eq('batch_id', batch_id)
        : await existingQuery.is('batch_id', null)
      if (existing.error) throw existing.error

      if (existing.data && existing.data[0]) {
        const { error } = await ctx.supabase
          .from('classroom_settings')
          .update(payload)
          .eq('id', existing.data[0].id)
        if (error) throw error
        result = { id: existing.data[0].id, ...payload }
      } else {
        const { data, error } = await ctx.supabase
          .from('classroom_settings')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        result = data
      }
      break
    }
    case 'delete_classroom_settings': {
      const { id } = params ?? {}
      if (!id) throw new Error('id required')
      const { data: row } = await ctx.supabase
        .from('classroom_settings')
        .select('organization_id')
        .eq('id', id)
        .maybeSingle()
      assertAdmin(ctx, row?.organization_id ?? null)
      const { error } = await ctx.supabase.from('classroom_settings').delete().eq('id', id)
      if (error) throw error
      result = { success: true }
      break
    }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}

function clampInt(v: any, fallback: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}