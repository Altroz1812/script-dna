## Current state — admin-query handler split

The monolithic switch is gone. `admin-query` is now:

```text
admin-query/
  index.ts              84 lines  — dispatcher only
  registry.ts                   — ordered list of 20 handler modules
  _shared/
    context.ts          caller resolve + 30s caller cache
    cache.ts            read cache + invalidation map
    guards.ts           ORG_SCOPED_ACTIONS allow-list
    cors.ts, supabase.ts, types.ts
  handlers/             20 modules, 109 actions total
    stats, users, organizations, leads, enrollments, schedules,
    attendance, liveClasses, materials, payments, payroll,
    notifications, courses, batches, subscriptions, coupons,
    sessions, parents, assignments, classroomSettings
```

So structurally the split is **complete**. What is still rough is the inside of each handler and the shared layer around them. Below is what I'd improve and why.

## Proposed improvements

### 1. Replace the per-handler `switch` with an action map
Today each handler runs `switch(action)` and walks every handler until one returns `handled: true` (O(20) per request). Replace with a single `Map<action, fn>` built once at module load. Dispatch becomes O(1) and unknown actions fail fast without scanning.

### 2. Lift the auto-generated "splitter" notice
Several files still carry `// Auto-generated handler module. Do not hand-edit case bodies`. The splitter no longer exists. Drop the comment so future edits aren't discouraged, and convert each case body into a named function (`listBatches(ctx, params)`) for readability and unit testing.

### 3. Centralize the org-scope filter
`if (ctx.targetOrgId) query = query.eq('organization_id', ctx.targetOrgId)` appears ~40 times. Add a helper `withOrg(ctx, query)` and a `requireOrg(ctx)` guard so handlers can't accidentally skip scoping.

### 4. Tighten the N+1 patterns in heavy handlers
- `batches.list_batches` does 4 sequential round-trips (batches → students → profiles → live_classes). Parallelize the three follow-ups with `Promise.all` — they're independent.
- `leads`, `enrollments`, `schedules` have similar shapes.
- `stats.org_performance` runs 4 queries per org in a sequential `for` loop. Batch into one `in('organization_id', ids)` per dimension.

### 5. Push hot aggregates onto the precomputed tables
`system_health`, `revenue_analytics`, `student_trends`, `org_performance` still aggregate at query time. They should read from `org_dashboard_stats` / `teacher_dashboard_stats` (already maintained by triggers) and only fall back to live SQL for fields not yet precomputed (e.g. login health).

### 6. Cache layer correctness
- `cacheKey` JSON-stringifies params without sorting keys — `{a:1,b:2}` and `{b:2,a:1}` cache separately. Sort keys before hashing.
- `READ_CACHEABLE_ACTIONS` and `TTL_OVERRIDES` are two parallel lists; merge into one config object so adding a cacheable action can't drift.
- `INVALIDATIONS` references some actions (`list_parent_children`) that no handler returns. Audit and prune.

### 7. Stronger validation at the boundary
`index.ts` trusts `body.action` and `body.params` shape. Add a Zod-style schema per action (or at least required-field checks) so handlers can drop their defensive `params?.x` chains and return clean 400s.

### 8. Error handling
The dispatcher returns 200 with `{error}` to dodge the Supabase JS "non-2xx" wrapper. Keep that, but classify errors (`auth`, `validation`, `not_found`, `server`) and log server errors with action + caller id for traceability via `supabase--edge_function_logs`.

### 9. Observability
Add lightweight timings: per-request `{action, ms, cache: HIT|MISS, orgId}` log line. Makes the next round of optimization data-driven instead of guesswork.

### 10. Type safety
`HandlerOutcome` uses `any` for `result`. Define per-action result types in `_shared/types.ts` so the frontend `adminService.ts` callsites can be typed without `as Promise<any>` everywhere.

## Suggested rollout order

1. Dispatcher map + named action functions + remove stale comments (low risk, big readability win).
2. `withOrg` helper + audit ORG_SCOPED_ACTIONS coverage (security hardening).
3. Parallelize N+1 in `batches`, `leads`, `org_performance` (perf).
4. Move `system_health`, `revenue_analytics` to precomputed reads (perf).
5. Cache key normalization + INVALIDATIONS audit (correctness).
6. Per-action validation + structured error responses (robustness).
7. Timing logs + typed results (DX).

## Out of scope unless you ask

- Splitting the function into multiple edge functions per domain (cold-start tradeoff isn't worth it at current size).
- Moving to PostgREST RPCs (would require RLS rewrites we explicitly avoided per project memory).

Tell me which of the 10 items you want me to take on — happy to start with 1–3 as a focused first pass, or do the whole list in sequence.