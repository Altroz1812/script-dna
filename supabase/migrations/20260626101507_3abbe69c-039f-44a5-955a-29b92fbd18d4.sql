
-- =============================================================
-- Precomputed dashboard metrics tables + triggers
-- =============================================================

-- 1. ORG STATS ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_dashboard_stats (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_members INT NOT NULL DEFAULT 0,
  total_students INT NOT NULL DEFAULT 0,
  total_teachers INT NOT NULL DEFAULT 0,
  total_courses INT NOT NULL DEFAULT 0,
  total_batches INT NOT NULL DEFAULT 0,
  total_leads INT NOT NULL DEFAULT 0,
  total_payments INT NOT NULL DEFAULT 0,
  active_live_classes INT NOT NULL DEFAULT 0,
  role_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_dashboard_stats TO authenticated;
GRANT ALL ON public.org_dashboard_stats TO service_role;
ALTER TABLE public.org_dashboard_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view org stats" ON public.org_dashboard_stats
  FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));

-- 2. TEACHER STATS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_dashboard_stats (
  teacher_id UUID PRIMARY KEY,
  batch_count INT NOT NULL DEFAULT 0,
  student_count INT NOT NULL DEFAULT 0,
  upcoming_class_count INT NOT NULL DEFAULT 0,
  pending_submissions INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_dashboard_stats TO authenticated;
GRANT ALL ON public.teacher_dashboard_stats TO service_role;
ALTER TABLE public.teacher_dashboard_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher views own stats" ON public.teacher_dashboard_stats
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- 3. STUDENT STATS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_dashboard_stats (
  student_id UUID PRIMARY KEY,
  enrolled_courses INT NOT NULL DEFAULT 0,
  enrolled_batches INT NOT NULL DEFAULT 0,
  upcoming_class_count INT NOT NULL DEFAULT 0,
  recent_submission_count INT NOT NULL DEFAULT 0,
  avg_completion_pct INT NOT NULL DEFAULT 0,
  certificate_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_dashboard_stats TO authenticated;
GRANT ALL ON public.student_dashboard_stats TO service_role;
ALTER TABLE public.student_dashboard_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student views own stats" ON public.student_dashboard_stats
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.parent_of_student(auth.uid(), student_id)
    OR public.teacher_has_student(auth.uid(), student_id)
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'superadmin')
  );

-- 4. PARENT STATS ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_dashboard_stats (
  parent_id UUID PRIMARY KEY,
  children_count INT NOT NULL DEFAULT 0,
  avg_completion_pct INT NOT NULL DEFAULT 0,
  recent_payment_count INT NOT NULL DEFAULT 0,
  upcoming_class_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parent_dashboard_stats TO authenticated;
GRANT ALL ON public.parent_dashboard_stats TO service_role;
ALTER TABLE public.parent_dashboard_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parent views own stats" ON public.parent_dashboard_stats
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- =============================================================
-- RECOMPUTE FUNCTIONS
-- =============================================================

CREATE OR REPLACE FUNCTION public.recompute_org_stats(_org UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role_counts JSONB;
BEGIN
  IF _org IS NULL THEN RETURN; END IF;

  SELECT COALESCE(jsonb_object_agg(role, cnt),'{}'::jsonb) INTO _role_counts
  FROM (
    SELECT ur.role::text AS role, COUNT(DISTINCT ur.user_id)::int AS cnt
    FROM public.user_roles ur
    JOIN public.organization_members om ON om.user_id = ur.user_id
    WHERE om.organization_id = _org
    GROUP BY ur.role
  ) s;

  INSERT INTO public.org_dashboard_stats AS d (organization_id, total_members, total_students, total_teachers,
    total_courses, total_batches, total_leads, total_payments, active_live_classes, role_counts, updated_at)
  VALUES (
    _org,
    (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = _org),
    COALESCE((_role_counts->>'student')::int, 0),
    COALESCE((_role_counts->>'teacher')::int, 0),
    (SELECT COUNT(*) FROM public.courses WHERE organization_id = _org),
    (SELECT COUNT(*) FROM public.batches WHERE organization_id = _org),
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org),
    (SELECT COUNT(*) FROM public.payments WHERE organization_id = _org),
    (SELECT COUNT(*) FROM public.live_classes lc
       JOIN public.batches b ON b.id = lc.batch_id
       WHERE b.organization_id = _org AND lc.status IN ('scheduled','live')),
    _role_counts,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    total_members = EXCLUDED.total_members,
    total_students = EXCLUDED.total_students,
    total_teachers = EXCLUDED.total_teachers,
    total_courses = EXCLUDED.total_courses,
    total_batches = EXCLUDED.total_batches,
    total_leads = EXCLUDED.total_leads,
    total_payments = EXCLUDED.total_payments,
    active_live_classes = EXCLUDED.active_live_classes,
    role_counts = EXCLUDED.role_counts,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_teacher_stats(_teacher UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _teacher IS NULL THEN RETURN; END IF;
  INSERT INTO public.teacher_dashboard_stats AS d (teacher_id, batch_count, student_count, upcoming_class_count, pending_submissions, updated_at)
  VALUES (
    _teacher,
    (SELECT COUNT(*) FROM public.batches WHERE teacher_id = _teacher),
    (SELECT COUNT(DISTINCT bs.student_id) FROM public.batch_students bs
       JOIN public.batches b ON b.id = bs.batch_id WHERE b.teacher_id = _teacher),
    (SELECT COUNT(*) FROM public.live_classes lc
       JOIN public.batches b ON b.id = lc.batch_id
       WHERE b.teacher_id = _teacher AND lc.status IN ('scheduled','live')),
    (SELECT COUNT(*) FROM public.student_submissions ss
       JOIN public.practice_assignments pa ON pa.id = ss.assignment_id
       WHERE pa.teacher_id = _teacher AND ss.status = 'pending'),
    now()
  )
  ON CONFLICT (teacher_id) DO UPDATE SET
    batch_count = EXCLUDED.batch_count,
    student_count = EXCLUDED.student_count,
    upcoming_class_count = EXCLUDED.upcoming_class_count,
    pending_submissions = EXCLUDED.pending_submissions,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_student_stats(_student UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _student IS NULL THEN RETURN; END IF;
  INSERT INTO public.student_dashboard_stats AS d (student_id, enrolled_courses, enrolled_batches,
    upcoming_class_count, recent_submission_count, avg_completion_pct, certificate_count, updated_at)
  VALUES (
    _student,
    (SELECT COUNT(DISTINCT b.course_id) FROM public.batch_students bs
       JOIN public.batches b ON b.id = bs.batch_id WHERE bs.student_id = _student),
    (SELECT COUNT(*) FROM public.batch_students WHERE student_id = _student),
    (SELECT COUNT(*) FROM public.live_classes lc
       JOIN public.batch_students bs ON bs.batch_id = lc.batch_id
       WHERE bs.student_id = _student AND lc.status IN ('scheduled','live')),
    (SELECT COUNT(*) FROM public.student_submissions WHERE student_id = _student
       AND created_at > now() - interval '30 days'),
    COALESCE((SELECT ROUND(AVG(completion_pct))::int FROM public.student_progress
       WHERE student_id = _student), 0),
    (SELECT COUNT(*) FROM public.certificates WHERE student_id = _student AND status = 'issued'),
    now()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    enrolled_courses = EXCLUDED.enrolled_courses,
    enrolled_batches = EXCLUDED.enrolled_batches,
    upcoming_class_count = EXCLUDED.upcoming_class_count,
    recent_submission_count = EXCLUDED.recent_submission_count,
    avg_completion_pct = EXCLUDED.avg_completion_pct,
    certificate_count = EXCLUDED.certificate_count,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_parent_stats(_parent UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _parent IS NULL THEN RETURN; END IF;
  INSERT INTO public.parent_dashboard_stats AS d (parent_id, children_count, avg_completion_pct,
    recent_payment_count, upcoming_class_count, updated_at)
  VALUES (
    _parent,
    (SELECT COUNT(*) FROM public.parent_children WHERE parent_id = _parent),
    COALESCE((SELECT ROUND(AVG(sp.completion_pct))::int FROM public.student_progress sp
       JOIN public.parent_children pc ON pc.child_id = sp.student_id
       WHERE pc.parent_id = _parent), 0),
    (SELECT COUNT(*) FROM public.payments p
       JOIN public.parent_children pc ON pc.child_id = p.student_id
       WHERE pc.parent_id = _parent AND p.payment_date > now() - interval '30 days'),
    (SELECT COUNT(*) FROM public.live_classes lc
       JOIN public.batch_students bs ON bs.batch_id = lc.batch_id
       JOIN public.parent_children pc ON pc.child_id = bs.student_id
       WHERE pc.parent_id = _parent AND lc.status IN ('scheduled','live')),
    now()
  )
  ON CONFLICT (parent_id) DO UPDATE SET
    children_count = EXCLUDED.children_count,
    avg_completion_pct = EXCLUDED.avg_completion_pct,
    recent_payment_count = EXCLUDED.recent_payment_count,
    upcoming_class_count = EXCLUDED.upcoming_class_count,
    updated_at = now();
END $$;

-- =============================================================
-- TRIGGER FUNCTIONS (row-level, targeted)
-- =============================================================

CREATE OR REPLACE FUNCTION public.trg_stats_batches() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM recompute_org_stats(NEW.organization_id);
    PERFORM recompute_teacher_stats(NEW.teacher_id);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM recompute_org_stats(OLD.organization_id);
    PERFORM recompute_teacher_stats(OLD.teacher_id);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_batch_students() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_teacher UUID; v_org UUID; v_parent UUID;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT teacher_id, organization_id INTO v_teacher, v_org FROM batches WHERE id = NEW.batch_id;
    PERFORM recompute_teacher_stats(v_teacher);
    PERFORM recompute_org_stats(v_org);
    PERFORM recompute_student_stats(NEW.student_id);
    FOR v_parent IN SELECT parent_id FROM parent_children WHERE child_id = NEW.student_id LOOP
      PERFORM recompute_parent_stats(v_parent);
    END LOOP;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT teacher_id, organization_id INTO v_teacher, v_org FROM batches WHERE id = OLD.batch_id;
    PERFORM recompute_teacher_stats(v_teacher);
    PERFORM recompute_org_stats(v_org);
    PERFORM recompute_student_stats(OLD.student_id);
    FOR v_parent IN SELECT parent_id FROM parent_children WHERE child_id = OLD.student_id LOOP
      PERFORM recompute_parent_stats(v_parent);
    END LOOP;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_live_classes() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_teacher UUID; v_org UUID; v_batch UUID; v_sid UUID; v_parent UUID;
BEGIN
  v_batch := COALESCE(NEW.batch_id, OLD.batch_id);
  SELECT teacher_id, organization_id INTO v_teacher, v_org FROM batches WHERE id = v_batch;
  PERFORM recompute_teacher_stats(v_teacher);
  PERFORM recompute_org_stats(v_org);
  FOR v_sid IN SELECT student_id FROM batch_students WHERE batch_id = v_batch LOOP
    PERFORM recompute_student_stats(v_sid);
    FOR v_parent IN SELECT parent_id FROM parent_children WHERE child_id = v_sid LOOP
      PERFORM recompute_parent_stats(v_parent);
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_submissions() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_teacher UUID;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT teacher_id INTO v_teacher FROM practice_assignments WHERE id = NEW.assignment_id;
    PERFORM recompute_teacher_stats(v_teacher);
    PERFORM recompute_student_stats(NEW.student_id);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT teacher_id INTO v_teacher FROM practice_assignments WHERE id = OLD.assignment_id;
    PERFORM recompute_teacher_stats(v_teacher);
    PERFORM recompute_student_stats(OLD.student_id);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_progress() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sid UUID; v_parent UUID;
BEGIN
  v_sid := COALESCE(NEW.student_id, OLD.student_id);
  PERFORM recompute_student_stats(v_sid);
  FOR v_parent IN SELECT parent_id FROM parent_children WHERE child_id = v_sid LOOP
    PERFORM recompute_parent_stats(v_parent);
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_payments() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sid UUID; v_org UUID; v_parent UUID;
BEGIN
  v_sid := COALESCE(NEW.student_id, OLD.student_id);
  v_org := COALESCE(NEW.organization_id, OLD.organization_id);
  PERFORM recompute_org_stats(v_org);
  IF v_sid IS NOT NULL THEN
    FOR v_parent IN SELECT parent_id FROM parent_children WHERE child_id = v_sid LOOP
      PERFORM recompute_parent_stats(v_parent);
    END LOOP;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_leads() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recompute_org_stats(COALESCE(NEW.organization_id, OLD.organization_id));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_courses() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recompute_org_stats(COALESCE(NEW.organization_id, OLD.organization_id));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_org_members() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recompute_org_stats(COALESCE(NEW.organization_id, OLD.organization_id));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_user_roles() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID; v_org UUID;
BEGIN
  v_uid := COALESCE(NEW.user_id, OLD.user_id);
  FOR v_org IN SELECT organization_id FROM organization_members WHERE user_id = v_uid LOOP
    PERFORM recompute_org_stats(v_org);
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_parent_children() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recompute_parent_stats(COALESCE(NEW.parent_id, OLD.parent_id));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stats_certificates() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recompute_student_stats(COALESCE(NEW.student_id, OLD.student_id));
  RETURN NULL;
END $$;

-- =============================================================
-- ATTACH TRIGGERS
-- =============================================================
DROP TRIGGER IF EXISTS dash_stats_batches ON public.batches;
CREATE TRIGGER dash_stats_batches AFTER INSERT OR UPDATE OR DELETE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_batches();

DROP TRIGGER IF EXISTS dash_stats_batch_students ON public.batch_students;
CREATE TRIGGER dash_stats_batch_students AFTER INSERT OR UPDATE OR DELETE ON public.batch_students
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_batch_students();

DROP TRIGGER IF EXISTS dash_stats_live_classes ON public.live_classes;
CREATE TRIGGER dash_stats_live_classes AFTER INSERT OR UPDATE OR DELETE ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_live_classes();

DROP TRIGGER IF EXISTS dash_stats_submissions ON public.student_submissions;
CREATE TRIGGER dash_stats_submissions AFTER INSERT OR UPDATE OR DELETE ON public.student_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_submissions();

DROP TRIGGER IF EXISTS dash_stats_progress ON public.student_progress;
CREATE TRIGGER dash_stats_progress AFTER INSERT OR UPDATE OR DELETE ON public.student_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_progress();

DROP TRIGGER IF EXISTS dash_stats_payments ON public.payments;
CREATE TRIGGER dash_stats_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_payments();

DROP TRIGGER IF EXISTS dash_stats_leads ON public.leads;
CREATE TRIGGER dash_stats_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_leads();

DROP TRIGGER IF EXISTS dash_stats_courses ON public.courses;
CREATE TRIGGER dash_stats_courses AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_courses();

DROP TRIGGER IF EXISTS dash_stats_org_members ON public.organization_members;
CREATE TRIGGER dash_stats_org_members AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_org_members();

DROP TRIGGER IF EXISTS dash_stats_user_roles ON public.user_roles;
CREATE TRIGGER dash_stats_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_user_roles();

DROP TRIGGER IF EXISTS dash_stats_parent_children ON public.parent_children;
CREATE TRIGGER dash_stats_parent_children AFTER INSERT OR UPDATE OR DELETE ON public.parent_children
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_parent_children();

DROP TRIGGER IF EXISTS dash_stats_certificates ON public.certificates;
CREATE TRIGGER dash_stats_certificates AFTER INSERT OR UPDATE OR DELETE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.trg_stats_certificates();

-- =============================================================
-- BACKFILL
-- =============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.recompute_org_stats(r.id);
  END LOOP;
  FOR r IN SELECT DISTINCT teacher_id AS id FROM public.batches WHERE teacher_id IS NOT NULL LOOP
    PERFORM public.recompute_teacher_stats(r.id);
  END LOOP;
  FOR r IN SELECT DISTINCT student_id AS id FROM public.batch_students LOOP
    PERFORM public.recompute_student_stats(r.id);
  END LOOP;
  FOR r IN SELECT DISTINCT parent_id AS id FROM public.parent_children LOOP
    PERFORM public.recompute_parent_stats(r.id);
  END LOOP;
END $$;
