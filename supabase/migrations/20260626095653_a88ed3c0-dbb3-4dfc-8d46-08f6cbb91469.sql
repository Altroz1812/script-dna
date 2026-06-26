
CREATE INDEX IF NOT EXISTS idx_user_sessions_open ON public.user_sessions (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_started ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_attempted ON public.login_attempts (email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_classes_status_scheduled ON public.live_classes (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_classes_batch_scheduled ON public.live_classes (batch_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_batches_teacher ON public.batches (teacher_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_batch ON public.batch_students (batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student ON public.batch_students (student_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
