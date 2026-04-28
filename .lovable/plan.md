## Goal

Allow Admins to create, edit, and view batches inside their organization. Eliminate the "new row violates row-level security policy for table 'batches'" error and the visibility gap where Admins see no batches that SuperAdmin can see.

## Root cause

1. `src/services/api/adminService.ts` runs `create_batch`, `update_batch`, `delete_batch`, `list_batches` (and the same for batch_students) **directly from the browser using the user's JWT**, so RLS applies. SuperAdmin/Admin do **not** go through the `admin-query` edge function for these calls — contrary to the project's stated dual-access pattern.
2. The `batches` RLS policy `Admins manage batches` requires `user_in_org(auth.uid(), organization_id)`. The current `createBatch()` inserts only `course_id`, `name`, `max_students` — `organization_id` is `NULL`, so `user_in_org(...)` is false and the insert is rejected for Admin (SuperAdmin passes via the first OR branch and ends up creating NULL-org rows).
3. There is no general SELECT policy for `admin` that returns NULL-org legacy rows. Admin's only SELECT path is the same `Admins manage batches` USING clause, which fails for NULL `organization_id`. SuperAdmin sees them via the first OR branch. Hence the visibility mismatch.

## Plan

### 1. Backfill legacy NULL-org rows (migration)

For every `batch` (and `course`) where `organization_id IS NULL`:
- Pick the first `organization_members.organization_id` of the row's `created_by` / `teacher_id` if available.
- If still null, fall back to the first organization in `organizations` (deterministic, oldest by `created_at`).
- Update the row.

After backfill, leave `organization_id` nullable in schema but the data will be populated.

### 2. Add a small SECURITY DEFINER helper (migration)

```sql
create or replace function public.first_org_for_user(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members
  where user_id = _user_id order by joined_at asc limit 1
$$;
```

Used by the edge function to auto-resolve an Admin's org when none is supplied.

### 3. Move batch CRUD to the `admin-query` edge function (service role)

Add new server-side handlers in `supabase/functions/admin-query/index.ts`:

- `list_batches` — selects batches with course join, optional `course_id` filter; if caller is Admin (not SuperAdmin) scope by the admin's org via `first_org_for_user(auth.uid())`. Determine caller role by reading `Authorization` header → `auth.getUser()` → `user_roles`.
- `create_batch` — accepts `{ course_id, name, max_students, organization_id? }`. If admin and `organization_id` not provided, resolve via `first_org_for_user`. Reject if still null. Insert with service role.
- `update_batch` — admin-scoped by org check; superadmin unrestricted.
- `delete_batch` — same scoping; cascades `batch_students` first.
- `list_batch_students`, `add_batch_student`, `remove_batch_student`, `batch_student_count` — same org-scope guard (verify the batch belongs to the admin's org before mutating).
- `assign_teacher_to_batch` (covered by `update_batch` with `teacher_id`) — same guard.

### 4. Wire client to the edge function

In `src/services/api/adminService.ts`, move these action names from the inline browser-RLS branch to the `edgeFunctionAction` switch list (lines 88–122):
`list_batches`, `create_batch`, `update_batch`, `delete_batch`, `list_batch_students`, `add_batch_student`, `remove_batch_student`, `batch_student_count`.

Remove the inline `createBatch / updateBatch / deleteBatch / listBatches / listBatchStudents / addBatchStudent / removeBatchStudent / batchStudentCount` functions.

No change needed in `BatchesPage.tsx` — service signature is unchanged.

### 5. Keep RLS as the safety net

No change to existing `batches` policies. They remain the defense-in-depth layer for any direct client access (now backfilled rows will pass `user_in_org`). The edge function uses the service role, which bypasses RLS but enforces equivalent org-scoping in code.

## Files to change

- `supabase/migrations/<new>.sql` — backfill NULL `organization_id` for `batches` and `courses`; create `first_org_for_user` function.
- `supabase/functions/admin-query/index.ts` — add 8 batch-related handlers with role+org resolution.
- `src/services/api/adminService.ts` — move batch action names into the edge function list; delete inline helpers.

## Verification

1. As Admin: open Batches → existing batches now appear. Create new batch → succeeds, row has `organization_id` set automatically. Edit / assign teacher / add student → all succeed.
2. As SuperAdmin: continues to see all batches across orgs; create still works.
3. RLS unchanged, so direct client attempts still respect policies.

## Out of scope

- Multi-org admin org picker UI. If an Admin belongs to multiple orgs, the first joined org is used. Can be added later if needed.
- Backfill of any other NULL-org legacy tables beyond `batches` and `courses`.
