
CREATE TABLE public.classroom_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  max_participants int NOT NULL DEFAULT 400 CHECK (max_participants BETWEEN 2 AND 500),
  active_speaker_gate int NOT NULL DEFAULT 12 CHECK (active_speaker_gate BETWEEN 2 AND 500),
  rolling_window_size int NOT NULL DEFAULT 6 CHECK (rolling_window_size BETWEEN 1 AND 50),
  non_speaker_video_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX classroom_settings_org_batch_uq
  ON public.classroom_settings(organization_id, COALESCE(batch_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX classroom_settings_org_idx ON public.classroom_settings(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_settings TO authenticated;
GRANT ALL ON public.classroom_settings TO service_role;

ALTER TABLE public.classroom_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage classroom settings"
  ON public.classroom_settings FOR ALL
  USING (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
      AND public.user_in_org(auth.uid(), organization_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
      AND public.user_in_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Org members read classroom settings"
  ON public.classroom_settings FOR SELECT
  USING (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.user_in_org(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_classroom_settings_updated_at
  BEFORE UPDATE ON public.classroom_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
