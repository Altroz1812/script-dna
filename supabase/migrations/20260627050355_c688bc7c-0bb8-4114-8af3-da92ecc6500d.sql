
-- Soft-delete workflow: add deleted_at timestamps and tracking to courses, batches,
-- and all directly-related child tables so cascade deletes can be reversed within a
-- limited window by admins.

ALTER TABLE public.courses               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.courses               ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.batches               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.batches               ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.batches               ADD COLUMN IF NOT EXISTS deleted_cause TEXT; -- 'course' or 'batch'
ALTER TABLE public.course_modules        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.lessons               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.materials             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.practice_assignments  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.schedules             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.live_classes          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.attendance            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.certificates          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.batch_students        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.class_extension_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.student_progress      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_courses_deleted_at ON public.courses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batches_deleted_at ON public.batches(deleted_at) WHERE deleted_at IS NOT NULL;
