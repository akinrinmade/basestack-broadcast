# Handoff

## Current Phase
Phase 2 — Authentication + Security

## Status
COMPLETE

## Completed Work

### Authentication
- Auth context provider (`components/auth-provider.tsx`) with `useAuth()` hook
  - `supabase.auth.getSession()` for initial load
  - `onAuthStateChange` for session updates
  - `signIn(email, password)` using `signInWithPassword`
  - `signOut()` using `supabase.auth.signOut()`
- Login page (`app/login/page.tsx`) — real email/password form with loading and error states
  - Redirects to `/` on successful login
  - Redirects away if already authenticated
- Protected route wrapper (`components/protected-route.tsx`)
  - Checks auth state, redirects to `/login` if unauthenticated
  - Shows loading spinner during auth resolution
- Auth provider integrated into root layout (`app/layout.tsx`)
- All protected routes wrapped: `/`, `/subscribers`, `/compose`, `/campaigns`, `/settings`
- Public routes NOT wrapped: `/subscribe`, `/subscribe/confirmed`, `/unsubscribe`

### Security
- RLS migration `0002_tighten_rls_authenticated_only`:
  - Dropped all Phase 1 `anon, authenticated` policies
  - Created `TO authenticated`-only policies for SELECT, INSERT, UPDATE, DELETE on both tables
  - Anon role confirmed to have zero access (SQL test: anon SELECT returns 0 rows)
- Admin shell updated with real user email display and logout button
- No service-role keys or secrets exposed client-side

### Preserved from Phase 1
- Subscriber CRUD (fetch, create, update, delete, bulk create)
- CSV import with validation and preview
- Settings persistence
- Dashboard with real database metrics
- All UI/UX, visual design, navigation, cards, badges, modals

## Database Migrations Created
1. `0001_create_subscribers_and_settings` — subscribers + settings tables, RLS, constraints, indexes, triggers
2. `0002_tighten_rls_authenticated_only` — replaced anon policies with authenticated-only policies

## Tables Currently Available
- `subscribers` — CRUD via authenticated key only
- `settings` — CRUD via authenticated key only (single-row, id = 1, seeded)

## RLS Implemented
- `subscribers`: SELECT, INSERT, UPDATE, DELETE for `authenticated` only
- `settings`: SELECT, INSERT, UPDATE, DELETE for `authenticated` only
- `anon` role: zero access to both tables (verified)

## Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` — already in `.env`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already in `.env`

No server-side secrets required for Phase 2.

## Known Issues
- No admin user provisioning UI — admin users must be created via Supabase dashboard or SQL. This is intentional for Phase 2 (single-admin setup).
- No "forgot password" flow — can be added in a future phase.
- Public subscribe/unsubscribe pages are still UI-only (no database writes). Phase 3 will implement these with token-based access.

## Incomplete Functionality
- Public double-opt-in signup (UI exists, no backend)
- Unsubscribe token verification (UI exists, no backend)
- Campaign composition and sending
- Resend email delivery
- Cron / scheduled jobs
- Bounce/complaint webhooks
- Batch sending
- Role-based access control (all authenticated users are admins)

## Verification Performed
1. Production build passes (`npm run build` — 11 routes, 0 errors)
2. RLS confirmed: `SET ROLE anon; SELECT count(*) FROM subscribers` returns 0
3. RLS confirmed: `SET ROLE anon; SELECT count(*) FROM settings` returns 0
4. Security posture verified: all policies scope `TO authenticated` only
5. No service-role keys in frontend code

## Next Recommended Job
**Phase 3 — Public Signup & Double Opt-In**

1. Create a SECURITY DEFINER function for public subscriber insert (anon-safe, writes to subscribers table)
2. Wire the public `/subscribe` form to insert a `pending` subscriber via that function
3. Implement confirmation email sending (requires Resend or similar — may need Phase 4 first)
4. Implement `/subscribe/confirmed` to verify the confirm_token and activate the subscriber
5. Implement `/unsubscribe` to verify the unsubscribe_token and set status to `unsubscribed`
6. Add rate limiting on public signup endpoint
