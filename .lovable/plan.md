## Goal
Move dashboard metric calculation **out of live queries** and **into precomputed rows** maintained by triggers. Every role (SuperAdmin, Admin, Teacher, Student, Parent, Support) reads a single row instead of running joins/aggregations on every dashboard load.

## Current problem
- `dashboard_stats` exists but is **global only** (1 row, SuperAdmin scope). Admins still hit `get_stats` which scans `profiles`, `user_roles`, `batches`, etc. per request.
- Teacher dashboard fetches `batches + batch_students + live_classes + practice_assignments + student_submissions` on every load.
- Student dashboard fetches `batch_students + live_classes + student_submissions + student_progress` on every load.
- Parent dashboard fetches `parent_children + profiles + student_progress + payments + live_classes` on every load.
- With 400+ concurrent logins these turn into thousands of join queries/min.

## Solution overview
Introduce **denormalized metrics tables** keyed by scope, updated by `AFTER INSERT/UPDATE/DELETE` triggers on the source tables. Frontend reads a single row via a thin RPC; no aggregation at query time.

```text
                  source tables (batches, profiles, ...)
                              │  AFTER triggers
                              ▼
   ┌──────────────────────────────────────────────────┐
   │  org_dashboard_stats   (one row per organization)│
   │  teacher_dashboard_stats (one row per teacher)   │
   │  student_dashboard_stats (one row per student)   │
   │  parent_dashboard_stats  (one row per parent)    │
   │  dashboard_stats         (existing — global SA)  │
   └──────────────────────────────────────────────────┘
                              │ single-row SELECT
                              ▼
                       Dashboard.tsx / mobile homes
```

## Schema (migration)

1. `public.org_dashboard_stats` — PK `organization_id`
   - members, students, teachers, courses, batches, leads, payments, active_live_classes, role_counts jsonb, updated_at
2. `public.teacher_dashboard_stats` — PK `teacher_id`
   - batch_count, student_count, upcoming_class_count, pending_submissions, updated_at
3. `public.student_dashboard_stats` — PK `student_id`
   - enrolled_courses, enrolled_batches, upcoming_class_count, recent_submission_count, avg_completion_pct, updated_at
4. `public.parent_dashboard_stats` — PK `parent_id`
   - children_count, avg_completion_pct, recent_payment_count, upcoming_class_count, updated_at

Each gets: `GRANT` to `authenticated` + `service_role`, RLS so users see only their own row (org row via `user_has_org_access`), `service_role` full access.

## Recompute functions (SECURITY DEFINER)
- `recompute_org_stats(org uuid)`
- `recompute_teacher_stats(teacher uuid)`
- `recompute_student_stats(student uuid)`
- `recompute_parent_stats(parent uuid)`

Each is an `INSERT … ON CONFLICT … DO UPDATE` so the row is created on first touch.

## Triggers (AFTER INSERT/UPDATE/DELETE, FOR EACH ROW)
Triggers extract the affected scope ids from `NEW`/`OLD` and call the matching `recompute_*` function. Examples:

| Source table | Triggers recompute |
|---|---|
| `batches` | org, teacher (old + new teacher_id) |
| `batch_students` | teacher of batch, student, org |
| `profiles` / `user_roles` / `organization_members` | org, global |
| `live_classes` | teacher, students of batch, parents of those students, org |
| `student_submissions` | teacher (via assignment), student |
| `student_progress` | student, parents of student |
| `payments` | org, parent (if linked), global |
| `leads` | org, global |
| `parent_children` | parent |
| `courses` | org, global |

Triggers are intentionally row-level + targeted (not full table scans like the current STATEMENT-level `recompute_dashboard_stats`).

## Backfill
At the end of the migration, run one-time loops to populate every existing org/teacher/student/parent row.

## Backend changes
- `admin-query` handlers (`stats.ts`, `getSupportOverview`, dashboard handlers): replace aggregation SQL with single-row reads from the new tables (with cache layer already in place).
- Add new handlers: `get_teacher_dashboard`, `get_student_dashboard`, `get_parent_dashboard` returning the precomputed row + small lists (upcoming classes, recent submissions) that still need live data but no aggregation.

## Frontend changes (presentation-only, no business-logic change)
- `src/pages/Dashboard.tsx`: replace the per-role `useQuery` blocks (`student_dashboard`, `parent_dashboard`, `teacher_dashboard`, `support_dashboard`, `admin_stats`) with calls to the new precomputed RPCs.
- `src/pages/mobile/{StudentHome,TeacherHome,ParentHome,AdminHome}.tsx`: same swap.
- Keep React Query + localStorage cache (existing pattern). Bump `staleTime` to 5 min since underlying numbers are trigger-maintained and fresh.

## Out of scope
- No UI/visual changes to dashboard cards.
- No change to public action contract names already used by frontend; new actions added alongside.
- Charts/trends (EnrollmentTrendsChart) stay as-is for this pass.

## Rollout
1. Migration (tables + functions + triggers + backfill).
2. Edge function handler updates.
3. Frontend swap to new actions.
4. Smoke check: load each role's dashboard, verify numbers match prior values; insert/delete a row in source tables and confirm the stats row updates.