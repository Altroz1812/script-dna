
-- ============================================================
-- Multi-tenant hardening: add organization_id + org-scoped RLS
-- ============================================================

-- 1. Add nullable organization_id columns
ALTER TABLE public.attendance           ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.live_classes         ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.schedules            ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.materials            ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.practice_assignments ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.student_submissions  ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.student_progress     ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.payments             ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.payroll              ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.leads                ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.orders               ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.coupons              ADD COLUMN IF NOT EXISTS organization_id uuid;

-- 2. Backfill from parent tables
UPDATE public.attendance a           SET organization_id = b.organization_id FROM public.batches b WHERE a.batch_id = b.id AND a.organization_id IS NULL;
UPDATE public.live_classes l         SET organization_id = b.organization_id FROM public.batches b WHERE l.batch_id = b.id AND l.organization_id IS NULL;
UPDATE public.schedules s            SET organization_id = b.organization_id FROM public.batches b WHERE s.batch_id = b.id AND s.organization_id IS NULL;
UPDATE public.materials m            SET organization_id = c.organization_id FROM public.courses c WHERE m.course_id = c.id AND m.organization_id IS NULL;
UPDATE public.practice_assignments p SET organization_id = b.organization_id FROM public.batches b WHERE p.batch_id = b.id AND p.organization_id IS NULL;
UPDATE public.student_submissions ss SET organization_id = pa.organization_id FROM public.practice_assignments pa WHERE ss.assignment_id = pa.id AND ss.organization_id IS NULL;
UPDATE public.student_progress sp    SET organization_id = b.organization_id FROM public.batches b WHERE sp.batch_id = b.id AND sp.organization_id IS NULL;
UPDATE public.student_progress sp    SET organization_id = c.organization_id FROM public.courses c WHERE sp.course_id = c.id AND sp.organization_id IS NULL;
UPDATE public.payments p             SET organization_id = pr.organization_id FROM public.profiles pr WHERE p.student_id = pr.user_id AND p.organization_id IS NULL;
UPDATE public.payroll  p             SET organization_id = pr.organization_id FROM public.profiles pr WHERE p.teacher_id = pr.user_id AND p.organization_id IS NULL;

-- 3. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_attendance_org           ON public.attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_org         ON public.live_classes(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedules_org            ON public.schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_materials_org            ON public.materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_org ON public.practice_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_org  ON public.student_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_org     ON public.student_progress(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_org             ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_org              ON public.payroll(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org                ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_org               ON public.orders(organization_id);

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'superadmin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;

-- 5. Rewrite RLS — drop blanket admin policies, add org-scoped ones
-- Pattern: SuperAdmin = global; Admin/Support = bounded by user_in_org(); teachers/students unchanged.

-- attendance
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance org-scoped"
  ON public.attendance FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- live_classes
DROP POLICY IF EXISTS "Admins manage live_classes" ON public.live_classes;
CREATE POLICY "Admins manage live_classes org-scoped"
  ON public.live_classes FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- schedules
DROP POLICY IF EXISTS "Admins manage schedules" ON public.schedules;
CREATE POLICY "Admins manage schedules org-scoped"
  ON public.schedules FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- materials
DROP POLICY IF EXISTS "Admins manage materials" ON public.materials;
CREATE POLICY "Admins manage materials org-scoped"
  ON public.materials FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- practice_assignments
DROP POLICY IF EXISTS "Admins manage practice_assignments" ON public.practice_assignments;
CREATE POLICY "Admins manage practice_assignments org-scoped"
  ON public.practice_assignments FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- student_submissions
DROP POLICY IF EXISTS "Admins manage student_submissions" ON public.student_submissions;
CREATE POLICY "Admins manage student_submissions org-scoped"
  ON public.student_submissions FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- student_progress
DROP POLICY IF EXISTS "Admins manage student_progress" ON public.student_progress;
CREATE POLICY "Admins manage student_progress org-scoped"
  ON public.student_progress FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- payments
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments org-scoped"
  ON public.payments FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- payroll
DROP POLICY IF EXISTS "Admins manage payroll" ON public.payroll;
CREATE POLICY "Admins manage payroll org-scoped"
  ON public.payroll FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL
        AND user_in_org(auth.uid(), organization_id))
  );

-- leads
DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
CREATE POLICY "Admins manage leads org-scoped"
  ON public.leads FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND (organization_id IS NULL OR user_in_org(auth.uid(), organization_id)))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND (organization_id IS NULL OR user_in_org(auth.uid(), organization_id)))
  );

-- orders: admins view scoped, users keep own access
DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders org-scoped"
  ON public.orders FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND (organization_id IS NULL OR user_in_org(auth.uid(), organization_id)))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND (organization_id IS NULL OR user_in_org(auth.uid(), organization_id)))
  );
