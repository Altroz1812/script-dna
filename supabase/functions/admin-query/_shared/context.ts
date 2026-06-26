import { getServiceClient } from './supabase.ts'
import type { HandlerCtx } from './types.ts'
import { corsHeaders } from './cors.ts'

// Tiny per-request memo of caller identity. The Supabase JS client itself
// has no cache for getUser(token) + role/membership lookups, so we batch
// them here and reuse across handlers via the HandlerCtx.
const CALLER_TTL_MS = 30_000
type CallerEntry = {
  expiresAt: number
  userId: string | null
  roles: string[]
  memberships: string[]
}
const callerCache = new Map<string, CallerEntry>()

function readCaller(token: string): CallerEntry | null {
  const e = callerCache.get(token)
  if (!e) return null
  if (e.expiresAt < Date.now()) {
    callerCache.delete(token)
    return null
  }
  return e
}

function writeCaller(token: string, entry: CallerEntry) {
  if (callerCache.size > 500) {
    const first = callerCache.keys().next().value
    if (first) callerCache.delete(first)
  }
  callerCache.set(token, entry)
}

export async function resolveCaller(
  req: Request,
  requestedOrgId: string | null,
): Promise<{ ctx: HandlerCtx; forbiddenOrg: boolean }> {
  const supabase = getServiceClient()
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  let callerUserId: string | null = null
  let callerRoles: string[] = []
  let callerOrgMemberships: string[] = []

  if (token) {
    const cached = readCaller(token)
    if (cached) {
      callerUserId = cached.userId
      callerRoles = cached.roles
      callerOrgMemberships = cached.memberships
    } else {
      try {
        const { data: u } = await supabase.auth.getUser(token)
        callerUserId = u?.user?.id ?? null
      } catch (_) {
        callerUserId = null
      }
      if (callerUserId) {
        const [{ data: roleRows }, { data: memb }] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', callerUserId),
          supabase.from('organization_members').select('organization_id').eq('user_id', callerUserId),
        ])
        callerRoles = (roleRows ?? []).map((r: any) => r.role)
        callerOrgMemberships = (memb ?? []).map((m: any) => m.organization_id)
      }
      writeCaller(token, {
        expiresAt: Date.now() + CALLER_TTL_MS,
        userId: callerUserId,
        roles: callerRoles,
        memberships: callerOrgMemberships,
      })
    }
  }

  const callerIsSuperadmin = callerRoles.includes('superadmin')
  const callerIsAdmin = callerRoles.includes('admin')
  const callerIsSupport = callerRoles.includes('support')
  const callerIsTeacher = callerRoles.includes('teacher')

  let targetOrgId: string | null = null
  let forbiddenOrg = false
  if (callerIsSuperadmin) {
    targetOrgId = requestedOrgId
  } else if (requestedOrgId) {
    if (!callerOrgMemberships.includes(requestedOrgId)) {
      forbiddenOrg = true
    } else {
      targetOrgId = requestedOrgId
    }
  } else if (callerOrgMemberships.length === 1) {
    targetOrgId = callerOrgMemberships[0]
  }

  const ctx: HandlerCtx = {
    req,
    supabase,
    corsHeaders,
    callerUserId,
    callerRoles,
    callerIsSuperadmin,
    callerIsAdmin,
    callerIsSupport,
    callerIsTeacher,
    callerOrgMemberships,
    targetOrgId,
  }
  return { ctx, forbiddenOrg }
}

// Invalidate cached caller record — call when roles/memberships change.
export function invalidateCallerCache() {
  callerCache.clear()
}