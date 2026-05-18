
-- =========================================================================
-- PART D.1 — Backfill existing rows that are missing organization_id
-- =========================================================================

-- payments: derive from student's organization (first membership)
UPDATE public.payments p
SET organization_id = (
  SELECT om.organization_id FROM public.organization_members om
  WHERE om.user_id = p.student_id ORDER BY om.joined_at ASC LIMIT 1
)
WHERE p.organization_id IS NULL;

-- leads: leave NULL leads as superadmin-only (no parent to derive from)
-- They remain visible only to superadmin via the existing policy.

-- orders: derive from user's organization
UPDATE public.orders o
SET organization_id = (
  SELECT om.organization_id FROM public.organization_members om
  WHERE om.user_id = o.user_id ORDER BY om.joined_at ASC LIMIT 1
)
WHERE o.organization_id IS NULL;

-- courses: derive from creator's organization
UPDATE public.courses c
SET organization_id = (
  SELECT om.organization_id FROM public.organization_members om
  WHERE om.user_id = c.created_by ORDER BY om.joined_at ASC LIMIT 1
)
WHERE c.organization_id IS NULL;

-- =========================================================================
-- PART D.2 — Auto-stamp triggers (BEFORE INSERT)
-- Stamp organization_id from the parent row when caller forgot to set it.
-- =========================================================================

-- attendance ← batches
CREATE OR REPLACE FUNCTION public.stamp_org_from_batch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.batch_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.batches WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_attendance_stamp_org ON public.attendance;
CREATE TRIGGER trg_attendance_stamp_org
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.stamp_org_from_batch();

DROP TRIGGER IF EXISTS trg_live_classes_stamp_org ON public.live_classes;
CREATE TRIGGER trg_live_classes_stamp_org
  BEFORE INSERT ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_org_from_batch();

DROP TRIGGER IF EXISTS trg_schedules_stamp_org ON public.schedules;
CREATE TRIGGER trg_schedules_stamp_org
  BEFORE INSERT ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.stamp_org_from_batch();

DROP TRIGGER IF EXISTS trg_practice_assignments_stamp_org ON public.practice_assignments;
CREATE TRIGGER trg_practice_assignments_stamp_org
  BEFORE INSERT ON public.practice_assignments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_org_from_batch();

DROP TRIGGER IF EXISTS trg_student_progress_stamp_org ON public.student_progress;
CREATE TRIGGER trg_student_progress_stamp_org
  BEFORE INSERT ON public.student_progress
  FOR EACH ROW EXECUTE FUNCTION public.stamp_org_from_batch();

-- student_submissions ← practice_assignments ← batches
CREATE OR REPLACE FUNCTION public.stamp_submission_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.assignment_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.practice_assignments WHERE id = NEW.assignment_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_student_submissions_stamp_org ON public.student_submissions;
CREATE TRIGGER trg_student_submissions_stamp_org
  BEFORE INSERT ON public.student_submissions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_submission_org();

-- materials ← courses
CREATE OR REPLACE FUNCTION public.stamp_material_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.course_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.courses WHERE id = NEW.course_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_materials_stamp_org ON public.materials;
CREATE TRIGGER trg_materials_stamp_org
  BEFORE INSERT ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.stamp_material_org();

-- =========================================================================
-- PART D.3 — Tighten RLS: remove "OR organization_id IS NULL" loopholes
-- =========================================================================

-- leads: drop loophole (NULL org leads were visible to all org admins)
DROP POLICY IF EXISTS "Admins manage leads org-scoped" ON public.leads;
CREATE POLICY "Admins manage leads org-scoped" ON public.leads
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL AND user_in_org(auth.uid(), organization_id))
  );

-- orders: same tightening
DROP POLICY IF EXISTS "Admins manage orders org-scoped" ON public.orders;
CREATE POLICY "Admins manage orders org-scoped" ON public.orders
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
        AND organization_id IS NOT NULL AND user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND organization_id IS NOT NULL AND user_in_org(auth.uid(), organization_id))
  );

-- =========================================================================
-- PART D.4 — Drop legacy public "view all courses" policies
-- Public marketing courses are served by the public-courses edge function.
-- =========================================================================
DROP POLICY IF EXISTS "Public courses read" ON public.courses;
DROP POLICY IF EXISTS "Users can view courses" ON public.courses;
