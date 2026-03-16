

## Trainer Feature Audit

### Current State Summary

| Feature | Status | Gap |
|---------|--------|-----|
| **Classroom** | | |
| Start live class | **Done** | Teacher can create, start, end live classes with RLS |
| Video interaction | **Done** | Jitsi Meet iframe embedded via `VideoClassroom.tsx` |
| Screen share | **Done** | Built into Jitsi Meet |
| Mark attendance | **Broken** | AttendancePage uses `adminQuery` which calls Supabase with client-side RLS (admin/superadmin only). Teacher RLS exists on `attendance` table but the code path bypasses it by using `adminQuery('save_attendance')` which deletes+inserts via client SDK under admin-only RLS context. Need teacher-specific code path. |
| **Student Management** | | |
| View assigned students | **Partial** | StudentsPage uses `adminQuery('list_students_with_batches')` — admin only. Teachers can't see it. Nav shows it for teachers but data will fail. Need teacher-specific query filtering by `teacher_owns_batch`. |
| Track handwriting submissions | **Missing** | No UI or data model for tracking student handwriting submissions per teacher |
| View OCR comparison results | **Missing** | No OCR integration exists |
| **Assessment** | | |
| Review handwriting | **Missing** | No teacher assessment workflow |
| View trace overlay comparisons | **Missing** | No comparison UI for teacher vs student tracing |
| Provide feedback | **Missing** | No feedback mechanism (comments/scores per submission) |
| **Practice Management** | | |
| Assign practice sheets | **Missing** | No practice assignment model or UI |
| Share additional exercises | **Missing** | MaterialsPage is admin-only (RLS blocks teacher writes) |
| **Reports** | | |
| View student progress | **Missing** | ReportsPage is admin-only. No teacher-scoped progress view. |
| Track improvement trends | **Missing** | No teacher-facing analytics |

### Implementation Plan

#### Step 1 — Database: New tables + RLS updates

**New tables:**
- `practice_assignments` — teacher assigns practice sheets to batches (teacher_id, batch_id, course_id, title, description, file_url, due_date)
- `student_submissions` — student uploads handwriting work (assignment_id, student_id, file_url, score, teacher_feedback, status: pending/reviewed)

**RLS updates:**
- `materials`: Add teacher SELECT + INSERT policy scoped to courses linked to their batches
- `student_progress`: Teacher already has SELECT — confirmed working

**Practice assignments RLS:**
- Teacher ALL on own-batch assignments
- Student SELECT on their batch assignments
- Admin/Superadmin ALL

**Student submissions RLS:**
- Student INSERT + SELECT on own submissions
- Teacher SELECT + UPDATE (for feedback) on submissions for their batches
- Admin/Superadmin ALL

#### Step 2 — Fix AttendancePage for teachers

Replace `adminQuery` calls with direct Supabase queries when role is teacher:
- `list_attendance` → `supabase.from('attendance').select('*').eq('batch_id', x).eq('date', y)` (RLS filters)
- `save_attendance` → direct delete + insert on `attendance` table (teacher RLS allows this)

#### Step 3 — Fix StudentsPage for teachers

When role is teacher, query directly:
- `supabase.from('batch_students').select('*, profiles(*)').in('batch_id', teacherBatchIds)` instead of `adminQuery('list_students_with_batches')`

#### Step 4 — Practice Management pages

Create `src/pages/PracticeAssignmentsPage.tsx`:
- Teacher: create assignments (title, description, file upload, due date, select batch)
- Student: view assigned practice for their batches
- List with status indicators

Create `src/pages/StudentSubmissionsPage.tsx`:
- Student: submit handwriting image/file against an assignment
- Teacher: view submissions, add score + feedback, mark as reviewed
- Simple overlay comparison placeholder (show submitted image alongside reference)

#### Step 5 — Teacher Reports/Progress view

Update `ReportsPage` or create a teacher-specific view:
- Query `student_progress` for students in teacher's batches
- Show attendance rates per student (from `attendance` table)
- Show submission completion rates (from `student_submissions`)
- Simple bar charts for improvement trends

#### Step 6 — Navigation updates

Add to `navigation.ts`:
- "Practice" → `/practice` (roles: teacher, student)
- "Submissions" → `/submissions` (roles: teacher, student)
- Add `teacher` to Reports roles

Add routes to `App.tsx`.

### What will NOT be built (out of scope)

- **OCR comparison**: Requires ML/computer vision backend. Will add a placeholder "Coming Soon" card.
- **Trace overlay comparison**: Will add a basic side-by-side image view, not a pixel-level overlay engine.

### Files to create/modify

| File | Action |
|------|--------|
| Migration SQL | Create `practice_assignments`, `student_submissions` tables + RLS; add teacher policies to `materials` |
| `src/pages/AttendancePage.tsx` | Fix teacher code path with direct Supabase queries |
| `src/pages/StudentsPage.tsx` | Fix teacher code path with direct Supabase queries |
| `src/pages/PracticeAssignmentsPage.tsx` | New — assignment management |
| `src/pages/StudentSubmissionsPage.tsx` | New — submission + feedback UI |
| `src/pages/ReportsPage.tsx` | Add teacher-scoped progress tab |
| `src/config/navigation.ts` | Add Practice, Submissions; add teacher to Reports |
| `src/App.tsx` | Add new routes |

