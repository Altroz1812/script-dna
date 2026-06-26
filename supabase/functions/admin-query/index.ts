import { corsHeaders, jsonResponse, errorResponse } from './_shared/cors.ts'
import { resolveCaller, invalidateCallerCache } from './_shared/context.ts'
import {
  READ_CACHEABLE_ACTIONS,
  cacheKey,
  readFromCache,
  writeToCache,
  invalidateForAction,
} from './_shared/cache.ts'
import { ORG_SCOPED_ACTIONS } from './_shared/guards.ts'
import { HANDLERS } from './registry.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const action: string = body.action
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
    if (forbiddenOrg) {
      return errorResponse('Forbidden: organization not accessible', 403)
    }

    if (!ctx.callerIsSuperadmin && ORG_SCOPED_ACTIONS.has(action) && !ctx.targetOrgId) {
      return errorResponse('Forbidden: no active organization scope', 403)
    }

    // Try cache for read-only hot actions before any DB work.
    const cKey = READ_CACHEABLE_ACTIONS.has(action)
      ? cacheKey(action, ctx.callerUserId, ctx.targetOrgId, params)
      : null
    if (cKey) {
      const hit = readFromCache(cKey)
      if (hit !== undefined) {
        return new Response(JSON.stringify(hit), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        })
      }
    }

    // Dispatch to the first handler that owns this action.
    for (const handler of HANDLERS) {
      const out = await handler(action, ctx, params)
      if (out instanceof Response) return out
      if (out.handled) {
        if (cKey) writeToCache(action, cKey, out.result)
        // Best-effort cache invalidation for write actions.
        invalidateForAction(action, ctx.targetOrgId)
        if (CALLER_INVALIDATING_ACTIONS.has(action)) invalidateCallerCache()
        return jsonResponse(out.result)
      }
    }

    return errorResponse(`Unknown action: ${action}`, 400)
  } catch (err: any) {
    // Return 200 with the error payload so the Supabase JS client surfaces
    // the actual message instead of the opaque "non-2xx status code" wrapper.
    return jsonResponse({ error: err?.message || String(err) }, { status: 200 })
  }
})
