# Changelog

## Phase 5 — Deliverability, partial (2026-08-26)

### Added
- Rate limiting (`lib/server/rate-limit.ts`):
  - Fixed-window limiter backed by new `rate_limits` table (migration `0004_create_rate_limits`)
  - Applied to `POST /api/subscribe`: 5 requests / 15 minutes per IP, returns `429` with a `Retry-After` header when exceeded
  - `getClientIp()` helper reads `x-forwarded-for` / `x-real-ip`
- Bounce/complaint webhook (`app/api/webhooks/resend/route.ts`, `lib/server/resend-webhook.ts`):
  - Verifies Resend's Svix-style HMAC-SHA256 webhook signature using Node's built-in `crypto`, with a 5-minute replay-timestamp tolerance
  - On `email.complained` or a non-transient `email.bounced`, sets the matching subscriber to `status = 'suppressed'` with a `suppression_reason`
  - Transient/soft bounces increment `bounce_count` without suppressing
  - Unrecognized event types are acknowledged and ignored rather than erroring
- Subscriber CSV export (`exportSubscribersToCsv()` in `lib/csv.ts`, "Export CSV" button in `app/subscribers/page.tsx`):
  - Exports the currently filtered/visible subscriber list (name, email, status, source, suppression reason, bounce count, timestamps)
  - Deliberately excludes `confirm_token`/`unsubscribe_token` — those grant unauthenticated write access to that subscriber's status
- Subscribers table now shows `suppression_reason` and `bounce_count` inline under the status badge for suppressed subscribers
- `signup_ip` is now recorded on public signups (column existed since Phase 1 migration but was never populated)

### Fixed
- Documentation previously listed the Supabase anon-key env var as `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the code actually reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Docs corrected to match the code.

### Verified
- `npx tsc --noEmit` passes with zero errors across the full project
- `npm run build` proceeds through Turbopack bundling without code-related errors (only failure in the sandbox used for verification was Google Fonts being network-unreachable, unrelated to these changes)
- Webhook signature verification checked against Svix's documented HMAC scheme

### Not yet activated (config, not code)
- Migration `0004_create_rate_limits.sql` needs to be applied to the Supabase project
- `RESEND_WEBHOOK_SECRET` needs to be set and `/api/webhooks/resend` registered as a webhook endpoint in the Resend dashboard

## Documentation sync (2026-08-26)

Docs had fallen behind the code — Phase 3 and Phase 4 were fully implemented but `PROJECT.md`, `HANDOFF.md`, `ROADMAP.md`, and `ARCHITECTURE.md` still described the project as Phase 2. This entry catches the docs up to what's actually in the repo as of this commit; no application code changed.

## Phase 4 — Campaigns & Resend (2026-08-26)

### Added
- Resend integration (`lib/resend.ts`):
  - `sendEmail()` for single sends, never throws on delivery-level failure
  - `sendEmailBatch()` — chunks into groups of 100, bounded concurrency (default 5)
  - `buildCampaignHtml()` — standard email template with mailing address + one-click unsubscribe footer
  - `checkResendConfig()`, `getDefaultFromAddress()`, `getDefaultReplyTo()`
- Campaign send orchestration (`lib/server/campaign-service.ts`):
  - `getEligibleRecipients()` — filters active subscribers by `recipient_filter` (`all_active` or `selected`)
  - `renderCampaignEmail()` — per-recipient HTML with `{{name}}` interpolation and unique unsubscribe link
  - `sendCampaignToRecipients()` — idempotent batch send with per-recipient tracking and campaign status/counter updates
  - `sendTestEmail()` — sends a single `[TEST]`-prefixed copy to an arbitrary address
- API routes: `POST /api/campaigns/[id]/send`, `POST /api/campaigns/[id]/test`
- Scheduled sending: `GET /api/cron/send-scheduled`, secured with `CRON_SECRET` bearer auth, wired to Vercel Cron (`vercel.json`, every 15 min)
- `GET /api/status` — reports `emailDeliveryConfigured` and `scheduledJobsConfigured`
- Composer UI (`app/compose/page.tsx`): draft/save, send, send test, schedule/unschedule with a `scheduled_at` picker
- Campaign history (`app/campaigns/page.tsx`) and campaign detail with send log (`app/campaigns/[id]/page.tsx`)
- Migration `0003_create_campaigns`: `campaigns` and `campaign_sends` tables, RLS (`authenticated`-only), unique `(campaign_id, subscriber_id)` constraint for idempotent sends
- Client query layer (`lib/campaigns.ts`): fetch/create/update campaigns, fetch send history, schedule/unschedule

### Security
- `campaign_sends` writes are only ever performed by server routes using the service-role key — no client-facing write policy exists for that table by design
- Cron endpoint rejects any request without a valid `CRON_SECRET` bearer token (503 if unset, 401 if mismatched)

## Phase 3 — Public Signup & Double Opt-In (2026-08-26)

### Added
- `POST /api/subscribe` — public signup: validates email, creates a `pending` subscriber or reactivates an existing unsubscribed one, best-effort sends a confirmation email if Resend is configured
- `POST /api/subscribe/confirm` — verifies `confirm_token`, activates the subscriber
- `POST /api/unsubscribe` — verifies `unsubscribe_token`, deactivates the subscriber
- `app/subscribe/confirm/page.tsx` wired to the confirm endpoint (previously UI-only)
- Public pages (`/subscribe`, `/subscribe/confirmed`, `/unsubscribe`) now perform real database writes instead of being UI-only

### Changed
- `app/api/subscribe` and friends use the service-role Supabase client (`lib/supabase/admin.ts`) rather than a `SECURITY DEFINER` SQL function, keeping the original plan's outcome (anon still has zero direct table access) via a different mechanism

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
