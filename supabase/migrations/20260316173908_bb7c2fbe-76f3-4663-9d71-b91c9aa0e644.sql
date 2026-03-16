
-- Parent-children linking table
CREATE TABLE public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, child_id)
);
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.parent_of_student(_parent_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM parent_children WHERE parent_id = _parent_id AND child_id = _student_id)
$$;

-- RLS on parent_children
CREATE POLICY "Parents view own links" ON public.parent_children FOR SELECT TO authenticated USING (parent_id = auth.uid());
CREATE POLICY "Admins manage parent_children" ON public.parent_children FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Parent SELECT on student_progress
CREATE POLICY "Parents view child progress" ON public.student_progress FOR SELECT TO authenticated USING (parent_of_student(auth.uid(), student_id));

-- Parent SELECT on student_submissions
CREATE POLICY "Parents view child submissions" ON public.student_submissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM parent_children pc WHERE pc.parent_id = auth.uid() AND pc.child_id = student_submissions.student_id)
);

-- Parent SELECT on practice_assignments (via child's batch)
CREATE POLICY "Parents view child assignments" ON public.practice_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM parent_children pc JOIN batch_students bs ON bs.student_id = pc.child_id WHERE pc.parent_id = auth.uid() AND bs.batch_id = practice_assignments.batch_id)
);

-- Parent SELECT on attendance
CREATE POLICY "Parents view child attendance" ON public.attendance FOR SELECT TO authenticated USING (
  parent_of_student(auth.uid(), student_id)
);

-- Parent SELECT on live_classes (via child's batch)
CREATE POLICY "Parents view child live_classes" ON public.live_classes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM parent_children pc JOIN batch_students bs ON bs.student_id = pc.child_id WHERE pc.parent_id = auth.uid() AND bs.batch_id = live_classes.batch_id)
);

-- Parent SELECT on schedules (via child's batch)
CREATE POLICY "Parents view child schedules" ON public.schedules FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM parent_children pc JOIN batch_students bs ON bs.student_id = pc.child_id WHERE pc.parent_id = auth.uid() AND bs.batch_id = schedules.batch_id)
);

-- Parent SELECT on payments (child's payments)
CREATE POLICY "Parents view child payments" ON public.payments FOR SELECT TO authenticated USING (
  parent_of_student(auth.uid(), student_id)
);

-- Parent INSERT on payments (pay for child)
CREATE POLICY "Parents create child payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  parent_of_student(auth.uid(), student_id)
);

-- Parent SELECT on batch_students (child's enrollments)
CREATE POLICY "Parents view child batch_students" ON public.batch_students FOR SELECT TO authenticated USING (
  parent_of_student(auth.uid(), student_id)
);

-- Parent SELECT on batches (child's batches)
CREATE POLICY "Parents view child batches" ON public.batches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM parent_children pc JOIN batch_students bs ON bs.student_id = pc.child_id WHERE pc.parent_id = auth.uid() AND bs.batch_id = batches.id)
);

-- Parent SELECT on profiles (child's profile)
CREATE POLICY "Parents view child profiles" ON public.profiles FOR SELECT TO authenticated USING (
  parent_of_student(auth.uid(), user_id)
);
