/*
  Align column names for email_delivery_attempts.

  If a previous migration/version created:
    - edge_status -> rename to http_status
    - provider_ack_success -> rename to provider_ack_received

  Safe to run multiple times; no-ops when already aligned.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_delivery_attempts'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_delivery_attempts'
        AND column_name = 'edge_status'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_delivery_attempts'
        AND column_name = 'http_status'
    ) THEN
      EXECUTE 'ALTER TABLE public.email_delivery_attempts RENAME COLUMN edge_status TO http_status';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_delivery_attempts'
        AND column_name = 'provider_ack_success'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_delivery_attempts'
        AND column_name = 'provider_ack_received'
    ) THEN
      EXECUTE 'ALTER TABLE public.email_delivery_attempts RENAME COLUMN provider_ack_success TO provider_ack_received';
    END IF;
  END IF;
END
$$;

