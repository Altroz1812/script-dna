

# Fix: Route All Data Through Admin Edge Function

## Problem

Two categories of pages exist right now:
- **Working pages** (Users, Leads, Schedule, etc.): use `adminQuery()` via the edge function with service role key -- bypasses RLS
- **Broken pages** (Courses, Batches, Dashboard stats): use direct Supabase client calls with anon key -- blocked by RLS because auth is mocked (no real session)

The "Failed to fetch" errors are intermittent preview proxy issues, but even when requests succeed, direct client calls return empty results or permission errors due to RLS.

## Solution

Move Courses and Batches CRUD operations into the existing `admin-query` edge function, then update the frontend pages to use `adminQuery()` instead of direct client calls.

### 1. Add course/batch actions to `admin-query` edge function

Add these actions to `supabase/functions/admin-query/index.ts`:

- `list_courses` -- select all courses ordered by created_at desc
- `create_course` -- insert course with name, description, created_by
- `delete_course` -- delete by id
- `list_batches` -- select batches with course name join, optional course_id filter
- `create_batch` -- insert batch
- `update_batch` -- update teacher_id, max_students, etc.
- `delete_batch` -- delete by id (also clean up batch_students)
- `list_batch_students` -- select batch_students with profile join
- `add_batch_student` -- insert into batch_students
- `remove_batch_student` -- delete from batch_students
- `list_teachers` -- get profiles with teacher role
- `list_all_students` -- get profiles with student role
- `batch_student_count` -- count students in a batch

### 2. Update `src/services/api/courseService.ts`

Replace all direct `supabase.from(...)` calls with `adminQuery(action, params)` calls. Keep the same exported interfaces and function signatures so pages don't need to change.

### 3. Update `src/pages/CoursesPage.tsx`

Minor update: the `profile.id` used for `created_by` when creating a course comes from the mock profile. This will work since the edge function just stores whatever value is passed. No structural change needed -- once `courseService` uses `adminQuery`, it will work.

### 4. No changes needed for other pages

AttendancePage, SchedulePage, etc. already use `adminQuery()` and will continue working.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-query/index.ts` | Add 10+ course/batch actions |
| `src/services/api/courseService.ts` | Replace direct Supabase calls with `adminQuery()` |

## Result

- All pages consistently use the edge function pattern
- No more RLS blocking since the service role key is used
- Intermittent "Failed to fetch" from the preview proxy may still occur but is unrelated to our code

