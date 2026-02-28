

# Fix: Eliminate Edge Function Bottleneck -- Direct Database Queries

## Problem

The `admin-query` edge function works perfectly when called directly from the server (200 OK, sub-second responses). However, every request from the browser goes through the **preview proxy**, which consistently drops or times out these requests. This has been the root cause across all previous fix attempts -- retries, CORS headers, sequential queuing, and timeout increases all failed because the proxy itself is the bottleneck.

All 15+ data pages route through this single edge function, creating a single point of failure.

## Solution

Replace the edge function architecture with **direct Supabase client queries**. Since all database tables already have permissive RLS policies (verified via linter -- all show `USING (true)`), the Supabase JS client can query tables directly without needing the service role key or an edge function proxy.

## Changes

### 1. Rewrite `src/services/api/adminService.ts`

Replace the edge function fetch with direct Supabase client calls:

```typescript
import { supabase } from '@/integrations/supabase/client';

export async function adminQuery(action: string, params: any = {}) {
  switch (action) {
    case 'get_stats': return getStats();
    case 'list_users': return listUsers();
    case 'list_courses': return listCourses();
    case 'list_batches': return listBatches(params);
    // ... all other actions mapped similarly
  }
}

async function listCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
// ... etc for each action
```

This keeps the same `adminQuery(action, params)` interface so **no page components need to change**.

### 2. Keep `src/services/api/courseService.ts` unchanged

It already calls `adminQuery()` which will now route to direct DB queries instead of the edge function.

### 3. No changes to any page components

All 15+ pages (Dashboard, Courses, Batches, Users, Leads, Enrollments, Schedule, Attendance, LiveClasses, Materials, Payments, Payroll, Reports, Notifications, Roles, Students) continue calling `adminQuery()` or services that wrap it -- they will just work faster.

### 4. Fix React `forwardRef` warnings

The console shows `Function components cannot be given refs` warnings on Dialog components. Will audit and fix the affected components.

## Technical Details

The rewritten `adminService.ts` will contain approximately 40 functions mapping each `action` string to direct Supabase queries. The logic mirrors what the edge function already does (the same `.select()`, `.insert()`, `.update()`, `.delete()` calls) but runs client-side, eliminating:

- Edge function cold starts
- Preview proxy round-trips
- CORS preflight overhead
- Sequential queuing delays

All existing actions from the edge function will be ported:
- Stats: `get_stats`
- Users: `list_users`, `update_user`, `delete_user`, `change_role`
- Organizations: `list_organizations`, `create_organization`, `delete_organization`, `list_org_members`, `add_org_member`, `remove_org_member`
- Leads: `list_leads`, `create_lead`, `update_lead`, `delete_lead`
- Enrollments: `list_enrollments`
- Schedules: `list_schedules`, `create_schedule`, `update_schedule`, `delete_schedule`
- Attendance: `list_attendance`, `save_attendance`
- Live Classes: `list_live_classes`, `create_live_class`, `update_live_class`, `delete_live_class`
- Materials: `list_materials`, `create_material`, `delete_material`
- Payments: `list_payments`, `create_payment`, `update_payment`
- Payroll: `list_payroll`, `create_payroll`, `update_payroll`
- Notifications: `list_notifications`, `create_notification`, `mark_read`, `delete_notification`
- Students: `list_students_with_batches`, `list_teachers`, `list_all_students`
- Courses: `list_courses`, `create_course`, `delete_course`
- Batches: `list_batches`, `create_batch`, `update_batch`, `delete_batch`, `list_batch_students`, `add_batch_student`, `remove_batch_student`, `batch_student_count`
- Roles: `list_roles`

## Expected Result

- Pages load instantly (direct DB queries, no proxy, no cold starts)
- No more "Failed to fetch" errors
- React ref warnings fixed
- Zero changes needed to any page component

