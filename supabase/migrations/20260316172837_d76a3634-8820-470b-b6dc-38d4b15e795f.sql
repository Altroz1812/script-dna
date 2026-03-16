
-- Step 1: Add student SELECT on live_classes
CREATE POLICY "Students view batch live_classes"
ON public.live_classes FOR SELECT TO authenticated
USING (student_in_batch(auth.uid(), batch_id));

-- Step 2: Add student SELECT on schedules
CREATE POLICY "Students view batch schedules"
ON public.schedules FOR SELECT TO authenticated
USING (student_in_batch(auth.uid(), batch_id));

-- Step 3: Add student SELECT on materials (via enrolled batch courses)
CREATE POLICY "Students view course materials"
ON public.materials FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM batch_students bs
  JOIN batches b ON b.id = bs.batch_id
  WHERE bs.student_id = auth.uid() AND b.course_id = materials.course_id
));

-- Step 4: Add student SELECT on attendance (own records)
CREATE POLICY "Students view own attendance"
ON public.attendance FOR SELECT TO authenticated
USING (student_id = auth.uid());
