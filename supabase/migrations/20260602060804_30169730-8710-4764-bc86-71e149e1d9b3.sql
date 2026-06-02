ALTER TABLE public.practice_assignments
  ADD COLUMN IF NOT EXISTS module_id uuid,
  ADD COLUMN IF NOT EXISTS lesson_id uuid;