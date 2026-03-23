

## Admin/SuperAdmin Class Management & Teacher Reassignment

### What Changes

**1. Allow Admin/SuperAdmin to start and join any live class**
Currently `startClass` works for admins via `adminQuery`, but the Join button only shows for teachers and students. Update the ClassCard logic so admins/superadmins see Start and Join buttons on all classes regardless of batch ownership.

**2. Show assigned teacher info on each class card**
Fetch `batches(name, teacher_id, courses(delivery_mode))` and join teacher profile data so each card displays the assigned teacher's name. This gives admins visibility into who should be teaching.

**3. Add "Reassign Teacher" dialog for admins**
A new dialog component (`ReassignTeacherDialog`) that:
- Shows current assigned teacher
- Lists available teachers (from `list_teachers` admin query)
- Allows selecting a replacement teacher
- Updates the `batches.teacher_id` for that batch via `adminQuery('update_batch', { id, teacher_id })`
- Optionally sends a notification to the new teacher

**4. Update VideoClassroom to grant teacher privileges to admins**
The `isTeacher` prop already accepts `isTeacher || isAdmin` from LiveClassesPage, so admins joining get teacher controls. No change needed here.

**5. Track who started the class**
Add a `started_by` column to `live_classes` so it's clear if an admin started the class on behalf of a teacher. The assigned teacher can then see "Class started by Admin" and join directly.

### Files to Change

| File | Action |
|------|--------|
| `src/pages/LiveClassesPage.tsx` | Update ClassCard buttons: admins see Start/Join on all classes; add Reassign button; fetch teacher profile; pass `started_by` on start |
| `src/components/classroom/ReassignTeacherDialog.tsx` | **New** — dialog to pick a new teacher from available list and update batch |
| `src/services/api/adminService.ts` | Add `reassign_batch_teacher` action that updates `batches.teacher_id` |
| Database migration | Add `started_by uuid` column to `live_classes` table |

### Technical Details

**Database migration:**
```sql
ALTER TABLE public.live_classes 
ADD COLUMN started_by uuid DEFAULT NULL;
```

**LiveClassesPage changes:**
- Expand `LiveClass` type to include `batches.teacher_id` and a teacher profile name
- In `startClass`, pass `started_by: profile.id` when admin starts
- ClassCard: show teacher name, add "Reassign" button (admin only, scheduled classes), show "Started by Admin" badge when `started_by` differs from batch teacher
- Fix duplicate Join button (lines 171-186 show Join for both `isLive && canManage` and `isStudent && isLive`)

**ReassignTeacherDialog:**
- Fetches teacher list via `adminQuery('list_teachers')`
- On confirm, calls `adminQuery('update_batch', { id: batchId, teacher_id: newTeacherId })`
- Optionally creates a notification for the new teacher

