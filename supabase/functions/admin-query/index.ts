import { corsHeaders, jsonResponse, errorResponse } from './_shared/cors.ts'
import { resolveCaller, invalidateCallerCache } from './_shared/context.ts'
import {
  isCacheable,
  cacheKey,
  readFromCache,
  writeToCache,
  invalidateForAction,
} from './_shared/cache.ts'
import { ORG_SCOPED_ACTIONS } from './_shared/guards.ts'
import { HANDLERS } from './registry.ts'
import type { ActionHandler } from './_shared/types.ts'

// Actions that affect roles/memberships and must drop the caller cache so
// the next request reflects the new permissions.
const CALLER_INVALIDATING_ACTIONS = new Set<string>([
  'change_role',
  'add_org_member',
  'remove_org_member',
  'set_user_organizations',
  'delete_user',
  'create_user',
])

// Lazy O(1) dispatch: the first time an action is observed we remember
// which handler owned it. Subsequent calls skip the per-handler walk.
// Bounded by the number of distinct actions (~109), so it never grows.
const actionToHandler = new Map<string, ActionHandler>()

function logTiming(action: string, status: string, ms: number, orgId: string | null) {
  // Single structured log line per request. Cheap, parseable, and makes
  // the next optimization pass data-driven instead of guesswork.
  console.log(JSON.stringify({
    t: 'admin-query',
    action,
    status,
    ms,
    org: orgId ?? 'global',
  }))
}

Deno.serve(async (req) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let actionForLog = 'unknown'
  let orgForLog: string | null = null
  try {
    const body = await req.json()
    const action: string = body.action
    actionForLog = action || 'unknown'
    let params = body.params ?? {}

    // Pull active organization scope. The client (any role) sets
    // `target_org_id` to narrow the request to a single tenant.
    const requestedOrgId: string | null =
      params && typeof params.target_org_id === 'string' ? params.target_org_id : null
    if (params && 'target_org_id' in params) {
      const { target_org_id: _omit, ...rest } = params
      params = rest
    }

    const { ctx, forbiddenOrg } = await resolveCaller(req, requestedOrgId)
    orgForLog = ctx.targetOrgId
    if (forbiddenOrg) {
      logTiming(actionForLog, 'forbidden_org', Date.now() - startedAt, orgForLog)
      return errorResponse('Forbidden: organization not accessible', 403)
    }

    if (!ctx.callerIsSuperadmin && ORG_SCOPED_ACTIONS.has(action) && !ctx.targetOrgId) {
      logTiming(actionForLog, 'no_org_scope', Date.now() - startedAt, orgForLog)
      return errorResponse('Forbidden: no active organization scope', 403)
    }

    // Try cache for read-only hot actions before any DB work.
    const cKey = isCacheable(action)
      ? cacheKey(action, ctx.callerUserId, ctx.targetOrgId, params)
      : null
    if (cKey) {
      const hit = readFromCache(cKey)
      if (hit !== undefined) {
        logTiming(actionForLog, 'cache_hit', Date.now() - startedAt, orgForLog)
        return new Response(JSON.stringify(hit), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        })
      }
    }

    // Dispatch: O(1) via memoized action→handler map, falling back to
    // a one-time walk through HANDLERS for actions we haven't seen.
    const memoed = actionToHandler.get(action)
    if (memoed) {
      const out = await memoed(action, ctx, params)
      if (out instanceof Response) return out
      if (out.handled) {
        if (cKey) writeToCache(action, cKey, out.result)
        invalidateForAction(action, ctx.targetOrgId)
        if (CALLER_INVALIDATING_ACTIONS.has(action)) invalidateCallerCache()
        logTiming(actionForLog, 'ok', Date.now() - startedAt, orgForLog)
        return jsonResponse(out.result)
      }
      // Memoed handler stopped owning this action (hot-reload edge case);
      // drop the entry and fall through to a fresh walk.
      actionToHandler.delete(action)
    }
    for (const handler of HANDLERS) {
      const out = await handler(action, ctx, params)
      if (out instanceof Response) return out
      if (out.handled) {
        actionToHandler.set(action, handler)
        if (cKey) writeToCache(action, cKey, out.result)
        invalidateForAction(action, ctx.targetOrgId)
        if (CALLER_INVALIDATING_ACTIONS.has(action)) invalidateCallerCache()
        logTiming(actionForLog, 'ok', Date.now() - startedAt, orgForLog)
        return jsonResponse(out.result)
      }
    }

    logTiming(actionForLog, 'unknown_action', Date.now() - startedAt, orgForLog)
    return errorResponse(`Unknown action: ${action}`, 400)
  } catch (err: any) {
    // Return 200 with the error payload so the Supabase JS client surfaces
    // the actual message instead of the opaque "non-2xx status code" wrapper.
    logTiming(actionForLog, 'error', Date.now() - startedAt, orgForLog)
    return jsonResponse({ error: err?.message || String(err) }, { status: 200 })
  }
})
