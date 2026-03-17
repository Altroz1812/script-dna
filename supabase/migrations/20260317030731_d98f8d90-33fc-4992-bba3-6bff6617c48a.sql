
-- Create a trigger function that auto-marks attendance when a live class is completed
CREATE OR REPLACE FUNCTION public.auto_mark_attendance_on_class_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO public.attendance (batch_id, student_id, date, status, schedule_id)
    SELECT 
      NEW.batch_id,
      bs.student_id,
      CURRENT_DATE,
      'present'::attendance_status,
      NEW.schedule_id
    FROM batch_students bs
    WHERE bs.batch_id = NEW.batch_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on live_classes table
CREATE TRIGGER trg_auto_mark_attendance
AFTER UPDATE ON public.live_classes
FOR EACH ROW
EXECUTE FUNCTION public.auto_mark_attendance_on_class_end();

-- Add unique constraint to prevent duplicate attendance per student/batch/date
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_unique_student_batch_date 
UNIQUE (student_id, batch_id, date);
