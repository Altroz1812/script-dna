
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS course_duration TEXT,
  ADD COLUMN IF NOT EXISTS completion_date DATE DEFAULT CURRENT_DATE;
