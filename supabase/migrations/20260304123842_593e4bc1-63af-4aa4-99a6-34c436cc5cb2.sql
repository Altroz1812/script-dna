
-- Create a SECURITY DEFINER function to check if a teacher teaches a student
-- This avoids RLS recursion between profiles -> batch_students -> batches
CREATE OR REPLACE FUNCTION public.teacher_has_student(_teacher_id uuid, _student_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM batch_students bs
    JOIN batches b ON b.id = bs.batch_id
    WHERE bs.student_id = _student_user_id
      AND b.teacher_id = _teacher_id
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Teachers view batch student profiles" ON public.profiles;

-- Recreate with the security definer function (no RLS recursion)
CREATE POLICY "Teachers view batch student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND public.teacher_has_student(auth.uid(), user_id)
);
