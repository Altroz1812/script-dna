import type { HandlerCtx } from './types.ts'

// Apply the active org scope to a PostgREST query builder. Returns the
// query unchanged when there is no scope (SuperAdmin global view).
export function withOrg<T>(ctx: HandlerCtx, query: T, column = 'organization_id'): T {
  if (!ctx.targetOrgId) return query
  return (query as any).eq(column, ctx.targetOrgId)
}

// Throws when a handler that must be tenant-scoped is called without scope.
// Use inside any new handler that touches per-org data.
export function requireOrg(ctx: HandlerCtx): string {
  if (!ctx.targetOrgId) throw new Error('Forbidden: no active organization scope')
  return ctx.targetOrgId
}

// Deterministic JSON for cache keys — sorts object keys at every level so
// that {a:1,b:2} and {b:2,a:1} hash to the same entry. Falls back to plain
// stringify for primitives and arrays-of-primitives.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const out: string[] = []
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k]
    if (v === undefined) continue
    out.push(JSON.stringify(k) + ':' + stableStringify(v))
  }
  return '{' + out.join(',') + '}'
}