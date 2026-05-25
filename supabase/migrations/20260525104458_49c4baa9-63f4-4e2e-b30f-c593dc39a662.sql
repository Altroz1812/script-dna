-- Fix timezone bug in auto_create_live_class: interpret schedule date+start_time as Asia/Kolkata local time
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
      ((NEW.date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata'),
      EXTRACT(EPOCH FROM (NEW.end_time::time - NEW.start_time::time)) / 60,
      'scheduled',
      v_room
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill existing auto-generated live_classes whose scheduled_at was stored as UTC instead of IST.
UPDATE public.live_classes lc
SET
  scheduled_at = ((s.date::text || ' ' || s.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata'),
  duration_minutes = EXTRACT(EPOCH FROM (s.end_time::time - s.start_time::time)) / 60
FROM public.schedules s
WHERE lc.schedule_id = s.id
  AND s.date IS NOT NULL;
