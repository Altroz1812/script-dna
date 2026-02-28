
-- Step 1: Add 'support' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
