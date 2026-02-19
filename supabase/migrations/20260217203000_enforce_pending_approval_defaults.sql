/*
  Enforce pending approval by default for new profiles.
  Keep primary admin approved.
*/

ALTER TABLE public.profiles
ALTER COLUMN approval_status SET DEFAULT 'pending';

UPDATE public.profiles
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE lower(email) = 'robson.rossetto14@gmail.com';

UPDATE public.profiles
SET approval_status = 'pending',
    approved_at = NULL
WHERE lower(email) <> 'robson.rossetto14@gmail.com'
  AND approval_status IS DISTINCT FROM 'pending';

