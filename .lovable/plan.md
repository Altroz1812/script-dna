## Goal
Prevent any teacher or student from being double-booked across batches that have overlapping schedule slots. Validate proactively at every point where a conflict could be introduced: schedule-slot creation, teacher assignment, and student enrollment.

## Why this shape (data model reality)
- `batches` rows do NOT carry date/time. Time lives in `schedules` (batch_id, date, day_of_week, start_time, end_time).
- Conflicts therefore must be computed by joining a batch's schedule rows against other batches' schedule rows where the teacher or student overlaps.
- `SchedulePage` already runs room/time overlap detection. We extend the same overlap primitive to teacher/student dimensions.

## Active-batch definition
Treat a batch as "active" if it has at least one schedule slot with `date >= today` (or any `day_of_week` slot with no date, since recurring). No schema change. (We can add an `is_active` flag later if admins ask for archive behavior.)

## Backend — `supabase/functions/admin-query/index.ts`
Add three read-only actions used by the UI for live validation:

1. `check_teacher_conflicts({ teacher_id, batch_id })`
   - Loads all schedules of `batch_id`.
   - Loads all schedules of other batches where `teacher_id` matches.
   - Returns `[{ date|day_of_week, start_time, end_time, other_batch_name }]` for every overlap.

2. `check_student_conflicts({ student_id, batch_id })`
   - Loads all schedules of `batch_id`.
   - Loads all schedules of other batches the student is in (`batch_students`).
   - Returns overlap list with `other_batch_name`.

3. `check_slot_conflicts({ batch_id, date|day_of_week, start_time, end_time })`
   - Used at schedule-slot creation. Returns separate `teacher_conflicts` and `student_conflicts` arrays (so the SchedulePage can show both before insert).

Overlap rule (matches existing SchedulePage logic): `a.start < b.end AND b.start < a.end`, scoped by same `date` if both have one, else same `day_of_week`.

## Frontend changes

### `src/pages/BatchesPage.tsx` — Assign Teacher Dialog
- On `selectedTeacher` change (and on Save), call `check_teacher_conflicts`.
- If conflicts → show inline red banner with message:
  *"Teacher already has another batch assigned for the selected time slot. Please choose another teacher or time slot."* plus a list (date/day, time, other batch name).
- Disable the Save button while conflicts exist. Bypass only via explicit "Override (Admin)" link (off by default).

### `src/pages/BatchesPage.tsx` — Manage Students Dialog
- Before calling `addStudent`, run `check_student_conflicts(selectedStudent, batch.id)`.
- If conflicts → show warning dialog:
  *"One or more students are already assigned to another batch during the selected time slot."* with details. Block add (Admin override link allowed).
- Also annotate the student `<Select>` options that have any conflict with a small "⚠ conflict" suffix so the admin sees it before picking.

### `src/pages/SchedulePage.tsx` — Schedule Slot Creation
- Extend existing `conflictsFor()` to also surface teacher and student overlaps via `check_slot_conflicts`.
- Show two extra sections inside the existing conflict banner: "Teacher conflicts" and "Student conflicts". Auto-schedule and Manual flows both blocked when any conflict exists.
- Friendly copy reused from above.

### Shared helper
`src/lib/conflicts.ts` — pure `overlaps(aStart, aEnd, bStart, bEnd)` + `formatConflictMessage(list)` for consistent wording.

## UX details
- All conflict messages are non-technical, name the other batch + slot, and offer the resolution ("choose another teacher / time / student").
- Validation runs on selection change (debounced 300ms) AND on submit — submit is the hard gate.
- Loading state shown while the check is in flight; never lets the user submit during fetch.

## Out of scope
- Schema flag `is_active` on batches (can add later if requested).
- Editing existing schedules — only creation paths. (Edit can be added with the same primitive when needed.)
- Notifying affected teachers/students.

## Files touched
- `supabase/functions/admin-query/index.ts` — 3 new read actions.
- `src/lib/conflicts.ts` — new helper.
- `src/services/api/courseService.ts` — wrappers for the 3 new actions.
- `src/pages/BatchesPage.tsx` — teacher + student dialogs.
- `src/pages/SchedulePage.tsx` — extend conflict banner.
