
-- Add schedule_id to live_classes linking to an existing schedule entry
ALTER TABLE public.live_classes
  ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;

-- Create index for the FK
CREATE INDEX idx_live_classes_schedule_id ON public.live_classes(schedule_id);
