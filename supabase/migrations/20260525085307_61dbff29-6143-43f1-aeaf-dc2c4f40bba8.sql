
-- 1) Add permanent meeting room per batch
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS meeting_room text,
  ADD COLUMN IF NOT EXISTS meeting_link_expires_at timestamptz;

-- 2) Backfill existing batches
UPDATE public.batches
   SET meeting_room = 'batch-' || substr(id::text, 1, 8)
 WHERE meeting_room IS NULL;

-- 3) Auto-fill trigger on insert
CREATE OR REPLACE FUNCTION public.set_batch_meeting_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.meeting_room IS NULL OR NEW.meeting_room = '' THEN
    NEW.meeting_room := 'batch-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_set_batch_meeting_room ON public.batches;
CREATE TRIGGER trg_set_batch_meeting_room
  BEFORE INSERT ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_batch_meeting_room();

-- 4) Update auto_create_live_class so each spawned live_class
--    inherits the batch's permanent meeting_room as its meeting_url.
CREATE OR REPLACE FUNCTION public.auto_create_live_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room text;
BEGIN
  IF NEW.date IS NOT NULL THEN
    SELECT meeting_room INTO v_room FROM public.batches WHERE id = NEW.batch_id;
    INSERT INTO public.live_classes
      (batch_id, schedule_id, title, scheduled_at, duration_minutes, status, meeting_url)
    VALUES (
      NEW.batch_id,
      NEW.id,
      NEW.title,
      (NEW.date || 'T' || NEW.start_time)::timestamptz,
      EXTRACT(EPOCH FROM (NEW.end_time::time - NEW.start_time::time)) / 60,
      'scheduled',
      v_room
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Backfill existing live_classes with their batch's permanent room
UPDATE public.live_classes lc
   SET meeting_url = b.meeting_room
  FROM public.batches b
 WHERE lc.batch_id = b.id
   AND (lc.meeting_url IS NULL OR lc.meeting_url <> b.meeting_room);

-- 6) Prevent duplicate schedule rows for same batch/date/start_time
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_batch_date_start
  ON public.schedules (batch_id, date, start_time)
  WHERE date IS NOT NULL;
