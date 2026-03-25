

## Role-Based Dashboards (RBAC)

### Problem
The dashboard currently has three views: Student, Parent, and a shared Admin/Teacher view. Teachers see the same admin dashboard with stats cards (Total Users, Organizations, Leads, Payments) and quick-action buttons (New Course, New Lead, Add User) that are irrelevant to them. Support role also falls into this admin view.

### Changes

**Update `src/pages/Dashboard.tsx`**

1. **Add a dedicated Teacher dashboard** (new `isTeacher` check before the admin fallback):
   - Stats cards: My Batches count, My Students count, Upcoming Classes, Pending Submissions
   - Query: fetch teacher's batches, count students across those batches, upcoming live classes for their batches, pending submissions for their assignments
   - Quick links: My Batches, Attendance, Live Classes, Practice Assignments, Submissions

2. **Add a dedicated Support dashboard**:
   - Stats cards: Total Leads, Total Enrollments, Open Payments
   - Query: count leads, batch_students, pending payments
   - Quick links: Leads, Enrollments, Students, Payments

3. **Refine Admin dashboard** (non-superadmin admin):
   - Remove superadmin-only quick actions (Add User) -- already done
   - Keep: Courses, Batches, Students, Teachers stats
   - Show org-scoped data only (already working via organizationId filter)

4. **Keep existing Student, Parent, and Superadmin dashboards** as they are

### Flow Logic
```text
if (isStudent)    → Student dashboard
if (isParent)     → Parent dashboard
if (isTeacher)    → Teacher dashboard  ← NEW
if (isSupport)    → Support dashboard  ← NEW
else              → Admin/Superadmin dashboard (existing)
```

### Files
| File | Action |
|------|--------|
| `src/pages/Dashboard.tsx` | Add teacher and support dashboard sections with role-specific queries, stats, and quick links |

### Technical Details

**Teacher dashboard queries:**
- `batches` where `teacher_id = profile.id` → count
- `batch_students` joined through teacher's batches → student count
- `live_classes` for teacher's batches, status in ['scheduled','live'] → upcoming classes
- `student_submissions` joined via `practice_assignments.teacher_id` → pending count

**Support dashboard queries:**
- `leads` count
- `batch_students` count (enrollments)
- `payments` where status = 'pending' → count

