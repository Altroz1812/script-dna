
-- Create student_progress table
CREATE TABLE IF NOT EXISTS public.student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  sessions_attended integer NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  completion_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage student_progress" ON public.student_progress
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins manage student_progress" ON public.student_progress
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view own progress" ON public.student_progress
FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Teachers view student progress" ON public.student_progress
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));
