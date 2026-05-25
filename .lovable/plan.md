
## Performance Audit — what's actually slow

### 1. The biggest offender: `admin-query` edge function (~2,000 LOC, single function)
Almost every admin/staff page funnels through ONE edge function (`supabase/functions/admin-query/index.ts`). Each call pays:
- Edge cold start (~200–800 ms on first hit per region)
- Service-role auth check
- JSON router overhead

Top callers (from code scan):
```
update_batch / get_stats           — Dashboard, Batches
list_batches / list_batch_students — Batches, BatchDetail
list_leads / list_enrollments / list_payments — Dashboard support tab
list_courses / list_teachers / list_all_students — Courses, dialogs
check_*_conflicts                   — Schedule
```
Dashboard alone fires **4 parallel admin-query calls** (`list_leads`, `list_enrollments`, `list_payments`, `get_stats`) on every mount. `list_batches` was recently enriched to compute `sessionStats` per batch (loops sessions for every batch) — adds DB cost.

### 2. Frontend pages bypassing React Query (37 pages!)
Only ~10 pages use `useQuery`. The other 37 (UsersPage, StudentsPage, OrganizationsPage, AttendancePage, LiveClassesPage, PaymentsPage, ReportsPage, etc.) refetch on every mount via `useEffect`. No cache → every navigation is a fresh round-trip.

### 3. Direct `supabase.from(...)` from client = extra hops + RLS recursion risk
50 direct table queries from client code. Many run alongside admin-query for the same data (e.g., Dashboard teacher branch queries `practice_assignments` then `student_submissions` separately instead of one server-side join).

### 4. Polling timers stacking up
- `useTodayClasses` refetches every 60 s
- `MobileLiveClassesPage`, `LiveClassesPage`, `SchedulePage`, `ActivityLogsPage` all `setInterval` 30–60 s
- `AuthContext` heartbeat every 60 s
These run even when the tab is backgrounded or page is not visible.

### 5. Database — missing indexes likely on hot paths
`batches.organization_id`, `batches.teacher_id`, `batch_students.batch_id`, `live_classes.batch_id + scheduled_at`, `schedules.batch_id + date`, `attendance.batch_id + date` — need verification.

### 6. Initial bundle (already partially fixed)
Route-level `React.lazy` is in place ✅, but heavy libs (`fabric` 300 KB, `recharts`, `framer-motion`, `livekit-client`) are pulled into the main chunk via shared components. Need to confirm via `vite build` stats.

---

## Phased Fix Plan (highest impact first, smallest changes)

### Phase 1 — Quick wins (1 build pass, ~150 LOC, biggest gain)
1. **Add React Query to top 5 hot pages** that currently re-fetch on every mount:
   `UsersPage`, `StudentsPage`, `OrganizationsPage`, `PaymentsPage`, `LiveClassesPage`.
   Wrap existing fetch logic in `useQuery` with `staleTime: 2 min`. Zero behavior change, 60–90 % fewer network calls on navigation.
2. **Collapse Dashboard support tab** from 3 admin-query calls into one new `admin-query` action `get_support_overview` that returns counts only (cheap aggregate SQL on the server).
3. **Pause background polling** when tab hidden — wrap each `setInterval` in `document.visibilityState === 'visible'` check (5 files).

### Phase 2 — DB & server (1 migration + 1 edge function pass)
4. **Add indexes** verified missing via `supabase--linter` and a quick `pg_stat_user_indexes` query:
   `batches(organization_id)`, `batch_students(batch_id)`, `live_classes(batch_id, scheduled_at)`, `schedules(batch_id, date)`, `attendance(batch_id, date)`.
5. **Move `sessionStats` aggregation in `list_batches`** from JS loop to a single SQL `GROUP BY` (one query instead of N+1).
6. **Split monolithic `admin-query`** is NOT recommended yet (high churn risk) — but **add a 5-second in-memory LRU cache** inside it for read-only actions (`list_courses`, `list_teachers`, `get_stats`) keyed by `(action, org_id, user_id)`. Trivial code, huge effect on bursty navigation.

### Phase 3 — Bundle & perceived perf (optional polish)
7. Run `vite build` and inspect `dist/assets/*`. Move `fabric`, `livekit-client`, `recharts` behind dynamic `import()` inside the components that actually need them (FontCompiler, VideoClassroom, charts).
8. Add `Skeleton` placeholders to the 5 hot pages above so navigation feels instant.

### What I will NOT change
- Auth flow, RLS policies, multi-tenancy logic, AuthContext singleton.
- The 35 lazy routes (already done).
- Realtime channels (already correctly scoped).

---

## Technical details

- React Query is already mounted (`QueryClientProvider` in `App.tsx`) with `staleTime: 60s` and `refetchOnMount: false` — so just converting `useEffect`-based fetchers into `useQuery` will immediately benefit from existing cache.
- Edge function in-memory cache is per-instance and lives only while the worker is warm; safe for read actions, expires fast enough to avoid staleness complaints.
- All index migrations will be `CREATE INDEX CONCURRENTLY IF NOT EXISTS` to avoid lock issues.

---

## Question before I start building

Which scope do you want me to implement now?
- **A) Phase 1 only** (smallest diff, biggest perceived gain, ~30 min work) — recommended
- **B) Phase 1 + Phase 2** (also DB indexes + server cache) — best ROI
- **C) All three phases** (also bundle splitting) — most thorough, more risk
