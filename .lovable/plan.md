

## Offline + Online Course Mode — Incremental Plan

### What the User Wants
Based on the uploaded schedule and request:
1. Courses must be tagged as **"offline"** or **"online"** (delivery method)
2. Offline courses need a **center/location** field (e.g., "Kudlu Gate", "HSR Layout")
3. Courses page should display offline and online courses **separately** (two sections or tabs)
4. Course creation form needs a **delivery_mode** field (offline/online) + conditional **center** field
5. Course **edit/update** functionality (currently missing — only create + delete exists)
6. Batches and schedules remain the same but are linked to the course's mode
7. Offline classes → teacher marks attendance **manually** (already works via AttendancePage)
8. Online classes → existing LiveKit video classroom flow
9. Payments and checkout process remain unchanged

### Database Changes

**Migration: Add `delivery_mode` and `center` columns to `courses` table**

```sql
ALTER TABLE public.courses ADD COLUMN delivery_mode text NOT NULL DEFAULT 'online';
ALTER TABLE public.courses ADD COLUMN center text NULL;
```

- `delivery_mode`: `'online'` or `'offline'`
- `center`: location name for offline courses (nullable, only relevant when offline)
- Default `'online'` so existing courses keep working

No new tables needed. No RLS changes needed (existing policies cover it).

### Frontend Changes

**1. Update `CoursesPage.tsx`**
- Add tabs or segmented filter: "Online Courses" / "Offline Courses" / "All"
- Each course card shows a badge: `Online` or `Offline` + center name if offline
- Add an **Edit** button on each course card (admin only)
- Edit dialog: same form as create, pre-populated, calls a new `update_course` admin action

**2. Update Course Create Dialog (in `CoursesPage.tsx`)**
- Add `delivery_mode` radio/select: Online | Offline
- When "Offline" selected, show a `center` text input (location name)
- Pass `delivery_mode` and `center` to the create mutation

**3. Update `courseService.ts`**
- Add `delivery_mode` and `center` fields to `Course` and `CreateCourseParams` types
- Add `updateCourse()` method calling `admin_query('update_course', ...)`

**4. Update `admin-query/index.ts` edge function**
- Add `delivery_mode` and `center` to `create_course` insert
- Add new `update_course` action: updates all editable fields by course ID

**5. Update `LiveClassesPage.tsx` (minimal)**
- For offline courses, the "Join" video button should not appear — only manual attendance applies
- Online courses keep the LiveKit video flow as-is
- This requires knowing the course's `delivery_mode` via the batch → course join (already available in live_classes query via `batches`)

**6. Update `BatchesPage.tsx` (minimal)**
- Show the course delivery mode badge next to batch names so admins know which batches are online vs offline

### What Stays Unchanged
- Attendance page (already supports manual marking for any batch)
- Schedule creation (works for both modes — just time slots)
- Payments and checkout flow
- LiveKit integration (only used when course is online)
- Database RLS policies

### Implementation Order
1. Database migration (add 2 columns)
2. Edge function updates (create_course + new update_course action)
3. Course service types update
4. Course page: delivery mode in create form + edit dialog + filtered display
5. LiveClassesPage: hide video join for offline courses
6. BatchesPage: show delivery mode badge

