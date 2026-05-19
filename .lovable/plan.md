## Root cause — confirmed bug, not just missing data

`batch_students.student_id` is supposed to store the **auth `user_id`** (that's what every student-side RLS policy and every student-side query filters on — `student_id = auth.uid()`). But the admin "Add Student" flow is inserting **`profiles.id`** instead.

Evidence from the live DB:

```
batch_students.student_id = db03f395-…  (profiles.id of student@demo.com)
profiles.user_id          = 17e2a982-…  (the real auth user id)
```

So:
- Admin UI shows the student as enrolled (correct — admin queries join via `profiles.id`).
- When `student@demo.com` logs in, `auth.uid()` is `17e2a982-…`, which doesn't match `db03f395-…`, so RLS returns nothing → all student screens blank.

### Where the bug lives

1. `supabase/functions/admin-query/index.ts`
   - **Branch A — lines 838-894 (`add_batch_student`)**: resolves the param to `studentProfile.id` and inserts that. Should insert `studentProfile.user_id`.
   - **Branch B — lines 1556-1564 (`add_batch_student` second handler)**: blindly inserts `params.student_id`. Needs the same normalization.
   - **`list_batch_students` (lines ~820-836)**: joins `profiles.id = student_id` — only "works" because of this same bug. Must join `profiles.user_id = batch_students.student_id`.

2. `src/pages/BatchesPage.tsx`
   - Line 343 calls `batchService.addStudent(batch.id, selectedStudent)` where `selectedStudent` is the dropdown's `s.id` (profile.id). Must pass `s.user_id`.
   - Line 370-371: `enrolledIds = new Set(enrolledStudents.map(e => e.student_id))` then `students.filter(s => !enrolledIds.has(s.id))` — comparison mixes user_id vs profile.id. Must compare against `s.user_id`.

3. Other places that may carry the same mistake (audit, fix if found):
   - `src/components/courses/BatchPickerDialog.tsx`
   - `src/components/classroom/EndClassAttendanceDialog.tsx`
   - `src/pages/ReportsPage.tsx`
   - `src/pages/ParentChildrenPage.tsx`

### Why this matches your symptom exactly
"Student added by super admin shows as added in front end" — yes, because admin-side join uses `profiles.id`. But for the student, RLS uses `auth.uid()`, which is `user_id`, so they see nothing.

---

## Fix plan (4 steps, isolated, zero impact on admin/teacher/parent existing flows)

### Step 1 — Patch edge function `admin-query`
- **`add_batch_student` (Branch A)**: keep profile lookup, but insert `studentProfile.user_id`, not `studentProfile.id`. Duplicate check by `user_id` too.
- **`add_batch_student` (Branch B)**: same normalization (accept either profile.id or user_id, persist user_id).
- **`list_batch_students` (both branches)**: join `profiles.user_id = batch_students.student_id` and return the profile.
- **`remove_batch_student`**: accept either, normalize to user_id before delete (safety).
- **`check_student_conflicts`**: normalize too if it uses student_id.

### Step 2 — Patch frontend `BatchesPage.tsx`
- Pass `s.user_id` (not `s.id`) to `addStudent`.
- Compute `enrolledIds` from `e.student_id` and filter `students` by `s.user_id`.
- Audit `BatchPickerDialog`, `EndClassAttendanceDialog`, `ReportsPage`, `ParentChildrenPage` for the same swap.

### Step 3 — Backfill the 2 broken rows
One-time data fix: for each `batch_students` row whose `student_id` doesn't match any `auth.users.id`, look it up via `profiles.id` and rewrite to the matching `profiles.user_id`. After this, the existing `db03f395-…` rows become valid enrollments for `student@demo.com`, who will immediately see their batches, schedule, live classes, attendance, etc.

### Step 4 — Verify
- Log in as `student@demo.com` → Dashboard, Schedule, Live Classes, Practice Assignments, Courses must show the two batches and their classes.
- Log in as Admin → Batches → Manage Students → list still shows the same enrolled students (no regression).
- Add a new student via Admin UI → DB row now stores `user_id`, and that student sees it immediately.

## Out of scope
- The big refactor plan (still parked in `.lovable/plan.md`).
- Any change to teacher, parent, payments, payroll, or superadmin flows beyond the small audit in Step 2.
- Schema changes — `batch_students.student_id` stays as-is; we're just fixing what gets written to it.

Approve and I'll implement Steps 1–4 in order.
