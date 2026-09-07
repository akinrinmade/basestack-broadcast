-- Manual batch sending with a stable recipient snapshot.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_size INTEGER NOT NULL DEFAULT 100;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','ready','scheduled','sending','sent','completed','paused','failed','cancelled'));

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  unsubscribe_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON campaign_recipients(campaign_id, status);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_campaign_recipients" ON campaign_recipients;
CREATE POLICY "auth_select_campaign_recipients" ON campaign_recipients
  FOR SELECT TO authenticated USING (true);

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_batch_size_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_batch_size_check CHECK (batch_size BETWEEN 1 AND 100);
