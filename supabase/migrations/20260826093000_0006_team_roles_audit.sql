/* Phase 6: team roles and database audit history. */

CREATE TABLE IF NOT EXISTS team_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO team_members (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members (role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION is_team_member(required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
      AND (required_role IS NULL OR role = required_role OR (required_role = 'editor' AND role = 'admin'))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    jsonb_build_object('status', COALESCE(NEW.status, OLD.status))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_subscribers_audit ON subscribers;
CREATE TRIGGER trg_subscribers_audit AFTER INSERT OR UPDATE OR DELETE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS trg_campaigns_audit ON campaigns;
CREATE TRIGGER trg_campaigns_audit AFTER INSERT OR UPDATE OR DELETE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_select_members" ON team_members;
CREATE POLICY "team_select_members" ON team_members FOR SELECT TO authenticated
  USING (is_team_member());
DROP POLICY IF EXISTS "team_admin_manage_members" ON team_members;
CREATE POLICY "team_admin_manage_members" ON team_members FOR ALL TO authenticated
  USING (is_team_member('admin')) WITH CHECK (is_team_member('admin'));

DROP POLICY IF EXISTS "team_select_audit_logs" ON audit_logs;
CREATE POLICY "team_select_audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (is_team_member());

DROP POLICY IF EXISTS "team_select_subscribers" ON subscribers;
CREATE POLICY "team_select_subscribers" ON subscribers FOR SELECT TO authenticated
  USING (is_team_member());
DROP POLICY IF EXISTS "team_insert_subscribers" ON subscribers;
CREATE POLICY "team_insert_subscribers" ON subscribers FOR INSERT TO authenticated
  WITH CHECK (is_team_member('editor'));
DROP POLICY IF EXISTS "team_update_subscribers" ON subscribers;
CREATE POLICY "team_update_subscribers" ON subscribers FOR UPDATE TO authenticated
  USING (is_team_member('editor')) WITH CHECK (is_team_member('editor'));
DROP POLICY IF EXISTS "team_delete_subscribers" ON subscribers;
CREATE POLICY "team_delete_subscribers" ON subscribers FOR DELETE TO authenticated
  USING (is_team_member('admin'));

DROP POLICY IF EXISTS "team_select_settings" ON settings;
CREATE POLICY "team_select_settings" ON settings FOR SELECT TO authenticated
  USING (is_team_member());
DROP POLICY IF EXISTS "team_update_settings" ON settings;
CREATE POLICY "team_update_settings" ON settings FOR UPDATE TO authenticated
  USING (is_team_member('admin')) WITH CHECK (is_team_member('admin'));

DROP POLICY IF EXISTS "auth_select_campaigns" ON campaigns;
CREATE POLICY "team_select_campaigns" ON campaigns FOR SELECT TO authenticated
  USING (is_team_member());
DROP POLICY IF EXISTS "auth_insert_campaigns" ON campaigns;
CREATE POLICY "team_insert_campaigns" ON campaigns FOR INSERT TO authenticated
  WITH CHECK (is_team_member('editor'));
DROP POLICY IF EXISTS "auth_update_campaigns" ON campaigns;
CREATE POLICY "team_update_campaigns" ON campaigns FOR UPDATE TO authenticated
  USING (is_team_member('editor')) WITH CHECK (is_team_member('editor'));
DROP POLICY IF EXISTS "auth_delete_campaigns" ON campaigns;
CREATE POLICY "team_delete_campaigns" ON campaigns FOR DELETE TO authenticated
  USING (is_team_member('admin'));

DROP POLICY IF EXISTS "auth_select_campaign_sends" ON campaign_sends;
CREATE POLICY "team_select_campaign_sends" ON campaign_sends FOR SELECT TO authenticated
  USING (is_team_member());