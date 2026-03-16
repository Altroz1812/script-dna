-- Teacher can view live classes for their batches
CREATE POLICY "Teachers view own batch live_classes"
ON public.live_classes FOR SELECT TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can update live classes for their batches (start/end)
CREATE POLICY "Teachers update own batch live_classes"
ON public.live_classes FOR UPDATE TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id))
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can insert live classes for their batches
CREATE POLICY "Teachers insert own batch live_classes"
ON public.live_classes FOR INSERT TO authenticated
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher manages attendance for their batches
CREATE POLICY "Teachers manage attendance"
ON public.attendance FOR ALL TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id))
WITH CHECK (teacher_owns_batch(auth.uid(), batch_id));

-- Teacher can view schedules for their batches
CREATE POLICY "Teachers view own batch schedules"
ON public.schedules FOR SELECT TO authenticated
USING (teacher_owns_batch(auth.uid(), batch_id));