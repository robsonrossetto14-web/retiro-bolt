/*
  # Retreat Management Platform Schema

  ## Overview
  Creates the complete database structure for a retreat management platform with admin authentication,
  retreat configuration, participant registration, and payment tracking.

  ## New Tables
  
  ### 1. `profiles`
  User profiles extending Supabase auth.users
  - `id` (uuid, FK to auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (text) - 'admin' or 'participant'
  - `created_at` (timestamptz)

  ### 2. `retreats`
  Retreat configuration and details
  - `id` (uuid, PK)
  - `name` (text) - Retreat name
  - `date` (date) - Start date
  - `end_date` (date) - End date
  - `location` (text) - Location name
  - `address` (text) - Full address
  - `what_to_bring` (text) - Items to bring
  - `shirt_sizes` (jsonb) - Available shirt sizes
  - `instagram_handle` (text) - Instagram account to follow
  - `share_link` (text) - Unique shareable link slug
  - `created_by` (uuid, FK to profiles)
  - `created_at` (timestamptz)
  - `is_active` (boolean)

  ### 3. `registrations`
  Participant registration forms
  - `id` (uuid, PK)
  - `retreat_id` (uuid, FK to retreats)
  - `full_name` (text)
  - `phone` (text)
  - `email` (text)
  - `date_of_birth` (date)
  - `parish` (text) - Which parish they belong to
  - `has_health_issue` (boolean)
  - `health_issue_details` (text) - Details if applicable
  - `shirt_size` (text)
  - `emergency_contact_name` (text)
  - `emergency_contact_phone` (text)
  - `payment_status` (text) - 'pending', 'link_sent', 'paid'
  - `payment_link` (text) - Payment instructions
  - `whatsapp_group_link` (text)
  - `registered_at` (timestamptz)
  - `payment_confirmed_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Admin users can manage everything
  - Public users can only insert registrations for active retreats
  - Users can only view their own registrations
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retreats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  end_date date,
  location text NOT NULL,
  address text NOT NULL,
  what_to_bring text,
  shirt_sizes jsonb DEFAULT '["P", "M", "G", "GG", "XG"]'::jsonb,
  instagram_handle text,
  share_link text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  date_of_birth date,
  parish text NOT NULL,
  has_health_issue boolean DEFAULT false,
  health_issue_details text,
  shirt_size text NOT NULL,
  emergency_contact_name text NOT NULL,
  emergency_contact_phone text NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'link_sent', 'paid')),
  payment_link text,
  whatsapp_group_link text,
  registered_at timestamptz DEFAULT now(),
  payment_confirmed_at timestamptz
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE retreats ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin users can view all retreats"
  ON retreats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Public can view active retreats"
  ON retreats FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Admin users can create retreats"
  ON retreats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update retreats"
  ON retreats FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can view all registrations"
  ON registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Public can create registrations for active retreats"
  ON registrations FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retreats
      WHERE retreats.id = retreat_id
      AND retreats.is_active = true
    )
  );

CREATE POLICY "Admin users can update registrations"
  ON registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_retreats_share_link ON retreats(share_link);
CREATE INDEX IF NOT EXISTS idx_retreats_active ON retreats(is_active);
CREATE INDEX IF NOT EXISTS idx_registrations_retreat ON registrations(retreat_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);
