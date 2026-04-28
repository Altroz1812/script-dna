-- 1. Helper: resolve a user's first organization
CREATE OR REPLACE FUNCTION public.first_org_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id
  ORDER BY joined_at ASC
  LIMIT 1
$$;

-- 2. Backfill batches.organization_id
-- Try teacher's first org first, then fall back to oldest organization
UPDATE public.batches b
SET organization_id = COALESCE(
  public.first_org_for_user(b.teacher_id),
  (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1)
)
WHERE b.organization_id IS NULL;

-- 3. Backfill courses.organization_id
-- Try creator's first org, then fall back to oldest organization
UPDATE public.courses c
SET organization_id = COALESCE(
  public.first_org_for_user(c.created_by),
  (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1)
)
WHERE c.organization_id IS NULL;