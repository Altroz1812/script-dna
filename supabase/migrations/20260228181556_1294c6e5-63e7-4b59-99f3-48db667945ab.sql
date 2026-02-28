
-- Phase 1 Part 2: Multi-tenancy tables + org scoping + RLS

-- 1. Organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Organization members
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 3. Add organization_id to existing tables
ALTER TABLE public.courses ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.batches ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 4. Trigger
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper function
CREATE OR REPLACE FUNCTION public.user_in_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- 6. RLS: organizations
CREATE POLICY "Members view own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = id AND om.user_id = auth.uid())
  );

CREATE POLICY "Superadmins manage orgs"
  ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- 7. RLS: organization_members
CREATE POLICY "Members view org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    public.user_in_org(auth.uid(), organization_id)
  );

CREATE POLICY "Admins manage org members"
  ON public.organization_members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  );

-- 8. Update courses RLS
DROP POLICY IF EXISTS "Admins manage courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses;

CREATE POLICY "Admins manage courses"
  ON public.courses FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  );

CREATE POLICY "Org members view courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    public.user_in_org(auth.uid(), organization_id)
  );

-- 9. Update batches RLS
DROP POLICY IF EXISTS "Admins manage batches" ON public.batches;
DROP POLICY IF EXISTS "Teachers view assigned batches" ON public.batches;
DROP POLICY IF EXISTS "Students view enrolled batches" ON public.batches;

CREATE POLICY "Admins manage batches"
  ON public.batches FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin') OR
    (public.has_role(auth.uid(), 'admin') AND public.user_in_org(auth.uid(), organization_id))
  );

CREATE POLICY "Teachers view assigned batches"
  ON public.batches FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Students view enrolled batches"
  ON public.batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.batch_students bs
      WHERE bs.batch_id = batches.id AND bs.student_id = auth.uid()
    )
  );

CREATE POLICY "Support view batches"
  ON public.batches FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'support') AND public.user_in_org(auth.uid(), organization_id)
  );

CREATE POLICY "Support view courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'support') AND public.user_in_org(auth.uid(), organization_id)
  );
