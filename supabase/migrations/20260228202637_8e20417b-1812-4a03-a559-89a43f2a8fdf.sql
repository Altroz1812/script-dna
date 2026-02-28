
-- Drop all the incorrectly-created RESTRICTIVE "Allow all" policies
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow all courses" ON public.courses;
DROP POLICY IF EXISTS "Allow all batches" ON public.batches;
DROP POLICY IF EXISTS "Allow all batch_students" ON public.batch_students;
DROP POLICY IF EXISTS "Allow all leads" ON public.leads;
DROP POLICY IF EXISTS "Allow all schedules" ON public.schedules;
DROP POLICY IF EXISTS "Allow all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow all live_classes" ON public.live_classes;
DROP POLICY IF EXISTS "Allow all materials" ON public.materials;
DROP POLICY IF EXISTS "Allow all payments" ON public.payments;
DROP POLICY IF EXISTS "Allow all payroll" ON public.payroll;
DROP POLICY IF EXISTS "Allow all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all organization_members" ON public.organization_members;

-- Recreate as explicitly PERMISSIVE policies
CREATE POLICY "dev_allow_profiles" ON public.profiles AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_courses" ON public.courses AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_batches" ON public.batches AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_batch_students" ON public.batch_students AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_leads" ON public.leads AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_schedules" ON public.schedules AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_attendance" ON public.attendance AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_live_classes" ON public.live_classes AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_materials" ON public.materials AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_payments" ON public.payments AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_payroll" ON public.payroll AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_notifications" ON public.notifications AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_organizations" ON public.organizations AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_organization_members" ON public.organization_members AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
