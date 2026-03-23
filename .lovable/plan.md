

## Show Batch/Slot Details on Courses Page with Seat Enforcement

### Problem
The Courses page currently shows only course cards without any batch/slot information. Users cannot see available batches, remaining seats, or select a batch before enrollment. There is no enforcement of the `max_students` limit on the UI side.

### What Changes

**1. Fetch batch data with student counts per course**
- For each course, query `batches` with their `max_students` and current enrolled count from `batch_students`
- Display this as an expandable section within each course card

**2. Show batch details on each course card**
- Under each course card, list available batches with: batch name, teacher name, enrolled count / max capacity, and a visual seat indicator (progress bar)
- Batches that are full show a "Full" badge and disable enrollment

**3. Batch selection before proceeding (for landing page cart flow)**
- Update `CartItem` type to include `batch_id` and `batch_name`
- On the landing page course carousel, clicking "Add to Cart" opens a batch picker dialog showing available batches with seat counts
- Only batches with available seats are selectable
- The selected batch is stored with the cart item

**4. Enforce max_students on the backend**
- Add a check in the `admin-query` edge function's `add_batch_student` action: count current students, reject if `>= max_students`

### Files to Change

| File | Action |
|------|--------|
| `src/pages/CoursesPage.tsx` | Add batch listing per course card with seat counts |
| `src/contexts/CartContext.tsx` | Extend `CartItem` with `batch_id` and `batch_name` |
| `src/pages/LandingPage.tsx` | Add batch selection dialog when adding to cart |
| `src/components/courses/BatchPickerDialog.tsx` | **New** — dialog to select a batch with seat availability |
| `supabase/functions/admin-query/index.ts` | Add seat limit check in `add_batch_student` |

### Technical Details

**CoursesPage batch display:**
- Fetch batches per course using `supabase.from('batches').select('*, batch_students(count)').eq('course_id', courseId)`
- For each batch, show: name, `enrolled / max_students` seats, teacher assignment
- Progress bar: green when < 75% full, yellow 75-90%, red > 90%

**BatchPickerDialog:**
- Receives `courseId`, fetches batches with counts
- Renders radio-style batch cards showing name, teacher, seats remaining
- Full batches are greyed out and unselectable
- On confirm, adds the course + selected batch to cart

**Backend enforcement (admin-query `add_batch_student`):**
```sql
SELECT COUNT(*) FROM batch_students WHERE batch_id = $1
-- compare against batches.max_students, throw error if full
```

**CartItem extension:**
```typescript
export interface CartItem {
  id: string;          // course id
  name: string;
  description: string | null;
  fee: number;
  grade_level: string | null;
  duration_days: number | null;
  batch_id: string;    // NEW
  batch_name: string;  // NEW
}
```

