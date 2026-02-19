/*
  Add optional retreat price for revenue dashboard cards.
*/

ALTER TABLE public.retreats
ADD COLUMN IF NOT EXISTS price numeric(10,2);

