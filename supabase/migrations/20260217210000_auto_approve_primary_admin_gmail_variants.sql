/*
  Ensure primary admin Gmail variants are approved.
*/

UPDATE public.profiles
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
  AND replace(split_part(lower(email), '@', 1), '.', '') = 'robsonrossetto14';

