# Handoff

## Current Phase
Phase 1 — Foundation

## Status
COMPLETE

## Completed Work
- Supabase client singleton (`lib/supabase/client.ts`)
- Database migration: `0001_create_subscribers_and_settings`
  - `subscribers` table with constraints, indexes, email validation, case-insensitive uniqueness
  - `settings` table (single-row, seeded)
  - `updated_at` trigger on both tables
  - RLS enabled with `TO anon, authenticated` policies (Phase 1)
- TypeScript types (`lib/types.ts`): Subscriber, Settings, DashboardStats, CsvRow, CsvPreview
- Subscriber CRUD (`lib/subscribers.ts`): fetch, create, update, delete, bulk create, dashboard stats, email existence check
- Settings persistence (`lib/settings.ts`): fetch, save
- CSV parsing and validation (`lib/csv.ts`): parse, validate with email format, missing field, duplicate detection (in-CSV and against DB)
- Admin shell (`components/admin-shell.tsx`): sidebar nav, topbar, responsive layout
- Dashboard page (`app/page.tsx`): real subscriber counts from database, campaign "not configured" state
- Subscribers page (`app/subscribers/page.tsx`): full CRUD with modals, search, status filter, CSV import with preview
- Settings page (`app/settings/page.tsx`): real persistence with validation
- Shell routes: `/compose`, `/campaigns`, `/login` — truthful "not yet implemented" states
- Public pages (`components/public-pages.tsx`): subscribe, unsubscribe, confirmed — preserved from v0
- Old monolithic `broadcast-console.tsx` removed

## Database Migrations Created
1. `0001_create_subscribers_and_settings` — subscribers + settings tables, RLS, constraints, indexes, triggers

## Tables Currently Available
- `subscribers` — full CRUD via anon key
- `settings` — single-row config (id = 1, seeded)

## RLS Implemented
- `subscribers`: SELECT, INSERT, UPDATE, DELETE for `anon, authenticated` (Phase 1 — no auth yet)
- `settings`: SELECT, INSERT, UPDATE, DELETE for `anon, authenticated` (Phase 1 — no auth yet)

## Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` — already in `.env`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already in `.env`

No server-side secrets required for Phase 1.

## Known Issues
- RLS policies are permissive (`USING (true)`) because auth is not yet implemented. This MUST be tightened in Phase 2.
- The admin user profile in the sidebar ("Sam Carter") is hardcoded — will be replaced with real auth user data in Phase 2.
- Public subscribe/unsubscribe pages are UI-only — they don't write to the database yet.

## Incomplete Functionality
- Authentication (login is a shell)
- Public double-opt-in signup (UI exists, no backend)
- Campaign composition and sending
- Resend email delivery
- Cron / scheduled jobs
- Bounce/complaint webhooks
- Unsubscribe token verification
- Batch sending

## Next Recommended Job
**Phase 2 — Authentication**

1. Implement Supabase email/password auth (sign up + sign in)
2. Build auth context provider for the admin shell
3. Protect admin routes (redirect to `/login` if not authenticated)
4. Tighten RLS policies from `TO anon, authenticated` to `TO authenticated` with admin role checks
5. Replace hardcoded "Sam Carter" profile with real auth user data
6. Add sign-out functionality
