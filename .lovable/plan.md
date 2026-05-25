
## Goals

1. **One permanent meeting link per batch** — generated once at batch creation, reused for every session.
2. **Comprehensive Batch detail page** showing teacher, course, students, progress, day-wise session status.
3. **Clear separation** between auto-schedule (recurring template) and manual schedule (one-off exceptions).
4. **Reduce DB writes & token use** — no per-day meeting-link generation, no duplicate live_classes.

---

## 1. Unified Meeting Link Per Batch

**Schema change** (migration):
- Add `batches.meeting_room` (text) and `batches.meeting_link_expires_at` (timestamptz, nullable = batch end + grace).
- On batch INSERT, a trigger sets `meeting_room = 'batch-' || substr(id::text, 1, 8)` if null.
- Backfill existing batches with the same scheme.

**Behavior change**:
- `startLiveClass` (`src/services/classroom/startClass.ts`) no longer mints a per-class room. It reads `batches.meeting_room` and just flips the `live_classes.status` to `'live'`. The `meeting_url` column on `live_classes` becomes a denormalized mirror of the batch room (kept for back-compat; populated by trigger from the batch row, never client-generated).
- `livekit-token` edge function uses `roomName` from the request as-is. No edge-function change required; client sends batch's room.
- `auto_create_live_class` trigger (on schedules INSERT) updated to copy `meeting_url` from the parent batch instead of leaving null.

**Result**: A batch has one room for its lifetime. Joining any of its sessions (live, today, upcoming) drops the user into the same LiveKit room.

---

## 2. Cleaner Auto vs Manual Schedule

- **Auto-schedule** = the canonical recurring template (working days × time-of-day × N course-days). Generates the full session itinerary at batch-creation time (already happens; we keep this).
- **Manual schedule** = additive only. Used for extra/substitute/holiday-rescheduled sessions. The "Add Manually" dialog in `SchedulePage` will be relabelled **"Add Extra / Reschedule Session"**, default-restricted to dates outside the auto-set, and warn if the chosen slot already has an auto-session.
- Remove the duplicate auto-generation path inside `BatchesPage.handleCreateBatch` if the dedicated Auto-Schedule generator in `SchedulePage` will own it. Decision: keep batch-creation generation (single source) and **remove** the standalone Auto-Schedule dialog on `SchedulePage`, leaving only Manual + filter/list views. This guarantees one canonical generation pass per batch.
- Add a guard on `scheduleService.bulkCreateSchedules` that rejects (or de-dupes) any row whose `(batch_id, date, start_time)` already exists.

---

## 3. New Batch Detail Page (Desktop + Mobile)

Route: `/batches/:batchId` → `src/pages/BatchDetailPage.tsx` (desktop) and `src/pages/mobile/MobileBatchDetailPage.tsx`. Cards in `BatchesPage` / `MobileBatchesPage` open this page on click.

**Sections** (single page, lazy-loaded):

| Section | Source |
|---|---|
| Header: batch name, course name, status pill | `batches` + `courses` |
| Meeting link card with Copy / Open buttons, validity dates | `batches.meeting_room` + computed `wss://…` |
| Teacher card: name, email, avatar | `profiles` via `batches.teacher_id` |
| Course card: name, description, total_hours, duration_days, daily_hours | `courses` |
| Students table: name, email, % progress | `batch_students` + `student_progress` |
| Progress summary: hours completed (sum of completed live_classes.duration_minutes ÷ 60), pending = total_hours − completed | aggregated |
| Day-wise session status timeline: each `live_classes` row with badge ✅ Completed / 🔴 Live / ⏳ Upcoming / ❌ Cancelled | `live_classes` ordered by `scheduled_at` |
| Footer action: "Add Extra Session" → opens manual-schedule dialog pre-filled for this batch | reused |

**Data fetching**:
- Single `admin-query` action `get_batch_detail(batch_id)` returns batch + course + teacher + students + sessions in one round-trip. Cached for 5 min with React Query; refetch on focus disabled to save tokens.
- Mobile reuses the same query and renders the same sections inside `MobilePage` with stacked cards.

---

## 4. Cost / Token Efficiency Measures

- One `get_batch_detail` call replaces 4–5 separate fetches.
- React Query `staleTime: 5 min`, no `refetchOnWindowFocus`.
- No per-day meeting-link generation, no extra writes when joining a class.
- `bulkCreateSchedules` uses `ON CONFLICT DO NOTHING` so the auto-trigger never spawns duplicate live_classes if re-run.

---

## Technical Details

**Migration (new file)**
```sql
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS meeting_room text,
  ADD COLUMN IF NOT EXISTS meeting_link_expires_at timestamptz;

-- backfill
UPDATE public.batches SET meeting_room = 'batch-' || substr(id::text, 1, 8)
  WHERE meeting_room IS NULL;

-- trigger to auto-fill on insert
CREATE OR REPLACE FUNCTION public.set_batch_meeting_room()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.meeting_room IS NULL THEN
    NEW.meeting_room := 'batch-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_batch_meeting_room
  BEFORE INSERT ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_batch_meeting_room();

-- update auto_create_live_class to pull meeting_url from batch
-- (re-create with the same body, adding meeting_url select from batches)
```

**Files to add**
- `src/pages/BatchDetailPage.tsx`
- `src/pages/mobile/MobileBatchDetailPage.tsx`
- `src/components/batches/MeetingLinkCard.tsx`
- `src/components/batches/SessionTimeline.tsx`

**Files to edit**
- `src/App.tsx` — add `/batches/:batchId` route
- `src/pages/BatchesPage.tsx` — card → `navigate('/batches/' + id)`; remove duplicate schedule generation (keep one path); show meeting_room badge
- `src/pages/mobile/MobileBatchesPage.tsx` — same nav
- `src/pages/SchedulePage.tsx` — remove Auto-Schedule dialog, rename "Add Manually" → "Add Extra / Reschedule"
- `src/services/classroom/startClass.ts` — read batch.meeting_room instead of minting `class-<id8>`
- `src/services/api/courseService.ts` — `Batch` type gets `meeting_room`, `meeting_link_expires_at`; add `batchService.getBatchDetail(id)`
- `supabase/functions/admin-query/index.ts` — add `get_batch_detail` action; ensure `list_batches` returns `meeting_room`

**Out of scope**
- Changing LiveKit token semantics or `livekit-token` edge function.
- Any change to font / handwriting modules.
- Roles, RLS, payments, attendance flow — untouched.
