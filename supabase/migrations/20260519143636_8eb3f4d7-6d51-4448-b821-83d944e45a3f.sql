
-- 1) Extend login_attempts
ALTER TABLE public.login_attempts
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view login_attempts" ON public.login_attempts;
CREATE POLICY "Admins view login_attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at
  ON public.login_attempts (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email
  ON public.login_attempts (email);

-- 2) user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view user_sessions" ON public.user_sessions;
CREATE POLICY "Admins view user_sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users view own sessions" ON public.user_sessions;
CREATE POLICY "Users view own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_started
  ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON public.user_sessions (last_seen_at DESC) WHERE ended_at IS NULL;

-- 3) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_attempts;
