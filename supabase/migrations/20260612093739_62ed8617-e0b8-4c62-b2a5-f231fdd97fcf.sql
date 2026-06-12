
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  course_name text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

CREATE INDEX idx_certificates_student ON public.certificates(student_id);
CREATE INDEX idx_certificates_batch ON public.certificates(batch_id);
CREATE INDEX idx_certificates_org ON public.certificates(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own certificates" ON public.certificates
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Parents view child certificates" ON public.certificates
  FOR SELECT TO authenticated
  USING (public.parent_of_student(auth.uid(), student_id));

CREATE POLICY "Teachers view batch certificates" ON public.certificates
  FOR SELECT TO authenticated
  USING (public.teacher_owns_batch(auth.uid(), batch_id));

CREATE POLICY "Teachers issue certificates" ON public.certificates
  FOR INSERT TO authenticated
  WITH CHECK (public.teacher_owns_batch(auth.uid(), batch_id));

CREATE POLICY "Admins manage certificates" ON public.certificates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role)
         OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_in_org(auth.uid(), organization_id))
         OR (public.has_role(auth.uid(), 'support'::app_role) AND public.user_in_org(auth.uid(), organization_id)))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role)
              OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_in_org(auth.uid(), organization_id))
              OR (public.has_role(auth.uid(), 'support'::app_role) AND public.user_in_org(auth.uid(), organization_id)));
