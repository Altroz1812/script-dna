# Fix wrong live-class times (timezone bug)

## Root cause
The DB trigger `public.auto_create_live_class` constructs the `scheduled_at` value as:

```sql
(NEW.date || 'T' || NEW.start_time)::timestamptz
```

Casting a string straight to `timestamptz` makes Postgres apply the **session timezone**, which on Supabase is **UTC**. So a schedule entry `date=2026-05-26, start_time=19:36` ends up stored as `2026-05-26 19:36:00+00` (= **7:36 PM UTC**). When the browser then renders it with `format(parseISO(scheduled_at), 'h:mm a')` it converts UTC → local. For an IST user (UTC+5:30) that schedule shows **01:06 AM next day**, and conversely a teacher who scheduled `01:06 AM IST` sees `7:36 PM`. This matches the symptom (card showing 7:36 PM – 8:36 PM while the scheduled time was different).

Front-end formatting itself is fine — `parseISO` + `format` already render in the user's local TZ. The bug is purely in how the trigger writes the timestamp.

## Fix

### 1. New migration: correct the trigger and backfill existing rows

- Replace `auto_create_live_class` so it builds a `timestamp` first (no TZ), then converts using `AT TIME ZONE 'Asia/Kolkata'` (the project's operational locale per `mem://style/localization`):

  ```sql
  ((NEW.date || ' ' || NEW.start_time)::timestamp AT TIME ZONE 'Asia/Kolkata')
  ```

  Postgres semantics: `<timestamp> AT TIME ZONE 'Asia/Kolkata'` = "interpret this wall-clock time as IST, return the equivalent timestamptz". So `19:36` entered by a teacher is stored as `14:06 UTC` and renders back as `19:36 IST` on every IST device.

- Backfill: recompute `scheduled_at` and `duration_minutes` on existing `live_classes` rows by joining their `schedule_id` to `schedules`, using the same `AT TIME ZONE 'Asia/Kolkata'` expression. Only touch rows where `schedule_id` is not null (auto-generated ones). Manually-created live classes whose `scheduled_at` is correct stay untouched.

### 2. No front-end changes required
- `LiveClassesPage.tsx`, `MobileLiveClassesPage.tsx`, `BatchDetailPage.tsx`, `useTodayClasses.ts`, `ClassQuickJoinCards.tsx` already use `parseISO(scheduled_at)` + date-fns `format` (local TZ). Once the DB value is correct, all display surfaces become correct automatically.
- `SchedulePage.tsx` only manipulates `start_time` / `end_time` strings (no TZ involved); leave it as is.

## Files touched
- New SQL migration under `supabase/migrations/` (trigger replacement + one backfill `UPDATE`).
- No code files modified.

## Verification
After the migration runs:
1. Pick one auto-created class from `live_classes` whose `schedule_id` is set; confirm `to_char(scheduled_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI')` equals `schedules.date || schedules.start_time`.
2. Reload the Live Classes page (mobile + desktop) and confirm the card time matches the teacher's intended slot.
