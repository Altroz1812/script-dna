-- Table to store payment gateway configuration (admin-only)
CREATE TABLE public.payment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'cashfree',
  app_id text NOT NULL DEFAULT '',
  secret_key text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment_config"
  ON public.payment_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.payment_config (provider, mode) VALUES ('cashfree', 'sandbox');

CREATE TRIGGER update_payment_config_updated_at
  BEFORE UPDATE ON public.payment_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();