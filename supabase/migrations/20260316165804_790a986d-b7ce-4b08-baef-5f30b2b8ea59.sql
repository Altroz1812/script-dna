
-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  max_students integer,
  max_courses integer,
  max_teachers integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage subscription_plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Admins view subscription_plans" ON public.subscription_plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Org Subscriptions
CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE RESTRICT NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage org_subscriptions" ON public.org_subscriptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Admins view own org subscription" ON public.org_subscriptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_in_org(auth.uid(), organization_id));

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  min_amount numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Public read active coupons" ON public.coupons FOR SELECT USING (is_active = true);

-- White-label branding column on organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS branding jsonb DEFAULT '{}'::jsonb;

-- Course Modules
CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage course_modules" ON public.course_modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Admins manage course_modules" ON public.course_modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read course_modules" ON public.course_modules FOR SELECT TO authenticated USING (true);

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.course_modules(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text,
  lesson_type text NOT NULL DEFAULT 'text',
  duration_minutes integer DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage lessons" ON public.lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
