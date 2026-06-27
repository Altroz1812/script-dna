
ALTER TABLE public.batch_students
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_marked_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batch_students_completion_status_chk') THEN
    ALTER TABLE public.batch_students
      ADD CONSTRAINT batch_students_completion_status_chk
      CHECK (completion_status IN ('pending','completed','needs_improvement'));
  END IF;
END $$;

ALTER TABLE public.class_extension_requests
  ADD COLUMN IF NOT EXISTS extension_mode text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS student_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_per_class numeric(10,2),
  ADD COLUMN IF NOT EXISTS organization_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_extension_requests_mode_chk') THEN
    ALTER TABLE public.class_extension_requests
      ADD CONSTRAINT class_extension_requests_mode_chk
      CHECK (extension_mode IN ('free','paid'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_extension_requests_org
  ON public.class_extension_requests(organization_id);
