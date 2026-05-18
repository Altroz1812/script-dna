# Multi-tenant audit & hardening — strict org scoping for all roles

Today's setup is incomplete: only SuperAdmin has a real org picker, half the tables don't even carry `organization_id`, and admin/support/teacher users that belong to several orgs silently see data merged across all of them. This plan closes those gaps in three layers — database, edge function, and UI — without changing any business logic.

## 1. Database — make every tenant-owned table org-aware

### Tables missing `organization_id`
Add a non-null `organization_id uuid` column (with index + FK to `organizations`) and backfill via the parent batch / student profile:

- `leads`
- `payments`
- `payroll`
- `attendance`         (backfill from `batches.organization_id`)
- `live_classes`       (backfill from `batches.organization_id`)
- `schedules`          (backfill from `batches.organization_id`)
- `materials`          (backfill from `courses.organization_id`)
- `practice_assignments` (from `batches`)
- `student_submissions`  (from `practice_assignments → batches`)
- `student_progress`     (from `batches`)
- `notifications`        (already has `target_org_id` → rename/normalize to `organization_id` + keep `user_id` for direct delivery)
- `orders`               (denormalize from first enrolled batch's org)
- `coupons`              (nullable — `NULL` = global coupon)

### Replace blanket "Admins manage X" policies with org-scoped policies
For every table above (plus existing `batches`, `courses`, `org_subscriptions`, `organization_members`), the admin/support policies must use `user_in_org(auth.uid(), organization_id)` instead of unconditional `has_role('admin')`. SuperAdmin keeps the global bypass. Teacher policies stay batch-scoped (already correct). This is the single biggest leak today.

### New helper functions (SECURITY DEFINER, avoid recursion)
- `public.user_org_ids(_user_id uuid) → setof uuid` — list every org a user belongs to.
- `public.user_has_org_access(_user_id, _org_id) → boolean` — convenience wrapper used by the edge function and RLS.

## 2. Edge function `admin-query`

- Stop assuming `first_org_for_user` for admins. Read `target_org_id` from params for **all** roles (not just SuperAdmin). 
- Before honoring it, validate: SuperAdmin → any org; admin/support/teacher → must appear in `user_org_ids`.
- All `list_*` actions become uniformly org-filtered when `target_org_id` is set, otherwise (for multi-org admin without selection) return data for every org the caller belongs to.
- All `create_*` actions auto-fill `organization_id = target_org_id` and reject if the caller can't access it.

## 3. Frontend — universal active-org context + picker

### Generalise `ActiveOrgContext`
- Promote from SuperAdmin-only to every role.
- New behaviour:
  - `availableOrgs` — loaded from `organization_members` (or `list_organizations` for SuperAdmin).
  - If user has exactly **1** org → auto-select it on login (no picker shown).
  - If user has **>1** orgs → force `/select-organization` after login (same page, restricted list).
  - SuperAdmin keeps the "Global view" tile; other roles do not get it.
- Storage key stays `aurapen.active_org`; add `aurapen.active_org_name`.

### `ProtectedRoute`
Replace the SuperAdmin-only redirect with:
```
needsPicker = profile && availableOrgs.length > 1 && activeOrgId === undefined
```

### `AppHeader`
Show the org switcher to any user with `availableOrgs.length > 1` (today only SuperAdmin sees it).

### `adminService.adminQuery`
Already auto-injects `target_org_id` from storage — keep it, but stop the `__skip_org_filter` shortcut for non-SuperAdmin callers.

### Direct Supabase queries on pages
Audit every page that hits Supabase directly and add `.eq('organization_id', activeOrgId)` (when set). Pages to update:

`BatchesPage`, `CoursesPage`, `StudentsPage`, `LeadsPage`, `PaymentsPage`, `PayrollPage`, `LiveClassesPage`, `AttendancePage`, `MaterialsPage`, `EnrollmentsPage`, `SchedulePage`, `CouponsPage`, `NotificationsPage`, `OrderHistoryPage`, `PracticeAssignmentsPage`, `StudentSubmissionsPage`, `StudentProgressPage`, `ReportsPage`, `Dashboard` (live metrics RPC already org-scoped — verify).

### Create/update forms
For every create form (batch, course, lead, material, assignment, payment, payroll entry, live class), pre-fill and lock `organization_id = activeOrgId`. If `activeOrgId` is null (Global view, SuperAdmin only) and table requires org, show a "Pick an organization first" inline state.

## 4. Sequencing (so nothing breaks mid-flight)

```text
Step A  DB migration #1 — add nullable organization_id columns + backfill
Step B  DB migration #2 — set NOT NULL + add indexes + new helper funcs
Step C  DB migration #3 — rewrite RLS policies on the 12 tables
Step D  Edge function admin-query — honor target_org_id for all roles + membership check
Step E  Generalise ActiveOrgContext + ProtectedRoute + AppHeader
Step F  Page-by-page query/scoping audit (one PR slice per domain: academics, finance, CRM, content)
Step G  Manual smoke test matrix — see §5
```

## 5. Manual test matrix (post-implementation)

| Role             | Single org | Multi org | Expected |
|------------------|-----------|-----------|----------|
| SuperAdmin       | n/a       | n/a       | Picker + Global tile; switch works on every page |
| Admin            | Auto-enter org | Picker on login + header switcher | Sees only active org's data, create writes to it |
| Support          | Auto-enter | Picker | Read-only, scoped |
| Teacher          | Auto-enter | Picker (org of their batches) | Sees only batches in active org |
| Student / Parent | Auto-enter | n/a (single org by design) | No picker, no header switcher |

## 6. Out of scope

- No business-logic changes (pricing, attendance flow, payroll calc).
- No new UI screens beyond reusing existing `SelectOrganizationPage`.
- Student / parent users remain single-org (current product assumption).
