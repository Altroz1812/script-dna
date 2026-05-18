-- Remove leaky/duplicate policies on public.batches
DROP POLICY IF EXISTS "Users can view batches in their org" ON public.batches;
DROP POLICY IF EXISTS "Admins can create batches in their org" ON public.batches;
DROP POLICY IF EXISTS "Admins can update batches in their org" ON public.batches;
DROP POLICY IF EXISTS "Admins can delete batches in their org" ON public.batches;
DROP POLICY IF EXISTS "Allow admins to create batches" ON public.batches;