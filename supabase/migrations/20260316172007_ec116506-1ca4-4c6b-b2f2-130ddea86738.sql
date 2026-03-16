
-- Create practice_assignments table
CREATE TABLE public.practice_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_assignments ENABLE ROW LEVEL SECURITY;

-- Create student_submissions table
CREATE TYPE public.submission_status AS ENUM ('pending', 'reviewed');

CREATE TABLE public.student_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.practice_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  file_url text,
  score numeric,
  teacher_feedback text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_submissions ENABLE ROW LEVEL SECURITY;

-- Practice assignments RLS
CREATE POLICY "Teachers manage own assignments"
ON public.practice_assignments FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students view batch assignments"
ON public.practice_assignments FOR SELECT TO authenticated
USING (student_in_batch(auth.uid(), batch_id));

CREATE POLICY "Admins manage practice_assignments"
ON public.practice_assignments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Student submissions RLS
CREATE POLICY "Students manage own submissions"
ON public.student_submissions FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers view and review submissions"
ON public.student_submissions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_assignments pa
    WHERE pa.id = assignment_id AND teacher_owns_batch(auth.uid(), pa.batch_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_assignments pa
    WHERE pa.id = assignment_id AND teacher_owns_batch(auth.uid(), pa.batch_id)
  )
);

CREATE POLICY "Admins manage student_submissions"
ON public.student_submissions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Teacher can read materials for courses linked to their batches
CREATE POLICY "Teachers view materials"
ON public.materials FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    WHERE b.course_id = materials.course_id AND b.teacher_id = auth.uid()
  )
);

-- Teacher can insert materials for courses linked to their batches
CREATE POLICY "Teachers insert materials"
ON public.materials FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.batches b
    WHERE b.course_id = materials.course_id AND b.teacher_id = auth.uid()
  )
);

-- Teacher can view student_progress for their batches
CREATE POLICY "Teachers view batch student_progress"
ON public.student_progress FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    WHERE b.id = student_progress.batch_id AND b.teacher_id = auth.uid()
  )
);

-- Create storage bucket for submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', true);

-- Storage RLS for submissions bucket
CREATE POLICY "Authenticated users upload submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Public read submissions"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'submissions');

-- Add realtime for submissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_submissions;
