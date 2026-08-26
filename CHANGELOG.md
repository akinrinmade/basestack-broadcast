# Changelog

## Phase 1 — Foundation (2026-08-26)

### Added
- Supabase client singleton with anon key (`lib/supabase/client.ts`)
- Database migration `0001_create_subscribers_and_settings`:
  - `subscribers` table: id, name, email, status, source, tokens, timestamps, bounce tracking
  - `settings` table: single-row config (id = 1, seeded)
  - Email format CHECK constraint
  - Status and source CHECK constraints
  - Case-insensitive unique index on `lower(email)`
  - Indexes on status, source, created_at
  - `updated_at` auto-maintained via trigger
  - RLS enabled with `TO anon, authenticated` CRUD policies
- TypeScript types: Subscriber, SubscriberInput, Settings, SettingsInput, DashboardStats, CsvRow, CsvPreview
- Subscriber data layer (`lib/subscribers.ts`): fetch, create, update, delete, bulk create, dashboard stats, email existence check
- Settings data layer (`lib/settings.ts`): fetch, save
- CSV parsing and validation (`lib/csv.ts`): RFC-aware CSV parser, email validation, duplicate detection (in-file and against DB)
- Admin shell (`components/admin-shell.tsx`): responsive sidebar, topbar, navigation
- Badge component (`components/ui/badge.tsx`)
- Dashboard page (`app/page.tsx`): real subscriber counts, campaign "not configured" state, system pulse
- Subscribers page (`app/subscribers/page.tsx`): CRUD modals, search, status filter, CSV import with preview and validation report
- Settings page (`app/settings/page.tsx`): real persistence with client-side validation
- Shell routes: `/compose`, `/campaigns`, `/login`
- Public pages (`components/public-pages.tsx`): subscribe, unsubscribe, confirmed
- Documentation: PROJECT.md, ARCHITECTURE.md, ROADMAP.md, HANDOFF.md, CHANGELOG.md

### Changed
- Refactored monolithic `broadcast-console.tsx` into route-based components
- Dashboard now uses real database counts instead of hardcoded numbers
- Subscribers table now displays real database records
- Settings page now persists to Supabase instead of being a placeholder

### Removed
- `components/broadcast-console.tsx` — replaced by route-based components
