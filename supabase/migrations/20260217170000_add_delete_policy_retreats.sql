/*
  Allow admin users to delete retreats.
*/

DROP POLICY IF EXISTS "Admin users can delete retreats" ON public.retreats;

CREATE POLICY "Admin users can delete retreats"
  ON public.retreats FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

