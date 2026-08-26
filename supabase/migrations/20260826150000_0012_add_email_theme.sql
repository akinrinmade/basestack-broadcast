/* Adds a shared visual theme for verification, welcome, and campaign emails. */

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS email_theme TEXT NOT NULL DEFAULT 'clean'
    CHECK (email_theme IN ('clean', 'sunset', 'forest', 'ocean'));