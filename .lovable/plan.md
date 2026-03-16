

## Parent Feature Audit & Implementation Plan

### Current State

| Feature | Status | Details |
|---------|--------|---------|
| **Child Management** | | |
| View enrolled children | **Missing** | StudentsPage has teacher + admin paths but no parent path. No `parent_children` linking table exists. |
| Add/manage child profiles | **Missing** | No parent-child relationship model. |
| **Learning Monitoring** | | |
| View child course progress | **Missing** | `student_progress` has no parent RLS policy. No parent UI. |
| View accuracy scores | **Missing** | No parent access to `student_submissions`. |
| View practice submissions | **Missing** | Same — no parent RLS or UI. |
| **Live Class Visibility** | | |
| See scheduled classes | **Missing** | No parent RLS on `live_classes` or `schedules`. |
| Attendance tracking | **Missing** | No parent RLS on `attendance`. |
| **Payments** | | |
| Pay course fees | **Broken** | PaymentsPage uses `adminQuery` — parent can't use it. Nav shows Payments for parent but page fails. |
| View payment history | **Broken** | Same — `adminQuery` blocks. No parent RLS on `payments`. |
| Apply coupons | **Partial** | Coupons have public SELECT for active ones, but no parent checkout flow. |
| **Certificates** | | |
| Download completion certificates | **Missing** | No certificate model or generation. |

### Implementation Plan

#### Step 1 — Database: `parent_children` table + RLS policies

Create a `parent_children` linking table and a `parent_of_student` security definer function. Then add parent SELECT policies to: `student_progress`, `student_submissions`, `practice_assignments`, `attendance`, `live_classes`, `schedules`, `payments`, `batch_students`, `batches`.

```sql
-- Linking table
CREATE TABLE public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, child_id)
);
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.parent_of_student(_parent_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM parent_children WHERE parent_id = _parent_id AND child_id = _student_id)
$$;

-- RLS on parent_children: parents see own links, admins manage all
-- Parent SELECT policies on student_progress, student_submissions, attendance, etc.
-- Parent SELECT on payments WHERE student_id is their child
-- Parent INSERT on payments (to pay fees)
```

#### Step 2 — Parent Dashboard

Add a parent-specific view in `Dashboard.tsx`:
- Show linked children with course progress summaries
- Upcoming classes for children
- Recent payment status
- Quick links: My Children, Payments, Attendance

#### Step 3 — Parent Children Page

Create `src/pages/ParentChildrenPage.tsx`:
- List linked children with their enrolled courses and progress
- "Add Child" flow: enter child's email/ID to request linkage (or admin links them)
- Click a child to see detailed progress, submissions, attendance

#### Step 4 — Parent Payments Page

Update `PaymentsPage.tsx` with a parent code path:
- Query `payments` directly (parent RLS filters to their children's payments)
- Show payment history with status
- "Pay Now" button that creates a pending payment record
- Coupon application via `coupons` table (public SELECT already exists)

#### Step 5 — Parent Progress View

Create `src/pages/ParentProgressPage.tsx`:
- Select child from dropdown
- Show child's `student_progress` (completion %, courses)
- Show child's `student_submissions` (scores, feedback)
- Show child's `attendance` summary
- Show child's upcoming `live_classes`

#### Step 6 — Certificates (placeholder)

Add a "Certificates" section in the parent progress view:
- Show completed courses
- "Download Certificate" button (generates a simple PDF client-side using course name + student name + completion date)

#### Step 7 — Navigation & routing

Update `navigation.ts`:
- Add "My Children" → `/my-children` (parent only)
- Add "Child Progress" → `/child-progress` (parent only)
- Payments already included for parent
- Add "Attendance" for parent role

Add routes to `App.tsx`.

### Files to create/modify

| File | Action |
|------|--------|
| Migration SQL | Create `parent_children` table, `parent_of_student` function, parent RLS policies on 8+ tables |
| `src/pages/ParentChildrenPage.tsx` | New — child management |
| `src/pages/ParentProgressPage.tsx` | New — child progress/attendance/submissions view |
| `src/pages/PaymentsPage.tsx` | Add parent code path with direct Supabase queries |
| `src/pages/Dashboard.tsx` | Add parent dashboard view |
| `src/config/navigation.ts` | Add My Children, Child Progress, Attendance for parent |
| `src/App.tsx` | Add new routes |

### Out of scope
- **Payment gateway integration**: Will record payments locally. Real payment processing can be added later via Stripe.
- **Certificate PDF generation**: Will use a simple client-side approach with html2canvas or basic template. No server-side PDF.

