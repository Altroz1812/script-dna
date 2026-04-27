## Problem

When a course is created, only the `name` is saved. Fee, duration, hours, language, writing style, grade level, delivery mode, and center are all lost. Editing a course also fails silently.

Confirmed against the database — the most recent course "Brush Pen Calligraphy" was saved with `fee=0` and all other fields `NULL`, even though the form had defaults and (presumably) values entered.

## Root cause

`src/services/api/adminService.ts` intercepts `create_course` (line 75) and routes it to a local function (line 539) that **only inserts `name`, `description`, `created_by`** — ignoring every other field:

```ts
async function createCourse(params: any) {
  const { name, description, created_by } = params;
  const { data, error } = await supabase.from('courses').insert({ name, description, created_by })...
}
```

The full-featured `create_course` handler in the `admin-query` edge function (which correctly handles fee, duration, etc.) is never reached because the local handler short-circuits it.

Additionally, `update_course` is **not registered at all** in `adminService.ts`, so editing a course throws "Unknown action: update_course" — which is why edits also don't persist.

## Fix

In `src/services/api/adminService.ts`:

1. **Remove** the local `createCourse` function and the `case 'create_course'` line from the switch — let it fall through to the `edgeFunctionAction` block so the edge function (which already has the complete insert logic) handles it.
2. **Add** `'update_course'` to the list of cases routed to `edgeFunctionAction`.
3. Leave `list_courses` and `delete_course` as they are (they work fine).

No edge function changes needed — `supabase/functions/admin-query/index.ts` already inserts all fields correctly (verified at lines 402–426).

No database changes, no frontend form changes.

## Verification

After the fix:
- Create a course with fee 2499, duration 30 days, language English, writing style Cursive, offline at HSR Layout → all fields persist.
- Edit an existing course's fee → update succeeds and reflects in the list.
