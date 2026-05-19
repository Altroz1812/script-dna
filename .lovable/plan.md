## Goal
Capture a start date + start time + end time (and weekly recurrence days) inside the **Create Batch** dialog so we can:
1. Auto-create the batch's first schedule slot in one shot (no separate Schedule page step).
2. Run the existing teacher/student conflict checks **before** the batch is created — preventing double-booking at the source.

All prior conflict-validation work (teacher assign, student add, schedule slot, manage flows) stays intact and continues to work.

## UX — Create Batch dialog (`src/pages/BatchesPage.tsx`)
Extend the existing dialog with new required fields below "Max Students":

```
Course               [select]
Batch Name           [text]
Max Students         [number]
─── Schedule ───
Start Date           [date picker]            // first session date
Start Time           [time]   End Time [time] // e.g. 16:00 – 17:00
Repeats Weekly On    [Mon Tue Wed Thu Fri Sat Sun]  // multi-select chips, default = day-of-week of Start Date
(Optional) Assign Teacher [select - reuse list_teachers]
```

Validation (client-side, before submit):
- All schedule fields required.
- `end_time > start_time`.
- `start_date >= today`.
- At least one weekday selected.

On submit:
1. If a teacher is picked → call `check_slot_conflicts({ teacher_id, date, day_of_week, start_time, end_time })` (new edge action, see below). Show inline red banner with other-batch name if any conflict; block save.
2. Create the batch via `batchService.createBatch(...)`.
3. Immediately bulk-insert one schedule row per selected weekday using existing `scheduleService.bulkCreateSchedules` — the row matching the Start Date keeps the date; recurring weekday-only rows have `date = null`.
4. If a teacher was picked, `batchService.assignTeacher(newBatchId, teacherId)`.
5. Toast success → close dialog → invalidate `['batches']` and `['schedules']`.

Failure handling: if step 3 or 4 fails after batch insert, rollback by deleting the new batch (call `deleteBatch`) so partial state isn't left behind.

## Backend — `supabase/functions/admin-query/index.ts`
Add **one** new read action (reuses existing overlap primitive):

`check_slot_conflicts({ teacher_id?, student_ids?: string[], date?, day_of_week, start_time, end_time, exclude_batch_id? })`
- Loads schedules where `(teacher matches via batches.teacher_id) OR (student in batch_students)`, scoped to same `date` or same `day_of_week`.
- Returns `{ teacher_conflicts: [...], student_conflicts: [...] }`.
- `exclude_batch_id` lets the existing teacher/student dialogs keep using the same action without false self-matches.

The existing `check_teacher_conflicts` and `check_student_conflicts` actions remain — no breaking changes.

## Service layer — `src/services/api/courseService.ts`
- Add `batchService.checkSlotConflicts(args)` wrapper.
- Extend `createBatch` signature is unchanged; new schedule rows go through the existing `scheduleService.bulkCreateSchedules`.

## Files touched
- `src/pages/BatchesPage.tsx` — extend Create Batch dialog + handler.
- `src/services/api/courseService.ts` — add `checkSlotConflicts` wrapper.
- `supabase/functions/admin-query/index.ts` — add `check_slot_conflicts` action.

## Out of scope
- Editing/back-filling schedule slots on existing batches (still done on Schedule page).
- Multiple time slots per day in one dialog (single slot only; extra slots via Schedule page as today).
- Room/location field in this dialog (existing schedule UI keeps that).

## Why this preserves previous changes
The teacher-dialog, student-dialog, and Schedule-page conflict banners introduced earlier remain in place and untouched. The new action only adds an additional entry-point check; existing actions keep their callers.
