## Plan: Batch screen organization scoping and assignment display

### What I’ll fix
1. **Route all Batch screen data through the secure admin gateway**
   - Update `BatchesPage` / `batchService` so batches, courses, teachers, students, enrollments, counts, teacher assignment, and student add/remove use `adminQuery(...)` instead of direct frontend database queries.
   - Include `activeOrgId` in React Query keys for `courses`, `batches`, dialogs, and invalidation so org switching cannot reuse stale data.

2. **Fix teacher and student dropdown scoping**
   - Ensure `list_teachers` returns only teachers assigned to the selected organization through `organization_members` and/or batches in that organization.
   - Ensure `list_all_students` returns only students assigned to the selected organization through `organization_members` and/or enrollments in that organization.
   - Stop using “first organization membership” inside the backend function when `target_org_id` is present; use the active selected org instead.

3. **Fix enrolled student list and counts**
   - Ensure `list_batch_students`, `batch_student_count`, `add_batch_student`, and `remove_batch_student` validate the batch belongs to the selected org.
   - Prevent adding a student who is not assigned to the active organization.
   - Restore max-student enforcement during add.

4. **Show assigned teacher and student info on cards**
   - Make `list_batches` return:
     - `teacher_name`
     - `enrolled_count`
     - optionally `enrolled_students` summary for the batch card
     - course metadata used in the card, including `courses.name` and `courses.delivery_mode`
   - Update Batch cards to show the actual assigned teacher name instead of just “Assigned”.
   - Show assigned student count and, if space allows, visible assigned student names/summary on each batch card.

5. **Remove duplicate/conflicting backend handlers**
   - Consolidate duplicated `list_batches`, `list_teachers`, and `list_all_students` logic in `admin-query` so only one scoped implementation can run.
   - Keep all tenant-sensitive filtering in the backend function, not in page-level filtering.

### Validation
- Switch between organizations as a multi-org admin and confirm:
  - Batch list changes per org.
  - Course dropdown only shows active org courses.
  - Teacher dropdown only shows active org teachers.
  - Student dropdown only shows active org students.
  - Assigned teacher/student data on cards updates after assignment.
  - No stale data remains after organization swap.