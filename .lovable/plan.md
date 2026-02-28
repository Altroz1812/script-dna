

# Complete Super Admin Module -- Full Implementation

## Current State
- **Working:** Dashboard (basic), Courses (CRUD), Batches (CRUD with teacher/student assignment)
- **Placeholder pages (13):** Schedule, Attendance, Live Classes, Materials, Leads, Enrollments, Users, Students, Payments, Payroll, Reports, Notifications, Organizations, Roles, Settings
- **Auth:** Bypassed with mock superadmin (as requested)
- **Database:** Tables exist for profiles, user_roles, organizations, organization_members, courses, batches, batch_students

## What Will Be Built

All 13 placeholder pages replaced with fully functional modules. Since auth is bypassed, all data operations will use the service-key edge function pattern where RLS would block, or direct client calls where RLS allows.

### Phase 1: Dashboard with Real Stats

**Dashboard** -- Replace static card with live stats:
- Total users, courses, batches, organizations, students, teachers
- Recent activity feed
- Quick-action buttons (create course, add user, etc.)

### Phase 2: User & Role Management

**Users Page** (`/users`)
- Table listing all profiles with role, email, display name, org
- Create user (invite via email)
- Edit user display name
- Delete user
- Search/filter by role

**Roles & Permissions Page** (`/roles`)
- View all users grouped by role
- Change user role (dropdown: superadmin, admin, support, teacher, student, parent)
- Role counts summary

**Students Page** (`/students`)
- Filtered view of student-role users
- Show enrolled batches per student
- Quick-enroll into a batch

### Phase 3: Organizations

**Organizations Page** (`/organizations`)
- List all organizations with member count
- Create organization (name, slug)
- Delete organization
- Add/remove members from organization
- View members list per org

### Phase 4: CRM Module

**Leads Page** (`/leads`)
- New `leads` table in database (name, email, phone, status, source, notes, created_at)
- Lead statuses: new, contacted, qualified, converted, lost
- CRUD operations
- Convert lead to student (creates user + assigns student role)

**Enrollments Page** (`/enrollments`)
- View all batch_students as enrollment records
- Shows student name, batch, course, enrolled date
- Bulk view across all batches

### Phase 5: Academic Tools

**Schedule Page** (`/schedule`)
- New `schedules` table (batch_id, title, day_of_week, start_time, end_time, room)
- Weekly grid view by batch
- CRUD for schedule entries

**Attendance Page** (`/attendance`)
- New `attendance` table (schedule_id, student_id, date, status: present/absent/late)
- Mark attendance per batch per date
- View attendance history

**Live Classes Page** (`/live-classes`)
- New `live_classes` table (batch_id, title, meeting_url, scheduled_at, duration_minutes, status)
- Create/schedule live class sessions
- Status tracking (scheduled, live, completed)

**Materials Page** (`/materials`)
- New `materials` table (course_id, title, description, file_url, material_type, uploaded_by)
- Upload materials (PDF, docs) to storage
- List/filter by course

### Phase 6: Finance

**Payments Page** (`/payments`)
- New `payments` table (student_id, amount, currency, status, payment_date, description)
- Record payments, view history
- Filter by student, status

**Payroll Page** (`/payroll`)
- New `payroll` table (teacher_id, amount, month, year, status, paid_at)
- Monthly payroll management
- Mark as paid/pending

### Phase 7: Tools

**Reports Page** (`/reports`)
- Summary cards: revenue, attendance rate, enrollment count
- Aggregated queries from existing tables

**Notifications Page** (`/notifications`)
- New `notifications` table (user_id, title, message, read, created_at)
- Send notification to user/role group
- Mark as read

**Settings Page** (`/settings`)
- App-level settings display
- Organization branding config
- System info

## Database Migrations Required

New tables to create:
1. `leads` -- CRM lead tracking
2. `schedules` -- Class scheduling
3. `attendance` -- Student attendance
4. `live_classes` -- Virtual class sessions
5. `materials` -- Course materials
6. `payments` -- Student payments
7. `payroll` -- Teacher payroll
8. `notifications` -- System notifications

Each table will have proper RLS policies using the existing `has_role()` function.

## New Files

| File | Purpose |
|------|---------|
| `src/pages/UsersPage.tsx` | User management with table + CRUD |
| `src/pages/RolesPage.tsx` | Role assignment UI |
| `src/pages/StudentsPage.tsx` | Student-filtered view |
| `src/pages/OrganizationsPage.tsx` | Org management |
| `src/pages/LeadsPage.tsx` | CRM leads |
| `src/pages/EnrollmentsPage.tsx` | Enrollment overview |
| `src/pages/SchedulePage.tsx` | Weekly schedule |
| `src/pages/AttendancePage.tsx` | Attendance tracking |
| `src/pages/LiveClassesPage.tsx` | Live class management |
| `src/pages/MaterialsPage.tsx` | Course materials |
| `src/pages/PaymentsPage.tsx` | Payment records |
| `src/pages/PayrollPage.tsx` | Teacher payroll |
| `src/pages/ReportsPage.tsx` | Reports dashboard |
| `src/pages/NotificationsPage.tsx` | Notification center |
| `src/pages/SettingsPage.tsx` | System settings |
| `src/services/api/leadService.ts` | Lead CRUD service |
| `src/services/api/scheduleService.ts` | Schedule CRUD service |
| `src/services/api/attendanceService.ts` | Attendance service |
| `src/services/api/liveClassService.ts` | Live class service |
| `src/services/api/materialService.ts` | Materials service |
| `src/services/api/paymentService.ts` | Payment service |
| `src/services/api/payrollService.ts` | Payroll service |
| `src/services/api/notificationService.ts` | Notification service |
| `supabase/functions/admin-query/index.ts` | Edge function for admin data queries (bypasses RLS) |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Replace all PlaceholderPage routes with real page components |
| `src/pages/Dashboard.tsx` | Add real stats cards with counts from database |

## Edge Function: `admin-query`

Since auth is bypassed (mock session), direct Supabase client calls will hit RLS blocks. A single `admin-query` edge function using the service role key will handle all admin read/write operations, accepting an `action` parameter to route to the correct query.

## Implementation Order

1. Database migrations (all 8 tables)
2. Edge function for admin queries
3. Service layer files
4. Page components (one per module)
5. Update App.tsx routing
6. Update Dashboard with real stats

