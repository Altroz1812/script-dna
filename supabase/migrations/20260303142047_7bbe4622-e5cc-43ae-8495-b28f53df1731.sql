
-- Remove all dev_allow_* permissive RLS policies that bypass security
DROP POLICY IF EXISTS "dev_allow_profiles" ON public.profiles;
DROP POLICY IF EXISTS "dev_allow_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "dev_allow_leads" ON public.leads;
DROP POLICY IF EXISTS "dev_allow_organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "dev_allow_payments" ON public.payments;
DROP POLICY IF EXISTS "dev_allow_payroll" ON public.payroll;
DROP POLICY IF EXISTS "dev_allow_dashboard_stats" ON public.dashboard_stats;
DROP POLICY IF EXISTS "dev_allow_organizations" ON public.organizations;
DROP POLICY IF EXISTS "dev_allow_courses" ON public.courses;
DROP POLICY IF EXISTS "dev_allow_batches" ON public.batches;
DROP POLICY IF EXISTS "dev_allow_batch_students" ON public.batch_students;
DROP POLICY IF EXISTS "dev_allow_attendance" ON public.attendance;
DROP POLICY IF EXISTS "dev_allow_schedules" ON public.schedules;
DROP POLICY IF EXISTS "dev_allow_live_classes" ON public.live_classes;
DROP POLICY IF EXISTS "dev_allow_materials" ON public.materials;
DROP POLICY IF EXISTS "dev_allow_notifications" ON public.notifications;

-- Add proper RLS policies for dashboard_stats (was only protected by dev_allow)
CREATE POLICY "Admins view dashboard_stats"
ON public.dashboard_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to view all profiles (needed for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view student profiles in their batches
CREATE POLICY "Teachers view batch student profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  EXISTS (
    SELECT 1 FROM batch_students bs
    JOIN batches b ON b.id = bs.batch_id
    WHERE bs.student_id = profiles.user_id AND b.teacher_id = auth.uid()
  )
);

-- Support can view profiles
CREATE POLICY "Support view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

-- Add login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);

-- Public courses read (landing page needs this)
CREATE POLICY "Public courses read"
ON public.courses FOR SELECT
USING (true);
