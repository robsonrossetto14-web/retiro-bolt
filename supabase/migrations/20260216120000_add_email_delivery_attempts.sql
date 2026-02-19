/*
  Email delivery auditing.
  Helps diagnose cases where registration is saved but email isn't received.
*/

CREATE TABLE IF NOT EXISTS public.email_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  to_email text NOT NULL,
  origin text,
  http_status integer,
  provider_status integer,
  provider_ack_received boolean,
  provider_details text,
  error text,
  details text
);

CREATE INDEX IF NOT EXISTS email_delivery_attempts_created_at_idx
  ON public.email_delivery_attempts (created_at DESC);

ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can view email delivery attempts" ON public.email_delivery_attempts;
CREATE POLICY "Admin users can view email delivery attempts"
  ON public.email_delivery_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

