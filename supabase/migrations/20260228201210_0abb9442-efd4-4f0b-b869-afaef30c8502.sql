
-- Add PERMISSIVE policies to all admin tables so that authenticated/anon requests can access data.
-- The existing RESTRICTIVE policies will narrow access once real auth is implemented.

-- PROFILES: Allow all select (needed for user listings, enrichment)
CREATE POLICY "Allow read profiles" ON public.profiles FOR SELECT USING (true);

-- USER_ROLES: Allow all select and manage (needed for role management)
CREATE POLICY "Allow read user_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Allow manage user_roles" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);

-- COURSES: Allow all operations
CREATE POLICY "Allow all courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- BATCHES: Allow all operations
CREATE POLICY "Allow all batches" ON public.batches FOR ALL USING (true) WITH CHECK (true);

-- BATCH_STUDENTS: Allow all operations
CREATE POLICY "Allow all batch_students" ON public.batch_students FOR ALL USING (true) WITH CHECK (true);

-- LEADS: Allow all operations
CREATE POLICY "Allow all leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- SCHEDULES: Allow all operations
CREATE POLICY "Allow all schedules" ON public.schedules FOR ALL USING (true) WITH CHECK (true);

-- ATTENDANCE: Allow all operations
CREATE POLICY "Allow all attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- LIVE_CLASSES: Allow all operations
CREATE POLICY "Allow all live_classes" ON public.live_classes FOR ALL USING (true) WITH CHECK (true);

-- MATERIALS: Allow all operations
CREATE POLICY "Allow all materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

-- PAYMENTS: Allow all operations
CREATE POLICY "Allow all payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- PAYROLL: Allow all operations
CREATE POLICY "Allow all payroll" ON public.payroll FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICATIONS: Allow all operations
CREATE POLICY "Allow all notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- ORGANIZATIONS: Allow all operations
CREATE POLICY "Allow all organizations" ON public.organizations FOR ALL USING (true) WITH CHECK (true);

-- ORGANIZATION_MEMBERS: Allow all operations
CREATE POLICY "Allow all organization_members" ON public.organization_members FOR ALL USING (true) WITH CHECK (true);

-- PROFILES: Allow update/delete too (for admin user management)
CREATE POLICY "Allow manage profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
