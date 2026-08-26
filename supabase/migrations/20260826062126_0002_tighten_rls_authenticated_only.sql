/*
# Phase 2: Tighten RLS to authenticated-only

## Purpose
Replaces the permissive Phase 1 RLS policies (TO anon, authenticated with USING (true))
with authenticated-only access. Anonymous users will have zero direct database access
to the subscribers and settings tables.

## Security Changes
- DROP all Phase 1 policies that granted access to the `anon` role.
- CREATE new policies scoped `TO authenticated` only.
- All CRUD operations (SELECT, INSERT, UPDATE, DELETE) require an authenticated session.
- No ownership column is needed because this is an admin console — any authenticated
  user is an admin (Phase 2 does not implement role differentiation).

## Tables Affected
- `subscribers` — 4 new policies (SELECT, INSERT, UPDATE, DELETE) for authenticated only
- `settings` — 4 new policies (SELECT, INSERT, UPDATE, DELETE) for authenticated only

## Important Notes
1. The `anon` role loses ALL access to both tables. Frontend calls without a valid
   Supabase session will receive empty results (SELECT) or permission errors (INSERT/UPDATE/DELETE).
2. Public routes (/subscribe, /unsubscribe) do NOT query these tables yet — they are UI-only
   shells. When Phase 3 implements public signup, it will use a SECURITY DEFINER function
   or separate policies with token-based access, NOT anon access to the raw table.
3. This migration is idempotent — safe to re-run.
*/

-- =========================================================
-- subscribers: drop old anon policies, create authenticated-only
-- =========================================================

DROP POLICY IF EXISTS "anon_select_subscribers" ON subscribers;
DROP POLICY IF EXISTS "anon_insert_subscribers" ON subscribers;
DROP POLICY IF EXISTS "anon_update_subscribers" ON subscribers;
DROP POLICY IF EXISTS "anon_delete_subscribers" ON subscribers;

CREATE POLICY "auth_select_subscribers" ON subscribers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_subscribers" ON subscribers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_subscribers" ON subscribers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_subscribers" ON subscribers
  FOR DELETE TO authenticated USING (true);

-- =========================================================
-- settings: drop old anon policies, create authenticated-only
-- =========================================================

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;

CREATE POLICY "auth_select_settings" ON settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_settings" ON settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_settings" ON settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_settings" ON settings
  FOR DELETE TO authenticated USING (true);