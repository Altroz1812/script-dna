-- 1. Drop the old FK that references profiles(id)
ALTER TABLE public.batch_students
  DROP CONSTRAINT IF EXISTS batch_students_student_id_fkey;

-- 2. Backfill: rewrite any student_id that is actually a profiles.id into the matching user_id
UPDATE public.batch_students bs
SET student_id = p.user_id
FROM public.profiles p
WHERE bs.student_id = p.id
  AND bs.student_id <> p.user_id;

-- 3. Re-add the FK, now correctly referencing profiles(user_id) which is UNIQUE
ALTER TABLE public.batch_students
  ADD CONSTRAINT batch_students_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;