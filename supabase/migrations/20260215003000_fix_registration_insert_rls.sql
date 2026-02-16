/*
  Ensure both anonymous visitors and authenticated users can submit
  registrations for active retreats.
*/

DROP POLICY IF EXISTS "Public can create registrations for active retreats" ON registrations;
DROP POLICY IF EXISTS "public_can_create_registration" ON registrations;
DROP POLICY IF EXISTS "authenticated_can_create_registration" ON registrations;
DROP POLICY IF EXISTS "authenticated_can_insert_registration_active_retreat" ON registrations;
DROP POLICY IF EXISTS "public_can_insert_registration_active_retreat" ON registrations;

CREATE POLICY "public_can_insert_registration_active_retreat"
  ON registrations FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM retreats
      WHERE retreats.id = registrations.retreat_id
        AND retreats.is_active = true
    )
  );

CREATE POLICY "authenticated_can_insert_registration_active_retreat"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM retreats
      WHERE retreats.id = registrations.retreat_id
        AND retreats.is_active = true
    )
  );
