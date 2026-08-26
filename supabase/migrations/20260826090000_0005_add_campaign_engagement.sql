/* Track engagement events received from Resend for each campaign send. */

ALTER TABLE campaign_sends
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_resend_id
  ON campaign_sends (resend_id)
  WHERE resend_id IS NOT NULL;