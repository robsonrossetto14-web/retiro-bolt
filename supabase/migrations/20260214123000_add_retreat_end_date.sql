ALTER TABLE retreats
ADD COLUMN IF NOT EXISTS end_date date;

UPDATE retreats
SET end_date = date
WHERE end_date IS NULL;
