-- =============================================================
-- Daily Briefing — Color Highlights Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- 1. Add color column to highlights table (default yellow for backwards compat)
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';

-- 2. Ensure annotation column exists
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS annotation TEXT DEFAULT '';

-- 3. Add UPDATE policy (was missing from initial migration)
CREATE POLICY "Approved users update own highlights"
  ON highlights FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );
