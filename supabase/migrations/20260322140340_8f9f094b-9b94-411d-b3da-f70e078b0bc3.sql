ALTER TABLE public.courses ADD COLUMN delivery_mode text NOT NULL DEFAULT 'online';
ALTER TABLE public.courses ADD COLUMN center text NULL;