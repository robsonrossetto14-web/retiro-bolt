/*
  Automatically trigger registration confirmation email after insert on registrations.
  This avoids relying only on frontend delivery calls.
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_registration_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retreat_name text;
  v_retreat_date text;
  v_retreat_end_date text;
  v_location text;
  v_instagram_handle text;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  SELECT
    r.name,
    to_char(r.date, 'DD/MM/YYYY'),
    CASE
      WHEN r.end_date IS NULL THEN NULL
      ELSE to_char(r.end_date, 'DD/MM/YYYY')
    END,
    r.location,
    r.instagram_handle
  INTO
    v_retreat_name,
    v_retreat_date,
    v_retreat_end_date,
    v_location,
    v_instagram_handle
  FROM public.retreats r
  WHERE r.id = NEW.retreat_id;

  IF v_retreat_name IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://rltxdhhvoqxswgbssrci.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'registration_confirmation',
      'to', lower(btrim(NEW.email)),
      'participantName', NEW.full_name,
      'retreatName', v_retreat_name,
      'retreatDate', v_retreat_date,
      'retreatEndDate', v_retreat_end_date,
      'location', v_location,
      'instagramHandle', v_instagram_handle
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block registration if email dispatch fails.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_registration_confirmation ON public.registrations;

CREATE TRIGGER trg_notify_registration_confirmation
AFTER INSERT ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.notify_registration_confirmation();

