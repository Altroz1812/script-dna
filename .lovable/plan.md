

## Trainer/Classroom Feature Audit

### Current State

| Feature | Status | Details |
|---------|--------|---------|
| Start live class | **Partial** | Teacher sees Live Classes in nav, but RLS only allows admin/superadmin to manage `live_classes`. Teacher can view but cannot create or update status to "live". No "Start Class" UX. |
| Video interaction with students | **Missing** | No video/WebRTC integration exists. Meeting URL is a plain link to external service (Google Meet, Zoom). No embedded video. |
| Screen share | **Missing** | No screen sharing capability. Same gap as video. |
| Mark attendance | **Partial** | Teacher has nav access to Attendance page. However, RLS on `attendance` table only has admin/superadmin policies — no teacher policy. Teacher queries will return empty / fail silently. |

### Gaps to Fix

**1. RLS: Teacher access to `live_classes` and `attendance`**
- `live_classes` needs a SELECT policy for teachers who own the batch (`teacher_owns_batch`)
- `live_classes` needs UPDATE policy so teachers can change status to "live"/"completed"
- `attendance` needs ALL policy for teachers on their own batches (`teacher_owns_batch`)
- `schedules` currently only has admin/superadmin — teacher needs SELECT for their batches

**2. Live Classes page — Teacher-specific UX**
- Add a "Start Class" button that sets status to `live` (instead of generic status dropdown)
- Add a "Join" button that opens meeting URL in new tab
- Filter live classes to only show teacher's own batches (use `teacher_owns_batch` or filter client-side)
- Teachers should be able to create live classes for their own batches and add meeting URLs

**3. Attendance page — Teacher RLS fix**
- The page works functionally but the `attendance` table RLS blocks teacher inserts/updates
- `batchService.getStudents()` and `batchService.listBatches()` already have teacher RLS, so the batch/student loading works
- Only the attendance read/write is blocked

**4. Video & Screen Share — External integration approach**
- Embedding full WebRTC is out of scope for a Lovable project (no backend for signaling)
- Practical approach: Integrate with external meeting providers via meeting URL
- Add a prominent "Start/Join Class" experience that opens the meeting URL
- Optionally add a meeting URL generator (e.g., Google Meet link creation)
- Add an embedded iframe option for providers that support it (e.g., Jitsi Meet which is free and embeddable)

### Implementation Plan

**Step 1 — Database migration: Add teacher RLS policies**
```sql
-- Teacher can view live classes for their batches
CREATE POLICY "Teachers view own batch live_classes"
ON public.live_classes FOR SELECT TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can update live classes for their batches (start/end)
CREATE POLICY "Teachers update own batch live_classes"
ON public.live_classes FOR UPDATE TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id))
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can insert live classes for their batches
CREATE POLICY "Teachers insert own batch live_classes"
ON public.live_classes FOR INSERT TO authenticated
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher manages attendance for their batches
CREATE POLICY "Teachers manage attendance"
ON public.attendance FOR ALL TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id))
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can view schedules for their batches
CREATE POLICY "Teachers view own batch schedules"
ON public.schedules FOR SELECT TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id));
```

**Step 2 — Revamp LiveClassesPage for teacher role**
- Detect user role via `useRBAC()`
- For teachers: filter to only their batches, show "Start Class" / "End Class" buttons, prominent "Join Meeting" button
- Add an optional Jitsi Meet embed: when teacher clicks "Start Class", open an embedded Jitsi room (free, no account needed) with the class ID as room name
- Add a simple `<iframe>` component for the Jitsi room that both teacher and students can join

**Step 3 — Add Jitsi-based video classroom component**
- Create `src/components/classroom/VideoClassroom.tsx`
- Uses Jitsi Meet external API (free, no API key needed): `https://meet.jit.si/{room-name}`
- Includes screen share capability built into Jitsi
- Teacher starts the room; students join via the same embed on their Live Classes page
- Store the auto-generated Jitsi URL as the `meeting_url` on the live class record

**Step 4 — Update Attendance page**
- No code changes needed — the RLS fix in Step 1 unblocks teacher access
- The existing `batchService.listBatches()` already filters by `teacher_owns_batch` for teachers

### Architecture Notes
- Jitsi Meet is completely free, requires no API keys, and provides video + screen share + chat out of the box
- Room names will be derived from the live class ID to ensure uniqueness
- The embedded iframe approach works within Lovable's frontend-only constraint
- Teacher's "Start Class" flow: click Start → status set to `live` → Jitsi embed opens → students see "Join" button on their view

