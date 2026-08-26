# Changelog

## Phase 2 — Authentication + Security (2026-08-26)

### Added
- Auth context provider (`components/auth-provider.tsx`):
  - `useAuth()` hook providing `user`, `session`, `loading`, `signIn`, `signOut`
  - `supabase.auth.getSession()` for initial session load
  - `onAuthStateChange` subscription for real-time session updates
- Protected route wrapper (`components/protected-route.tsx`):
  - Redirects unauthenticated users to `/login`
  - Loading spinner during auth state resolution
- Login page rewritten (`app/login/page.tsx`):
  - Real email/password form via `supabase.auth.signInWithPassword()`
  - Loading state during sign-in
  - Error state for invalid credentials
  - Auto-redirect to `/` if already authenticated
- Logout button in admin sidebar with `LogOut` icon
- Auth provider integrated into root layout wrapping all children
- All protected routes wrapped with `ProtectedRoute`: `/`, `/subscribers`, `/compose`, `/campaigns`, `/settings`

### Changed
- Admin shell (`components/admin-shell.tsx`):
  - Sidebar now displays real authenticated user email instead of hardcoded "Sam Carter"
  - User initials derived from email
  - Logout button replaces the "more" icon
  - Greeting no longer hardcodes a name
- Root layout (`app/layout.tsx`) wraps children in `AuthProvider`
- RLS policies on `subscribers` and `settings` tightened from `TO anon, authenticated` to `TO authenticated` only

### Security
- Migration `0002_tighten_rls_authenticated_only`:
  - Dropped 8 Phase 1 policies granting anon access
  - Created 8 new policies scoped `TO authenticated` only
  - Anon role confirmed to have zero database access (SQL verification: 0 rows returned)

### Verified
- Production build passes (11 routes, 0 errors)
- Anon SELECT on subscribers returns 0 rows
- Anon SELECT on settings returns 0 rows
- All policies scope `TO authenticated` only (confirmed via security posture)
- No service-role keys or secrets in frontend code
- Public routes (`/subscribe`, `/subscribe/confirmed`, `/unsubscribe`) remain unprotected and accessible

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
