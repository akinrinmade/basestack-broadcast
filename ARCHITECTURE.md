# Architecture

## Overview

Basestack Broadcast is a Next.js App Router application with Supabase as the backend for database and authentication, Resend for email delivery, and Vercel Cron for scheduled sending.

## Frontend

- **Next.js 16** with App Router — admin pages are client components (`'use client'`) because they interact with Supabase directly via the anon-key client. Public API routes and server-only campaign logic run on the server using the service-role key.
- **Auth Provider** (`components/auth-provider.tsx`) — React context that wraps the entire app, providing `user`, `session`, `loading`, `signIn`, and `signOut` via the `useAuth()` hook. Uses `supabase.auth.getSession()` for initial load and `onAuthStateChange` for session updates.
- **Protected Route** (`components/protected-route.tsx`) — Wrapper component that checks auth state and redirects to `/login` if unauthenticated. Shows a loading spinner while auth state resolves.
- **Admin Shell** (`components/admin-shell.tsx`) — Shared layout with sidebar navigation, topbar, real user display, and logout button. Used by all admin routes.
- **Public Pages** (`components/public-pages.tsx`) — Standalone components for subscribe/unsubscribe/confirmed flows, separate from the admin shell, backed by real API routes (not UI-only).

## Authentication Flow

```
User visits / → ProtectedRoute checks useAuth() →
  if loading: show spinner
  if no user: redirect to /login
  if user: render page content

Login page → signIn(email, password) →
  supabase.auth.signInWithPassword() →
  onAuthStateChange fires → session set → redirect to /
```

Session persistence: Supabase stores the session in cookies. On page load, `getSession()` retrieves it, so authentication survives refresh.

## Backend

- **Supabase** provides PostgreSQL database and auth.
- **Browser client** (`lib/supabase/client.ts`) — anon-key Supabase client, used by admin pages for direct CRUD against RLS-protected tables.
- **Admin client** (`lib/supabase/admin.ts`) — service-role Supabase client, `server-only`, used exclusively inside API routes. Bypasses RLS, so it's never imported into anything client-rendered.
- **Route auth helper** (`lib/supabase/route-auth.ts`) — resolves the authenticated user from an incoming request for API routes that need to confirm the caller is an admin (e.g. `/api/status`).
- **Query layer** (`lib/subscribers.ts`, `lib/campaigns.ts`, `lib/settings.ts`) — data access functions that wrap Supabase queries for the browser client. Components call these rather than using the client directly.

## Public API Routes

These run server-side and are the only way `anon`-level visitors interact with the database — they use the service-role client internally rather than a `SECURITY DEFINER` SQL function:

- `POST /api/subscribe` — validates email, creates/reactivates a `pending` subscriber, best-effort sends a confirmation email (no-ops silently if Resend isn't configured)
- `POST /api/subscribe/confirm` — verifies `confirm_token`, activates the subscriber
- `POST /api/unsubscribe` — verifies `unsubscribe_token`, sets status to `unsubscribed`

## Rate Limiting

`lib/server/rate-limit.ts` implements a fixed-window limiter backed by a new `rate_limits` table (migration 0004): one row per key (`subscribe:<ip>`), tracking a count and window start. On each check, an expired window resets to count 1; a window under the max increments; a window at the max is rejected with a computed `Retry-After`. It's a read-then-write pattern, not a single atomic statement, so it's not airtight against a determined, highly parallel attacker hitting the same key at once — that's an accepted tradeoff for blunting casual spam on a public endpoint, documented in the file itself. Currently applied to `POST /api/subscribe` at 5 requests / 15 minutes per IP.

## Bounce/Complaint Webhook

`app/api/webhooks/resend/route.ts` receives Resend's delivery-event webhooks. Resend signs webhooks the same way Svix does — `lib/server/resend-webhook.ts` implements that verification directly with Node's built-in `crypto` module (HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`, using the byte secret from the `whsec_...` signing secret, checked with `timingSafeEqual`, with a 5-minute timestamp tolerance against replay). Unsigned or invalid requests are rejected before the body is ever parsed as JSON.

On a verified `email.complained` or non-transient `email.bounced` event, the matching subscriber (looked up case-insensitively by email) is set to `status = 'suppressed'` with a `suppression_reason`. Transient/soft bounces only increment `bounce_count`, since those are expected to resolve on their own and suppressing on them would silently drop real subscribers. Every event, soft or hard, increments `bounce_count` so a pattern is visible before suppression triggers. Unrecognized event types (delivered, opened, clicked, etc.) are acknowledged with `200 { ok: true, ignored: true }` so Resend doesn't retry them as failures.

## Admin API Routes

Require an authenticated session (checked via `lib/supabase/route-auth.ts`):

- `POST /api/campaigns/[id]/send` — triggers `sendCampaignToRecipients()` for a campaign
- `POST /api/campaigns/[id]/test` — triggers `sendTestEmail()` to a single address
- `GET /api/status` — reports whether Resend and the cron secret are configured

## Scheduled Sending

- `GET /api/cron/send-scheduled` — invoked by Vercel Cron every 15 minutes (`vercel.json`)
- Requires `Authorization: Bearer ${CRON_SECRET}`; returns 503 if `CRON_SECRET` isn't set on the server, 401 if the header doesn't match
- Loads all campaigns with `status = 'scheduled'` and `scheduled_at <= now()`, then calls the same `sendCampaignToRecipients()` used by the manual send button
- Safe to run on overlapping/repeated schedules: sends are deduplicated per-recipient via the `campaign_sends` unique constraint, so a campaign already fully sent is a no-op, and a partially-failed campaign only retries the recipients that failed

## Campaign Sending

- `lib/resend.ts` — thin wrapper around the Resend SDK:
  - `sendEmail()` — single send, returns `{ ok, id?, error? }` rather than throwing on delivery failure (so one bad address doesn't abort a batch)
  - `sendEmailBatch()` — chunks into groups of 100 (Resend's batch API limit) and runs chunks with bounded concurrency (default 5)
  - `buildCampaignHtml()` — wraps campaign body HTML in a standard template with the settings' mailing address and a one-click unsubscribe link
- `lib/server/campaign-service.ts` — orchestrates a send:
  1. Loads eligible recipients (`status = 'active'`, filtered by the campaign's `recipient_filter`)
  2. Excludes recipients who already have a successful `campaign_sends` row (idempotency)
  3. Renders per-recipient HTML (interpolates `{{name}}`, injects that recipient's unique unsubscribe link)
  4. Sends via `sendEmailBatch()`
  5. Upserts one `campaign_sends` row per attempted recipient (`sent` or `failed`, keyed on `(campaign_id, subscriber_id)`)
  6. Updates the campaign's `status`, `recipient_count`, `sent_count`, `failed_count`, `sent_at`

## Database Schema

### subscribers
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Auto-generated |
| name | TEXT | Nullable |
| email | TEXT | Not null, case-insensitive unique |
| status | TEXT | pending / active / unsubscribed / suppressed |
| source | TEXT | manual / csv_import / public_signup |
| unsubscribe_token | UUID | Auto-generated |
| confirm_token | UUID | Auto-generated |
| confirmed_at | TIMESTAMPTZ | Nullable |
| unsubscribed_at | TIMESTAMPTZ | Nullable |
| suppression_reason | TEXT | Nullable — column exists, nothing populates it yet (Phase 5) |
| bounce_count | INTEGER | Default 0 — not yet incremented anywhere (Phase 5) |
| signup_ip | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Auto-maintained via trigger |

### settings
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Always 1 (single row) |
| sender_name | TEXT | Required |
| reply_to_email | TEXT | Optional, validated |
| mailing_address | TEXT | Required |
| updated_at | TIMESTAMPTZ | Auto-maintained via trigger |

### campaigns
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Auto-generated |
| name | TEXT | Internal campaign name |
| subject | TEXT | Email subject line |
| sender_name | TEXT | Nullable, overrides settings.sender_name |
| sender_email | TEXT | Nullable, overrides default from-address |
| reply_to | TEXT | Nullable |
| html_content | TEXT | Email body |
| recipient_filter | JSONB | `{ mode: 'all_active' \| 'selected', subscriber_ids?: [] }` |
| status | TEXT | draft / scheduled / sending / sent / failed / cancelled |
| recipient_count | INTEGER | Snapshot at send time |
| sent_count | INTEGER | Successful sends |
| failed_count | INTEGER | Failed sends |
| scheduled_at | TIMESTAMPTZ | Nullable — read by the cron job |
| created_by | UUID | `auth.uid()` of the creator (stored, not yet used for access scoping) |
| created_at / updated_at / sent_at | TIMESTAMPTZ | Lifecycle timestamps |

### campaign_sends
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Auto-generated |
| campaign_id | UUID FK → campaigns | |
| subscriber_id | UUID FK → subscribers | Nullable if subscriber later deleted |
| email | TEXT | Denormalized recipient email at send time |
| status | TEXT | sent / failed |
| error | TEXT | Nullable, populated when status = failed |
| resend_id | TEXT | Nullable, Resend's message id when available |
| sent_at | TIMESTAMPTZ | When this attempt was recorded |

Unique index on `(campaign_id, subscriber_id)` (where `subscriber_id IS NOT NULL`) — this is what makes retries and overlapping cron runs safe.

## Security (RLS)

All four tables have RLS enabled. `subscribers` and `settings` are `TO authenticated` only (migration 0002); `campaigns` and `campaign_sends` follow the same model (migration 0003). The `anon` role has zero direct table access — confirmed via SQL test (anon SELECT returns 0 rows).

Public-facing mutations (signup, confirm, unsubscribe) and all campaign-sending writes bypass RLS entirely by going through server-only API routes using the Supabase **service-role** key (`lib/supabase/admin.ts`). RLS policies therefore only govern direct client access from the authenticated admin UI — they were never meant to authorize the public flows.

Any authenticated user is treated as an admin (no role differentiation yet). RBAC is planned for Phase 6.

## Data Flow

**Admin UI:**
```
Component → useAuth() for session → lib/{subscribers,campaigns,settings}.ts → lib/supabase/client.ts → Supabase (RLS-scoped)
```

**Public signup/unsubscribe:**
```
Public page → fetch('/api/subscribe' | '/api/subscribe/confirm' | '/api/unsubscribe') → lib/supabase/admin.ts (service role, bypasses RLS)
```

**Campaign sending (manual or cron):**
```
Send button → /api/campaigns/[id]/send  ─┐
Vercel Cron → /api/cron/send-scheduled  ─┴→ lib/server/campaign-service.ts → lib/resend.ts → Resend API
                                                          ↓
                                              campaign_sends + campaigns (via admin client)
```

Components never call `supabase.from()` directly for admin data — they use the query layer functions. Server routes never expose the service-role key to the client; it's only referenced inside `server-only`-marked modules.

## CSV Import Flow

1. User selects a CSV file
2. `parseCsv()` extracts name/email rows (handles headers, quoted fields)
3. `validateCsv()` checks: email format, missing name/email, duplicates within CSV, duplicates against database
4. Preview shows valid/invalid rows with reasons
5. User confirms → `bulkCreateSubscribers()` inserts valid rows as `active` with source `csv_import`
