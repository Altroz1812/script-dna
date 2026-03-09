
-- Create security definer function to check if student is enrolled in a batch
-- This breaks the RLS recursion between batches <-> batch_students
CREATE OR REPLACE FUNCTION public.student_in_batch(_student_id uuid, _batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM batch_students
    WHERE student_id = _student_id AND batch_id = _batch_id
  )
$$;

-- Create security definer function to check if teacher is assigned to a batch
CREATE OR REPLACE FUNCTION public.teacher_owns_batch(_teacher_id uuid, _batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM batches
    WHERE id = _batch_id AND teacher_id = _teacher_id
  )
$$;

-- Fix the recursive policy on batches: Students view enrolled batches
DROP POLICY IF EXISTS "Students view enrolled batches" ON public.batches;
CREATE POLICY "Students view enrolled batches"
ON public.batches
FOR SELECT
TO authenticated
USING (
  public.student_in_batch(auth.uid(), id)
);

-- Fix the recursive policy on batch_students: Teachers view batch students
DROP POLICY IF EXISTS "Teachers view batch students" ON public.batch_students;
CREATE POLICY "Teachers view batch students"
ON public.batch_students
FOR SELECT
TO authenticated
USING (
  public.teacher_owns_batch(auth.uid(), batch_id)
);
