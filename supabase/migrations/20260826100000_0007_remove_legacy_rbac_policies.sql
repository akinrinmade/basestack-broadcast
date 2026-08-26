/* Remove pre-RBAC policies that would otherwise bypass team role checks. */

DROP POLICY IF EXISTS "auth_select_subscribers" ON subscribers;
DROP POLICY IF EXISTS "auth_insert_subscribers" ON subscribers;
DROP POLICY IF EXISTS "auth_update_subscribers" ON subscribers;
DROP POLICY IF EXISTS "auth_delete_subscribers" ON subscribers;

DROP POLICY IF EXISTS "auth_select_settings" ON settings;
DROP POLICY IF EXISTS "auth_insert_settings" ON settings;
DROP POLICY IF EXISTS "auth_update_settings" ON settings;
DROP POLICY IF EXISTS "auth_delete_settings" ON settings;

DROP POLICY IF EXISTS "auth_select_campaigns" ON campaigns;
DROP POLICY IF EXISTS "auth_insert_campaigns" ON campaigns;
DROP POLICY IF EXISTS "auth_update_campaigns" ON campaigns;
DROP POLICY IF EXISTS "auth_delete_campaigns" ON campaigns;
DROP POLICY IF EXISTS "auth_select_campaign_sends" ON campaign_sends;