/*
  Account approval flow:
  - profiles.approval_status controls login access
  - account_approval_tokens stores one-time admin approval links
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.account_approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS account_approval_tokens_user_id_idx
  ON public.account_approval_tokens(user_id);

CREATE INDEX IF NOT EXISTS account_approval_tokens_expires_at_idx
  ON public.account_approval_tokens(expires_at);

ALTER TABLE public.account_approval_tokens ENABLE ROW LEVEL SECURITY;

