# SuperAdmin Org Scoping

After a SuperAdmin signs in, route them to an **Organization Selector**. The chosen org becomes the active tenant — all subsequent pages (dashboard, students, teachers, batches, courses, payments, leads, etc.) display, save and modify data filtered to that org by default. A switcher in the header lets them change org or return to "All Orgs" (global view).

## User-facing changes

1. **Org Selector page** (`/select-organization`)
   - Shown automatically after SuperAdmin login if no org is selected yet.
   - Grid of org cards (logo, name, member count) + an "All Organizations (Global)" option.
   - Clicking an org persists the choice and redirects to `/dashboard`.

2. **Header switcher** (`AppHeader`)
   - SuperAdmin-only dropdown showing current active org with a "Switch organization" action.
   - Visible badge: "Viewing: Sunrise Academy" or "Global view".

3. **Scoped data everywhere**
   - All list pages and create/update flows default `organization_id = activeOrgId`.
   - Global view (`null`) keeps current unrestricted behavior.

## Technical implementation

### Active org context
- New `ActiveOrgContext` (`src/contexts/ActiveOrgContext.tsx`) storing `{ activeOrgId, activeOrgName, setActiveOrg, clearActiveOrg }`.
- Persisted in `localStorage` (`aurapen.active_org`) so reloads keep selection.
- Provider mounted in `App.tsx` inside `AuthProvider`.
- Hook: `useActiveOrg()`.

### Routing gate
- New `<RequireOrgSelection>` wrapper in `ProtectedRoute` (or App routes): if `role === 'superadmin'` and `activeOrgId === undefined` (never chosen), redirect to `/select-organization`. `null` = explicit Global selection (allowed).

### New page
- `src/pages/SelectOrganizationPage.tsx` — fetches orgs via `adminQuery('list_organizations')` (already exists) and renders cards. Includes a "Global (All Orgs)" tile.

### Header switcher
- Update `src/components/layout/AppHeader.tsx` to show a `DropdownMenu` for SuperAdmin: current org name + "Switch organization" (navigates to `/select-organization`) + "Global view".

### Scoping queries
- Extend `adminQuery` calls: where applicable, pass `organization_id: activeOrgId` param.
- Update `admin-query` edge function: for SuperAdmin, when `organization_id` param present, filter `list_students_with_batches`, `list_teachers`, `list_all_students`, `list_organizations` results, batches, courses, etc., by that org.
- Client pages (Batches, Courses, Leads, Payments, Payroll, Live Classes, Enrollments) — read `activeOrgId` and add `.eq('organization_id', activeOrgId)` where the table has that column.

### Default values on create
- Batch/Course/Material/Lead forms: pre-fill `organization_id = activeOrgId` for SuperAdmin when an org is active.

### Tables with `organization_id`
`batches`, `courses`, `organization_members`, `org_subscriptions`, profile (via membership). Tables without a direct org column (students, teachers, payments, attendance) are filtered through joins on `batches`/`organization_members` inside the edge function.

## Out of scope
- Admin/Support/Teacher/Student/Parent users — their org is already auto-scoped via RLS; no UI changes.
- No schema migrations needed.

## Files

**New**
- `src/contexts/ActiveOrgContext.tsx`
- `src/pages/SelectOrganizationPage.tsx`

**Edited**
- `src/App.tsx` — mount provider + route
- `src/components/auth/ProtectedRoute.tsx` — redirect SuperAdmin without selection
- `src/components/layout/AppHeader.tsx` — org switcher
- `src/services/api/adminService.ts` — pass `organization_id` through
- `supabase/functions/admin-query/index.ts` — honor `organization_id` for SuperAdmin in list actions
- A handful of pages (Batches, Courses, Leads, Payments, Students, Teachers) — apply active-org filter
