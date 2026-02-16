DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'registrations'
      AND column_name = 'uses_controlled_medication'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'registrations'
      AND column_name = 'has_health_issue'
  ) THEN
    ALTER TABLE registrations RENAME COLUMN uses_controlled_medication TO has_health_issue;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'registrations'
      AND column_name = 'medication_details'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'registrations'
      AND column_name = 'health_issue_details'
  ) THEN
    ALTER TABLE registrations RENAME COLUMN medication_details TO health_issue_details;
  END IF;
END $$;
