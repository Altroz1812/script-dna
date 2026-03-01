
-- Add metadata columns to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS total_hours INTEGER;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS daily_hours NUMERIC(3,1) DEFAULT 1.0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS writing_style TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS includes_speed BOOLEAN DEFAULT false;

-- Add date column to schedules for specific-date scheduling
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS date DATE;

-- Seed the 9 predefined courses
INSERT INTO public.courses (name, description, created_by, grade_level, duration_days, total_hours, daily_hours, language, writing_style, includes_speed)
VALUES
  ('English Cursive Handwriting', 'Joined handwriting course for younger students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', 'UKG, 1st, 2nd', 30, 25, 1.0, 'English', 'Cursive', false),
  ('English Cursive Handwriting & Speedwriting', 'Joined handwriting with speedwriting for older students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '3rd+', 60, 45, 1.0, 'English', 'Cursive', true),
  ('English Print Handwriting', 'Split/print handwriting course for younger students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', 'UKG, 1st, 2nd', 30, 25, 1.0, 'English', 'Print', false),
  ('English Print Handwriting & Speedwriting', 'Print handwriting with speedwriting for older students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '3rd+', 60, 45, 1.0, 'English', 'Print', true),
  ('Hindi Handwriting', 'Hindi handwriting course for younger students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '1st, 2nd, 3rd', 30, 25, 1.0, 'Hindi', 'Hindi', false),
  ('Hindi Handwriting & Speedwriting', 'Hindi handwriting with speedwriting for older students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '4th+', 60, 45, 1.0, 'Hindi', 'Hindi', true),
  ('Kannada Handwriting', 'Kannada handwriting course for younger students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '1st, 2nd, 3rd', 30, 25, 1.0, 'Kannada', 'Kannada', false),
  ('Kannada Handwriting & Speedwriting', 'Kannada handwriting with speedwriting for older students', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '4th+', 60, 45, 1.0, 'Kannada', 'Kannada', true),
  ('Calligraphy', 'Calligraphy course for students 3rd grade and above', 'f07853ff-3fdc-401c-9424-3a6814a89ea4', '3rd+', 30, 30, 1.0, 'English', 'Calligraphy', false);
