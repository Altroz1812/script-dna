
CREATE INDEX IF NOT EXISTS idx_batches_org ON public.batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_teacher ON public.batches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_batches_course ON public.batches(course_id);

CREATE INDEX IF NOT EXISTS idx_batch_students_batch ON public.batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student ON public.batch_students(student_id);

CREATE INDEX IF NOT EXISTS idx_live_classes_batch_time ON public.live_classes(batch_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_classes_org ON public.live_classes(organization_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_status ON public.live_classes(status);

CREATE INDEX IF NOT EXISTS idx_schedules_batch_date ON public.schedules(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_org ON public.schedules(organization_id);

CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON public.attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);

CREATE INDEX IF NOT EXISTS idx_payments_org_date ON public.payments(organization_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);

CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_assignments_batch ON public.practice_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_teacher ON public.practice_assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_student_submissions_assignment ON public.student_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_student ON public.student_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_student ON public.student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_batch ON public.student_progress(batch_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON public.profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_materials_course ON public.materials(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_org ON public.materials(organization_id);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id);
