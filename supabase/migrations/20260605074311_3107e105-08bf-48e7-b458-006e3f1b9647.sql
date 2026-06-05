ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS order_id uuid;

CREATE INDEX IF NOT EXISTS idx_leads_order_id ON public.leads(order_id);