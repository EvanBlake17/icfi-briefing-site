-- =============================================================
-- Daily Briefing — Supabase Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- 1. Profiles table (approval gating)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Auto-create a profile row whenever a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Highlights table (per-user notes)
CREATE TABLE highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  briefing_date TEXT NOT NULL,
  text TEXT NOT NULL,
  section_id TEXT,
  section_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- Only approved users can read/write their own highlights
CREATE POLICY "Approved users read own highlights"
  ON highlights FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

CREATE POLICY "Approved users insert own highlights"
  ON highlights FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

CREATE POLICY "Approved users delete own highlights"
  ON highlights FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

-- 3. Index for fast highlight lookups
CREATE INDEX idx_highlights_user_date ON highlights (user_id, briefing_date);
