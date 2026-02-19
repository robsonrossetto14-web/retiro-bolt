/*
  Add optional max slots for each retreat.
*/

ALTER TABLE public.retreats
ADD COLUMN IF NOT EXISTS max_slots integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retreats_max_slots_positive_chk'
      AND conrelid = 'public.retreats'::regclass
  ) THEN
    ALTER TABLE public.retreats
    ADD CONSTRAINT retreats_max_slots_positive_chk
    CHECK (max_slots IS NULL OR max_slots > 0);
  END IF;
END
$$;

