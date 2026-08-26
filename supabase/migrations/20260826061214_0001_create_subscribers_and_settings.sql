/*
# Phase 1 Foundation: subscribers + settings tables

## Purpose
Creates the core data tables for Basestack Broadcast Phase 1:
- `subscribers` — stores email subscribers with status, source, tokens, and suppression tracking
- `settings` — single-row configuration table for sender identity

## New Tables

### subscribers
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated unique ID |
| name | TEXT | Optional subscriber name |
| email | TEXT NOT NULL | Subscriber email (case-insensitive unique) |
| status | TEXT NOT NULL | One of: pending, active, unsubscribed, suppressed |
| source | TEXT NOT NULL | One of: manual, csv_import, public_signup |
| unsubscribe_token | UUID NOT NULL | Token for unsubscribe links |
| confirm_token | UUID NOT NULL | Token for double-opt-in confirmation |
| confirmed_at | TIMESTAMPTZ | When subscriber confirmed their email |
| unsubscribed_at | TIMESTAMPTZ | When subscriber unsubscribed |
| suppression_reason | TEXT | Reason for suppression (bounce, complaint, etc.) |
| bounce_count | INTEGER NOT NULL DEFAULT 0 | Number of bounces recorded |
| signup_ip | TEXT | IP address from public signup (optional) |
| created_at | TIMESTAMPTZ | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Record last-update timestamp (auto-maintained) |

### settings
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Always 1 (single-row table) |
| sender_name | TEXT NOT NULL | Display name for outgoing emails |
| reply_to_email | TEXT | Optional reply-to address |
| mailing_address | TEXT | Required physical mailing address |
| updated_at | TIMESTAMPTZ | Record last-update timestamp (auto-maintained) |

## Constraints
- `subscribers.email` — CHECK constraint validates email format
- `subscribers.status` — CHECK constraint restricts to allowed values
- `subscribers.source` — CHECK constraint restricts to allowed values
- `subscribers.email` — case-insensitive unique index (citext expression index)
- `settings` — always exactly one row with id = 1 (seeded)

## Indexes
- `idx_subscribers_status` — for status filtering
- `idx_subscribers_source` — for source filtering
- `idx_subscribers_email_lower` — case-insensitive unique index on lower(email)
- `idx_subscribers_created_at` — for chronological ordering

## Security (RLS)
- RLS enabled on both tables.
- Phase 1 uses `TO anon, authenticated` policies because authentication is not yet implemented.
  Phase 2 will tighten these to `TO authenticated` with admin role checks.
- All CRUD operations allowed for anon + authenticated (single-tenant admin console).

## Auto-maintained updated_at
- A trigger function `set_updated_at()` sets `updated_at = now()` on every UPDATE.
- Applied to both `subscribers` and `settings` tables.

## Notes
1. The `settings` table is seeded with a single row (id = 1) with default values.
2. Email uniqueness is case-insensitive: "User@Example.com" and "user@example.com" are treated as duplicates.
3. The `citext` extension is NOT required — we use a unique index on `lower(email)` instead.
*/

-- =========================================================
-- subscribers table
-- =========================================================

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'unsubscribed', 'suppressed')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'csv_import', 'public_signup')),
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  confirm_token UUID NOT NULL DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  suppression_reason TEXT,
  bounce_count INTEGER NOT NULL DEFAULT 0,
  signup_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email format validation (basic RFC-ish check)
ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_email_format;
ALTER TABLE subscribers ADD CONSTRAINT subscribers_email_format
  CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Case-insensitive unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email_lower
  ON subscribers (lower(email));

-- Filtering indexes
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status);
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON subscribers (source);
CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers (created_at DESC);

-- =========================================================
-- settings table (single-row)
-- =========================================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  sender_name TEXT NOT NULL DEFAULT 'Basestack Academy',
  reply_to_email TEXT,
  mailing_address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Seed the single settings row
INSERT INTO settings (id, sender_name, mailing_address)
VALUES (1, 'Basestack Academy', NULL)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- updated_at trigger
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscribers_updated_at ON subscribers;
CREATE TRIGGER trg_subscribers_updated_at
  BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- Row Level Security
-- =========================================================

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- subscribers: full CRUD for anon + authenticated (Phase 1, no auth yet)
DROP POLICY IF EXISTS "anon_select_subscribers" ON subscribers;
CREATE POLICY "anon_select_subscribers" ON subscribers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_subscribers" ON subscribers;
CREATE POLICY "anon_insert_subscribers" ON subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_subscribers" ON subscribers;
CREATE POLICY "anon_update_subscribers" ON subscribers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_subscribers" ON subscribers;
CREATE POLICY "anon_delete_subscribers" ON subscribers
  FOR DELETE TO anon, authenticated USING (true);

-- settings: full CRUD for anon + authenticated (Phase 1, no auth yet)
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings
  FOR DELETE TO anon, authenticated USING (true);