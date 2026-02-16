ALTER TABLE retreats
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE retreats
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;
