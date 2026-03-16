
-- Add is_active to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add is_active to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins view activity logs" ON public.activity_logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins manage activity logs" ON public.activity_logs
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Allow service role to insert (edge functions)
CREATE POLICY "Service inserts activity logs" ON public.activity_logs
FOR INSERT TO anon, authenticated
WITH CHECK (true);
