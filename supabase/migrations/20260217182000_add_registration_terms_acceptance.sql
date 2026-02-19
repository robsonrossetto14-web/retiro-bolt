/*
  Persist explicit participant acceptance of retreat participation terms.
*/

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

