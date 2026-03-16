

## Student Feature Audit

### Current State

| Feature | Status | Details |
|---------|--------|---------|
| **Course Access** | | |
| View enrolled courses | **Broken** | CoursesPage uses `courseService.listCourses()` → `adminQuery('list_courses')` which requires admin role. Students have public SELECT on courses table but the code path uses admin-only edge function. |
| Play lesson content | **Missing** | CurriculumPage is admin-only (nav restricts to superadmin/admin). No student-facing lesson viewer exists. |
| **Learning Tools** | | |
| Stroke-by-stroke animation | **Missing** | StrokeReplayCanvas exists but is only in Font Architect (admin tool). No student-facing integration. |
| Visual playback | **Missing** | Same — only available in admin Font Architect. |
| **Practice Tools** | | |
| Download practice sheets | **Partial** | PracticeAssignmentsPage has student view but no download button for `file_url`. |
| Camera capture | **Missing** | No camera/image capture component. |
| Upload handwriting | **Partial** | StudentSubmissionsPage lets students submit via URL only. No actual file upload to storage bucket. |
| **AI Evaluation** | | |
| OCR recognition | **Missing** | No OCR integration. |
| Original vs written comparison | **Missing** | No comparison UI. |
| Trace overlay feedback | **Missing** | No overlay component for students. |
| **Live Classes** | | |
| Join video classroom | **Broken** | LiveClassesPage has no student code path — only handles `isTeacher` and `isAdmin`. No RLS SELECT policy for students on `live_classes`. Students in nav config but page will fail. |
| **Progress Tracking** | | |
| View accuracy score | **Missing** | No student-facing score dashboard. |
| View improvement report | **Missing** | No student progress page. |
| Course completion status | **Partial** | `student_progress` table exists with student SELECT RLS, but no UI to display it. |

### Implementation Plan

#### Step 1 — Database: RLS for student access

- `live_classes`: Add student SELECT policy using `student_in_batch(auth.uid(), batch_id)`
- `schedules`: Add student SELECT policy using `student_in_batch(auth.uid(), batch_id)`
- `materials`: Add student SELECT policy scoped to courses of their enrolled batches

#### Step 2 — Fix CoursesPage for students

- When `role === 'student'`, query courses directly via Supabase (public SELECT RLS exists) instead of `adminQuery`
- Show enrolled courses prominently, with a "View Lessons" button linking to a student lesson viewer

#### Step 3 — Create StudentLessonViewer page

- New page: `src/pages/StudentLessonViewer.tsx`
- Route: `/courses/:courseId/lessons`
- Fetch `course_modules` and `lessons` for the course (both have authenticated SELECT RLS)
- Render collapsible modules with lesson content (text, file links)
- Include stroke replay component for handwriting lessons (reuse existing `StrokeReplayCanvas`)

#### Step 4 — Fix LiveClassesPage for students

- Add `isStudent` detection
- Students: query `live_classes` directly via Supabase (new RLS allows SELECT for their batches)
- Show only "Join" button for live classes (no create/start/end/delete controls)
- Embed Jitsi iframe when joining

#### Step 5 — Enhance Practice & Submissions for students

- PracticeAssignmentsPage: Add download button for `file_url` on assignments
- StudentSubmissionsPage: Replace URL input with actual file upload to `submissions` storage bucket
- Add simple camera capture button (use `<input type="file" accept="image/*" capture="environment">` for mobile camera)

#### Step 6 — Create Student Dashboard / Progress page

- New page: `src/pages/StudentProgressPage.tsx`
- Route: `/my-progress`
- Query `student_progress` for the logged-in student (RLS allows own data)
- Query `student_submissions` for scores and feedback
- Show: course completion %, accuracy scores from submissions, improvement trend chart
- Add a "Coming Soon" card for AI Evaluation (OCR, trace overlay)

#### Step 7 — Update Dashboard for students

- Currently Dashboard uses `adminQuery('get_stats')` which fails for students
- Add student-specific dashboard: show enrolled courses count, upcoming classes, recent submissions, completion %

#### Step 8 — Navigation & routing updates

- Add `/courses/:courseId/lessons` route
- Add `/my-progress` route (student only)
- Update Dashboard to handle student role
- Add "My Progress" nav item for students

### Files to create/modify

| File | Action |
|------|--------|
| Migration SQL | Add student RLS on `live_classes`, `schedules`, `materials` |
| `src/pages/StudentLessonViewer.tsx` | New — module/lesson viewer for students |
| `src/pages/StudentProgressPage.tsx` | New — progress dashboard |
| `src/pages/CoursesPage.tsx` | Add student query path |
| `src/pages/LiveClassesPage.tsx` | Add student view with Join button |
| `src/pages/PracticeAssignmentsPage.tsx` | Add download button |
| `src/pages/StudentSubmissionsPage.tsx` | Add file upload to storage |
| `src/pages/Dashboard.tsx` | Add student dashboard view |
| `src/config/navigation.ts` | Add My Progress; ensure student nav items |
| `src/App.tsx` | Add new routes |

### Out of scope (placeholder only)

- **OCR recognition**: Requires ML backend. Will show "Coming Soon" card.
- **Trace overlay comparison**: Will show placeholder. Full implementation needs canvas overlay engine.
- **AI Evaluation scoring**: Will note as upcoming feature.

