## Problem

The Students page works for SuperAdmin but is empty for Admin.

**Root cause:** `list_students_with_batches`, `list_all_students`, and `list_teachers` run as direct browser queries against `user_roles` and `profiles`. The `user_roles` SELECT policy only allows `auth.uid() = user_id`, so an admin only sees their own role row — `studentIds` resolves to empty and the page shows nothing. SuperAdmin works only because their own row happens to be a `student` placeholder in some seeds, or because the join still finds them; either way it's coincidental.

Additionally, even after fixing visibility, an Admin should only see students **belonging to their organization**, not every student in the system.

## Fix

Route all three actions through the existing `admin-query` edge function (service role + JWT-based caller resolution), mirroring how batches were fixed.

### 1. Edge function (`supabase/functions/admin-query/index.ts`)

Add a shared "admin-or-superadmin auth + org resolve" block (reuse the same JWT/role/org pattern already used by the batch handlers) covering these actions:

- `list_students_with_batches`
- `list_all_students`
- `list_teachers`

Logic per action:

- **SuperAdmin** → return all students/teachers (current behavior).
- **Admin** → resolve `callerOrgId` via `organization_members` (or `first_org_for_user`). Then:
  - **Students**: a user is "in this org" if they are enrolled in any batch where `batches.organization_id = callerOrgId`. Build the student set from `batch_students JOIN batches WHERE organization_id = callerOrgId`, then fetch their profiles + enrollments.
  - **Teachers**: teachers assigned to any `batches.teacher_id` where `organization_id = callerOrgId`, **plus** teachers whose `organization_members.organization_id = callerOrgId` (covers teachers created in the org but not yet assigned a batch). Union and dedupe.
- Reject other roles with 403.

### 2. Service layer (`src/services/api/adminService.ts`)

Move these three cases to the `edgeFunctionAction` switch (alongside batches) and delete the now-unused local `listStudentsWithBatches`, `listAllStudents`, `listTeachers` functions:

```ts
case 'list_students_with_batches':
case 'list_all_students':
case 'list_teachers':
  return edgeFunctionAction(action, params);
```

### 3. No client/page changes

`StudentsPage`, `LiveClassesPage`, `ParentChildLinkDialog`, `ReassignTeacherDialog`, and `courseService` already call `adminQuery(...)` — they automatically pick up the new routing.

### 4. No DB migration required

RLS policies stay as-is. Service role in the edge function bypasses RLS; org scoping is enforced in code.

## Outcome

- Admin on Students page sees every student enrolled in any batch within their organization.
- SuperAdmin behavior is unchanged.
- Teacher dropdowns in Live Classes and Reassign dialog become org-scoped for admins.
- Parent linking dialog shows only students in the admin's org.
