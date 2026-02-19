/*
  Normalize approval roles:
  - Known admin emails => admin + approved
  - Pending accounts => participant (no dashboard access)
*/

UPDATE public.profiles
SET role = 'admin',
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
  AND replace(split_part(lower(email), '@', 1), '.', '') IN ('robsonrossetto14', 'robsonrossetto2015');

UPDATE public.profiles
SET role = 'participant'
WHERE approval_status = 'pending'
  AND NOT (
    lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
    AND replace(split_part(lower(email), '@', 1), '.', '') IN ('robsonrossetto14', 'robsonrossetto2015')
  );

