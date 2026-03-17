
-- Create a trigger function that auto-creates a live_class for every new schedule entry with a date
CREATE OR REPLACE FUNCTION public.auto_create_live_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create live_class if the schedule has a date (dated sessions)
  IF NEW.date IS NOT NULL THEN
    INSERT INTO public.live_classes (batch_id, schedule_id, title, scheduled_at, duration_minutes, status)
    VALUES (
      NEW.batch_id,
      NEW.id,
      NEW.title,
      (NEW.date || 'T' || NEW.start_time)::timestamptz,
      EXTRACT(EPOCH FROM (NEW.end_time::time - NEW.start_time::time)) / 60,
      'scheduled'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on schedules table
CREATE TRIGGER trg_auto_create_live_class
AFTER INSERT ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_live_class();
