DROP POLICY IF EXISTS "Admin users can delete registrations" ON registrations;
DROP POLICY IF EXISTS "authenticated_can_delete_registration" ON registrations;

CREATE POLICY "Admin users can delete registrations"
  ON registrations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

