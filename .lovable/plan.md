You are right: the current implementation is not safely tenant-filtered. The issue happened because the previous changes hardened only part of the system, but many screens still use older direct queries or local service functions that bypass the hardened org-scoped edge function.

Root causes found

1. `src/services/api/adminService.ts` is the biggest flaw.
   - It injects `target_org_id` at the top, but then many actions ignore it.
   - Example: `adminQuery('list_users')` calls local `listUsers()` instead of the secure edge function, and `listUsers()` reads all `profiles`.
   - Same problem exists for leads, enrollments, attendance, live classes, materials, payments, payroll, notifications, schedules, and some course operations.

2. React Query cache is not org-aware.
   - Many screens use query keys like `['users']`, `['leads']`, `['courses']`.
   - When an admin swaps organization, cached data from the previous/global org can stay visible because `activeOrgId` is not part of the query key and the cache is not cleared on org switch.

3. Multiple pages bypass `adminQuery` entirely.
   - Direct `supabase.from(...)` calls still exist in pages/components such as Dashboard, Courses, Attendance, Reports, Payments, PracticeAssignments, StudentSubmissions, LiveClasses, classroom attendance dialog, NotificationsBell, and `courseService`.
   - These depend on RLS, but current RLS is still permissive in some places.

4. Some RLS policies are unsafe for tenant isolation.
   - `profiles` has `Users can view profiles` with `USING true`, exposing all profiles to authenticated/public client queries.
   - `batch_students` admin policy is not org-scoped.
   - `course_modules` and `lessons` are broadly readable without course/org scoping.
   - Several admin/support policies allow broad access where org membership should be enforced.

5. Dashboard non-superadmin stats are wrong.
   - Dashboard uses `profile.organizationId`, not the selected active organization for multi-org admins/support/teachers.
   - `getStats()` in `adminService.ts` filters leads/payments only when `isSuperadmin`, so non-superadmin dashboard counts can become unscoped.

Implementation plan

Phase 1 — Emergency stop-leak fix in frontend service

- Convert all tenant-sensitive `adminQuery` actions in `adminService.ts` to call the secure `admin-query` edge function instead of local direct `supabase.from(...)` functions.
- Keep direct local functions only for truly user-owned/public flows, not admin tenant screens.
- Specifically route these through the edge function:
  - `get_stats`
  - `list_users`, `create_user`, `update_user`, `delete_user`, `change_role`, `toggle_user_active`, `admin_reset_password`
  - `list_leads`, `create_lead`, `update_lead`, `delete_lead`
  - `list_enrollments`
  - `list_schedules`, `create_schedule`, `update_schedule`, `delete_schedule`, `bulk_create_schedules`
  - `list_attendance`, `save_attendance`
  - `list_live_classes`, `create_live_class`, `update_live_class`, `delete_live_class`
  - `list_materials`, `create_material`, `delete_material`
  - `list_payments`, `create_payment`, `update_payment`
  - `list_payroll`, `create_payroll`, `update_payroll`
  - `list_notifications`, `create_notification`, `mark_read`, `delete_notification`
  - `list_courses`, `create_course`, `update_course`, `delete_course`
  - all batch/student/teacher helper actions

Phase 2 — Fix organization switching and cache isolation

- Add `activeOrgId` into query keys for all org-scoped screens:
  - Users, Courses, Batches, Leads, Enrollments, Schedule, Attendance, Live Classes, Materials, Payments, Payroll, Reports, Notifications, Students, Curriculum, Coupons, Activity Logs, Dashboard.
- On `setActiveOrg()`, clear or invalidate org-scoped React Query caches immediately.
- Ensure org switch always causes a fresh load from the selected org.
- Keep SuperAdmin global view as the only case where `activeOrgId === null` is allowed.
- For non-superadmin users, never allow global/null scope.

Phase 3 — Replace direct page queries that bypass tenant scoping

- Replace admin/support/teacher screen direct `supabase.from(...)` calls with scoped `adminQuery(...)` calls.
- Where direct client queries are kept for student/parent self-service pages, ensure they are constrained by user ownership or parent-child relationship only.
- Fix known direct-query pages/components:
  - `Dashboard.tsx`
  - `CoursesPage.tsx`
  - `AttendancePage.tsx`
  - `ReportsPage.tsx`
  - `PaymentsPage.tsx`
  - `PracticeAssignmentsPage.tsx`
  - `StudentSubmissionsPage.tsx`
  - `LiveClassesPage.tsx`
  - `src/services/api/courseService.ts`
  - `src/components/classroom/EndClassAttendanceDialog.tsx`
  - `src/components/layout/NotificationsBell.tsx`

Phase 4 — Harden edge function authorization, not just filtering

- In `supabase/functions/admin-query/index.ts`, enforce `targetOrgId` on every tenant-sensitive action for non-superadmin callers.
- Validate writes before update/delete:
  - update/delete lead only if record belongs to selected org
  - update/delete course only if course belongs to selected org
  - update/delete batch only if batch belongs to selected org
  - update/delete payment/payroll/material/assignment/submission only if record belongs to selected org
- Stamp `organization_id = targetOrgId` on every create where the table has `organization_id`.
- Remove or consolidate duplicate/unreachable handlers so there is only one implementation per action.

Phase 5 — Database/RLS hardening

- Tighten RLS so client-side mistakes cannot leak all tenants again.
- Fix/remove unsafe broad policies:
  - Remove `profiles` policy with `USING true`.
  - Replace `profiles` admin/support view policies with org-member scoped policies using `organization_members` and `user_has_org_access()`.
  - Make `batch_students` admin access scoped through the batch’s `organization_id`.
  - Make `course_modules` and `lessons` scoped through parent `courses.organization_id`.
  - Tighten notifications to own user or selected org only.
- Add/verify `organization_id` backfills and NOT NULL where safe for tenant tables.
- Add missing org-stamping triggers where child records inherit org from parent batch/course/assignment.

Phase 6 — Verification before saying fixed

- Test using at least two organizations and one multi-org admin.
- Smoke matrix:
  - SuperAdmin global: sees all orgs only in global view.
  - SuperAdmin selected org: sees only selected org data.
  - Multi-org admin selected Org A: sees only Org A.
  - Same admin selected Org B: sees only Org B.
  - Single-org admin: auto-scoped to their org only.
  - Teacher/support: scoped only to selected/allowed orgs.
  - Student/parent: only own/child data.
- Cross-org negative tests:
  - Manually call edge function with another org id: expect 403.
  - Try stale cached data after org switch: should disappear/refetch.
  - Try update/delete of another org’s record: expect 403/no mutation.

Why this must be done fully

The current bug is not one page. It is an architectural leak: local frontend services, direct page queries, cache keys, and RLS are inconsistent. The correct fix is to make the secure edge function the single admin data gateway, make cache org-aware, and tighten RLS as defense-in-depth.