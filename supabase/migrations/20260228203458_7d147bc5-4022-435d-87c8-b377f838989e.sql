
-- Single-row table holding precomputed dashboard stats
CREATE TABLE public.dashboard_stats (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_users integer NOT NULL DEFAULT 0,
  total_courses integer NOT NULL DEFAULT 0,
  total_batches integer NOT NULL DEFAULT 0,
  total_orgs integer NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  total_payments integer NOT NULL DEFAULT 0,
  role_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed the initial row
INSERT INTO public.dashboard_stats (id) VALUES (1);

-- Enable RLS
ALTER TABLE public.dashboard_stats ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (dashboard is admin-only in the UI)
CREATE POLICY "dev_allow_dashboard_stats" ON public.dashboard_stats
  AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Function to recompute all stats in one shot
CREATE OR REPLACE FUNCTION public.recompute_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_counts jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(role, cnt), '{}'::jsonb)
  INTO _role_counts
  FROM (
    SELECT role, COUNT(*)::int AS cnt
    FROM public.user_roles
    GROUP BY role
  ) sub;

  UPDATE public.dashboard_stats SET
    total_users    = (SELECT COUNT(*)::int FROM public.profiles),
    total_courses  = (SELECT COUNT(*)::int FROM public.courses),
    total_batches  = (SELECT COUNT(*)::int FROM public.batches),
    total_orgs     = (SELECT COUNT(*)::int FROM public.organizations),
    total_leads    = (SELECT COUNT(*)::int FROM public.leads),
    total_payments = (SELECT COUNT(*)::int FROM public.payments),
    role_counts    = _role_counts,
    updated_at     = now()
  WHERE id = 1;
END;
$$;

-- Trigger function that calls recompute
CREATE OR REPLACE FUNCTION public.trigger_recompute_dashboard_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_dashboard_stats();
  RETURN NULL;
END;
$$;

-- Attach triggers to all relevant tables (AFTER INSERT/DELETE/UPDATE)
CREATE TRIGGER trg_stats_profiles
  AFTER INSERT OR DELETE ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_courses
  AFTER INSERT OR DELETE ON public.courses
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_batches
  AFTER INSERT OR DELETE ON public.batches
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_orgs
  AFTER INSERT OR DELETE ON public.organizations
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_leads
  AFTER INSERT OR DELETE ON public.leads
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_payments
  AFTER INSERT OR DELETE ON public.payments
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

CREATE TRIGGER trg_stats_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_dashboard_stats();

-- Compute initial values now
SELECT public.recompute_dashboard_stats();
