

## Schedule Page — Two Bugs Found

### Bug 1: `bulk_create_schedules` action not routed
`scheduleService.bulkCreateSchedules()` calls `adminQuery('bulk_create_schedules', ...)`, but this action is missing from the `adminService.ts` switch statement. It hits the `default` case and throws `Unknown action: bulk_create_schedules`. It needs to be added to the edge function fallthrough list (since the edge function already handles it).

### Bug 2: Batch query missing course fields
The local `listBatches()` in `adminService.ts` (line 553) selects `courses(name)` only. The Schedule page depends on `courses.duration_days` to compute how many sessions to generate. Since `duration_days` is always `undefined`, `courseDays` is `0`, so `generatedEntries` is always empty and the Generate button stays disabled.

### Fix

1. **`src/services/api/adminService.ts`** — Add `bulk_create_schedules` to the edge function fallthrough list (line 119, before `return edgeFunctionAction(...)`)

2. **`src/services/api/adminService.ts`** — Update `listBatches()` select to include course duration fields:
   ```typescript
   .select('*, courses(name, duration_days, daily_hours, total_hours)')
   ```

### Files to modify
- `src/services/api/adminService.ts` (2 changes)

