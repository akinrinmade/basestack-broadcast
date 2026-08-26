/*
# Phase 3: Campaigns + campaign sends

## Purpose
Adds the tables needed for email broadcast campaigns:
- `campaigns` — a single campaign/broadcast (draft through sent)
- `campaign_sends` — one row per recipient per campaign, used to record
  delivery outcome, prevent duplicate sends, and compute accurate
  sent/failed counts.

## New Tables

### campaigns
| Column | Type | Description |
|--------|------|--------------|
| id | UUID PK | Auto-generated unique ID |
| name | TEXT NOT NULL | Internal campaign name/title |
| subject | TEXT NOT NULL | Email subject line |
| sender_name | TEXT | Optional override of settings.sender_name |
| sender_email | TEXT | Optional override of the from address |
| reply_to | TEXT | Optional reply-to override |
| html_content | TEXT NOT NULL | Email HTML body |
| recipient_filter | JSONB NOT NULL | `{ mode: 'all_active' | 'selected', subscriber_ids?: [] }` |
| status | TEXT NOT NULL | draft, scheduled, sending, sent, failed, cancelled |
| recipient_count | INTEGER NOT NULL DEFAULT 0 | Snapshot of eligible recipients at send time |
| sent_count | INTEGER NOT NULL DEFAULT 0 | Successful sends |
| failed_count | INTEGER NOT NULL DEFAULT 0 | Failed sends |
| scheduled_at | TIMESTAMPTZ | Reserved for future scheduled sending |
| created_by | UUID | auth.uid() of the creator |
| created_at / updated_at / sent_at | TIMESTAMPTZ | Lifecycle timestamps |

### campaign_sends
| Column | Type | Description |
|--------|------|--------------|
| id | UUID PK | Auto-generated unique ID |
| campaign_id | UUID FK -> campaigns | Parent campaign |
| subscriber_id | UUID FK -> subscribers | Recipient (nullable if subscriber later deleted) |
| email | TEXT NOT NULL | Denormalized recipient email at send time |
| status | TEXT NOT NULL | sent or failed |
| error | TEXT | Error message when status = failed |
| resend_id | TEXT | Resend message id, when available |
| sent_at | TIMESTAMPTZ | When this attempt was recorded |

A unique constraint on (campaign_id, subscriber_id) prevents a subscriber
from being emailed twice for the same campaign, which makes send retries
safe: only recipients without an existing successful row are re-attempted.

## Security (RLS)
Both tables follow the same authenticated-only, single-tenant admin model
established in migration 0002 (any authenticated user is an admin of this
console; there is no per-user ownership/role split yet). `created_by` is
stored for audit purposes even though it is not currently used to scope
access.

All privileged mutations (sending campaigns, recording sends) happen from
trusted server-side API routes using the Supabase service role key, which
bypasses RLS entirely — these policies only govern direct client access
(listing campaigns, creating/editing a draft, reading send history).
*/

-- =========================================================
-- campaigns table
-- =========================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  sender_name TEXT,
  sender_email TEXT,
  reply_to TEXT,
  html_content TEXT NOT NULL DEFAULT '',
  recipient_filter JSONB NOT NULL DEFAULT '{"mode":"all_active"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at DESC);

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_campaigns" ON campaigns;
CREATE POLICY "auth_select_campaigns" ON campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_campaigns" ON campaigns;
CREATE POLICY "auth_insert_campaigns" ON campaigns
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_campaigns" ON campaigns;
CREATE POLICY "auth_update_campaigns" ON campaigns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_campaigns" ON campaigns;
CREATE POLICY "auth_delete_campaigns" ON campaigns
  FOR DELETE TO authenticated USING (status IN ('draft', 'failed', 'cancelled'));

-- =========================================================
-- campaign_sends table
-- =========================================================

CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES subscribers (id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_sends_unique_recipient
  ON campaign_sends (campaign_id, subscriber_id)
  WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_id ON campaign_sends (campaign_id);

ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_campaign_sends" ON campaign_sends;
CREATE POLICY "auth_select_campaign_sends" ON campaign_sends
  FOR SELECT TO authenticated USING (true);

-- Inserts/updates to campaign_sends are only ever performed by trusted
-- server-side API routes using the service role key (which bypasses RLS),
-- so no authenticated-role write policy is defined here on purpose.
