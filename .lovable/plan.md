## Goal
Close every multi-tenant gap so that for any non-SuperAdmin user, **every read shows only their active org's data** and **every write stamps `organization_id`**. SuperAdmin keeps the global view + org picker.

---

## Part A — Edge function `admin-query` (handler-by-handler hardening)

Today only `list_users`, `list_batches`, `list_enrollments`, `list_live_classes`, `list_students`, `list_teachers` honor `targetOrgId`. The rest return **all rows across all orgs**.

Apply the same `if (targetOrgId) query = query.eq('organization_id', targetOrgId)` pattern (and on create handlers, inject `organization_id: targetOrgId` when missing) to:

| Handler | Fix on READ | Fix on WRITE |
|---|---|---|
| `list_leads` / `create_lead` / `update_lead` | filter by org | stamp org on insert |
| `list_payments` / `create_payment` | filter by org | stamp org |
| `list_payroll` / `create_payroll` | filter by org | stamp org |
| `list_materials` / `create_material` | filter by org | stamp org |
| `list_schedules` / `create_schedule` | filter by org | stamp org |
| `list_notifications` / `create_notification` | filter by `target_org_id`/`organization_id` | stamp org |
| `list_courses` / `create_course` | filter by org | stamp org |
| `list_coupons` / `create_coupon` | filter by org | stamp org |
| `list_activity_logs` | filter by org (via user_ids in org) | n/a |
| `list_modules` / `list_lessons` | filter via course→org | inherit course org |
| `list_assignments` / `create_assignment` | filter via batch→org | stamp org |
| `get_reports` | scope all sub-aggregates to org | n/a |
| `system_health` | scope counts to org (or block for non-SA) | n/a |
| `getStats` | already scopes; verify counts for leads/payments/courses also filter by `organization_id` |

Membership validation (already in place) stays — non-SA cannot pass a `target_org_id` outside their memberships.

---

## Part B — Frontend pages that bypass `adminQuery` (raw `supabase.from` calls)

Replace raw client reads/writes with either (a) an `adminQuery` call, or (b) a direct query with explicit `.eq('organization_id', activeOrgId)` plus `organization_id: activeOrgId` on insert.

| Page | Action |
|---|---|
| **AttendancePage** | On insert, stamp `organization_id` (resolve from batch). Reads via `batch_students` are fine (RLS) but add an org guard when listing batches for the picker. |
| **LiveClassesPage** | Direct `live_classes` insert → stamp `organization_id`. |
| **PaymentsPage** | Admin direct `payments` select/insert → switch to `adminQuery('list_payments' / 'create_payment')` so org scoping is centralized. |
| **PracticeAssignmentsPage** | `batches` list → filter by `activeOrgId`. `practice_assignments` insert → stamp org. |
| **StudentSubmissionsPage** | Stamp `organization_id` on insert (inherit from assignment). |
| **ReportsPage** | `batches` list → filter by `activeOrgId`. |
| **CoursesPage** | Secondary `courses`/`profiles` lookups → constrain by `activeOrgId`. |
| **Dashboard (admin counts)** | `leads`, `batch_students`, `payments` head-count queries → add `.eq('organization_id', activeOrgId)` when `activeOrgId` is set; keep global when SA chooses global view. |
| **UsersPage** | Already uses `adminQuery('list_users')` → org-filtered server-side. Verify the role-counts widget also passes through. |
| **CoursesPage (list)** | Currently uses `adminQuery('list_courses')` — depends on Part A fix to actually filter. |

(All other pages already route through `adminQuery` or are correctly user-scoped — parents, students, profile, auth pages, landing.)

---

## Part C — Login & session-time org validation

Today `ActiveOrgContext` auto-picks an org or sends to the selector after login, but there's no hard check that the **role row** and the **profile's `organization_id`** agree with an actual `organization_members` row. Add:

1. **On login / session bootstrap**, in `ActiveOrgContext`:
   - Load `user_roles` + `organization_memberships` + `profile.organization_id` together.
   - If role ∈ {admin, support, teacher} and `availableOrgs.length === 0` → sign-out + toast "No organization assigned, contact admin." (prevents orphaned admins seeing nothing or, worse, falling back to a global query.)
   - If role = student/parent and the underlying batch/parent_children rows resolve to zero orgs → same guard.
   - If `profile.organization_id` is set but not in `availableOrgs`, clear it and force `/select-organization`.

2. **Switcher safety**: when the user changes `activeOrgId` via the header, re-validate it is still in `availableOrgs` before persisting; otherwise reset.

3. **Edge-function defense-in-depth**: in `admin-query`, when caller is non-SA and `targetOrgId` is null/undefined, **reject** the request (403) instead of silently returning unscoped data. This guarantees that even if a frontend forgets to inject, no leak occurs.

4. **Users page filter**: enforce that `list_users` for a non-SA can only return profiles whose `organization_id` ∈ caller's memberships, even if `targetOrgId` is omitted (server clamps to caller's orgs).

---

## Part D — Database guarantees (small migration)

To remove the "RLS-allows-but-UI-forgets" class of bugs:

1. **Backfill + NOT NULL** `organization_id` on these tables once verified clean: `leads`, `payments`, `payroll`, `live_classes`, `schedules`, `attendance`, `materials`, `student_submissions`, `student_progress`, `practice_assignments`, `notifications`, `courses`, `orders`.
2. **BEFORE INSERT triggers** to auto-stamp `organization_id` from the parent row when null:
   - `attendance.organization_id ← batches.organization_id`
   - `live_classes.organization_id ← batches.organization_id`
   - `schedules.organization_id ← batches.organization_id`
   - `practice_assignments.organization_id ← batches.organization_id`
   - `student_submissions.organization_id ← practice_assignments.organization_id`
   - `student_progress.organization_id ← batches.organization_id`
3. **Tighten RLS** to remove the `OR organization_id IS NULL` escape hatch on `leads`, `orders` once backfilled.
4. **Tighten `batches`/`courses` SELECT policies** — drop the legacy "Public courses read / Users can view courses" `USING (true)` policies (only the public landing edge function should expose marketing courses).

---

## Part E — Verification (manual + scripted)

1. **Per-role smoke matrix** (run for Admin-A, Admin-B, Teacher, Support, Student, Parent, SuperAdmin-Global, SuperAdmin-OrgA):
   - Open every page in the sidebar.
   - Confirm row counts equal the org-scoped truth from a `psql` baseline query.
2. **Cross-org leak test**: as Admin-A, attempt `adminQuery('list_payments', { target_org_id: OrgB })` from devtools → expect 403.
3. **Insert audit**: after creating one row of every type (lead, payment, payroll, material, schedule, live class, assignment, submission, course), `SELECT id, organization_id FROM <table> ORDER BY created_at DESC LIMIT 1` → expect non-null and equal to active org.
4. **Backfill report**: `SELECT table_name, COUNT(*) FROM ... WHERE organization_id IS NULL` across all scoped tables → expect 0 before NOT NULL migration.

---

## Out of scope (intentionally)
- Public landing/checkout flows (must remain unauthenticated).
- Font compiler / handwriting engine tables (project-wide design assets).
- Auth pages, ProfilePage, SettingsPage.

---

## Execution order
1. Part C (frontend login validation + edge fn 403) — closes the largest leak first.
2. Part A (edge handler scoping) — server-side enforcement.
3. Part B (page-by-page raw-query fixes) — UI alignment.
4. Part D (DB backfill, triggers, NOT NULL, RLS tighten) — hard guarantees.
5. Part E (full verification matrix).