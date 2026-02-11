
-- Create uploaded_fonts table
CREATE TABLE public.uploaded_fonts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  font_name VARCHAR NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.uploaded_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on uploaded_fonts"
ON public.uploaded_fonts
FOR ALL
USING (true)
WITH CHECK (true);

-- Add narration_url column to stroke_recordings
ALTER TABLE public.stroke_recordings
ADD COLUMN narration_url TEXT;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('uploaded-fonts', 'uploaded-fonts', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('narration-audio', 'narration-audio', true);

-- Storage policies for uploaded-fonts
CREATE POLICY "Allow public read on uploaded-fonts"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploaded-fonts');

CREATE POLICY "Allow public insert on uploaded-fonts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploaded-fonts');

CREATE POLICY "Allow public delete on uploaded-fonts"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploaded-fonts');

-- Storage policies for narration-audio
CREATE POLICY "Allow public read on narration-audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'narration-audio');

CREATE POLICY "Allow public insert on narration-audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'narration-audio');

CREATE POLICY "Allow public delete on narration-audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'narration-audio');
