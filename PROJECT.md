# Basestack Broadcast

An internal one-way email broadcast system for Basestack Academy.

Administrators manage subscribers, compose and send campaign emails, and let the public opt in/out through a token-verified double opt-in flow. The system is being built incrementally in engineering phases.

## Current Phase

**Phase 5 — Deliverability** (IN PROGRESS)

Done so far:
- Rate limiting on the public `/api/subscribe` endpoint (5 requests / 15 min per IP, Postgres-backed)
- Resend webhook receiver (`/api/webhooks/resend`) — auto-suppresses subscribers on hard bounces and spam complaints, increments `bounce_count` on every bounce (including soft ones)
- Subscriber CSV export from the subscribers page (respects the current search/status filter)

Still open: aggregate delivery trends and broader Phase 6 administration features. See `ROADMAP.md`.

**Phase 4 — Campaigns & Resend** (COMPLETE)

- Campaign composition (subject, HTML body, sender/reply-to overrides, recipient filter)
- Resend integration for single sends, test sends, and batched sends (chunked at 100/request, concurrency-limited)
- Manual "Send" and "Send test" actions per campaign
- Campaign scheduling (set/cancel a `scheduled_at`) with a Vercel Cron job (`/api/cron/send-scheduled`, every 15 minutes) that picks up due campaigns
- Cron endpoint is secret-gated (`CRON_SECRET`) so it cannot be triggered by an unauthenticated request
- Per-recipient send tracking (`campaign_sends`) with a unique `(campaign_id, subscriber_id)` constraint, making retries idempotent — a campaign stuck as `sending`/`failed` can be safely re-sent without double-emailing anyone
- `/api/status` reports whether Resend and the cron secret are actually configured, which drives the dashboard's system-status tiles

**Phase 3 — Public Signup & Double Opt-In** (COMPLETE, folded in ahead of schedule)

- `/api/subscribe` — public signup endpoint, creates a `pending` subscriber (or reactivates a previously unsubscribed one) and best-effort sends a confirmation email if Resend is configured
- `/api/subscribe/confirm` — verifies `confirm_token` and activates the subscriber
- `/api/unsubscribe` — verifies `unsubscribe_token` and sets status to `unsubscribed`
- All three are `SECURITY DEFINER`-style server routes using the Supabase service-role key, so `anon` still has zero direct table access

**Phase 2 — Authentication + Security** (COMPLETE)

- Supabase email/password authentication
- Protected admin routes (redirect to `/login` when unauthenticated)
- Logout functionality
- Session persistence across browser refresh
- RLS tightened to `authenticated`-only (anon has zero direct database access on all tables)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn (base-nova style)
- **UI Components:** @base-ui/react, lucide-react
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Email delivery:** Resend (single sends, batch sends, test sends)
- **Scheduling:** Vercel Cron
- **Package Manager:** npm

## Getting Started

The dev server runs automatically. Dependencies are already installed.

## Project Structure

```
app/
  page.tsx                        — Dashboard (real metrics, protected)
  subscribers/page.tsx             — Subscriber management (CRUD, search, filter, CSV import, protected)
  compose/page.tsx                 — Campaign composer: draft, send, send test, schedule/unschedule (protected)
  campaigns/page.tsx               — Campaign history list (protected)
  campaigns/[id]/page.tsx          — Single campaign detail + send log (protected)
  settings/page.tsx                — Settings (real persistence, protected)
  login/page.tsx                   — Login page (email/password auth)
  subscribe/                       — Public subscribe form + confirm + confirmed pages
  unsubscribe/                     — Public unsubscribe page
  api/
    subscribe/route.ts             — Public signup (creates pending subscriber, sends confirmation email)
    subscribe/confirm/route.ts     — Verifies confirm_token, activates subscriber
    unsubscribe/route.ts           — Verifies unsubscribe_token, deactivates subscriber
    campaigns/[id]/send/route.ts   — Manual campaign send
    campaigns/[id]/test/route.ts   — Send a test copy of a campaign
    cron/send-scheduled/route.ts   — Vercel Cron target; sends due scheduled campaigns
    webhooks/resend/route.ts       — Resend delivery-event webhook; auto-suppresses on bounce/complaint
    status/route.ts                — Reports Resend/cron configuration state for the dashboard
components/
  auth-provider.tsx                — Supabase auth context provider
  protected-route.tsx              — Route guard (redirects to /login if unauthenticated)
  admin-shell.tsx                  — Admin layout shell (sidebar, topbar, logout)
  public-pages.tsx                 — Public-facing subscribe/unsubscribe/confirmed components
  ui/
    button.tsx                     — Button component (base-ui)
    badge.tsx                      — Badge component
lib/
  types.ts                         — Shared TypeScript types
  supabase/client.ts                — Browser Supabase client singleton (anon key)
  supabase/admin.ts                 — Server-only Supabase client (service role key)
  supabase/route-auth.ts            — Server-side helper to resolve the authenticated user from a request
  subscribers.ts                    — Subscriber query functions
  campaigns.ts                      — Client-side campaign query functions
  settings.ts                       — Settings query functions
  csv.ts                            — CSV parsing, validation, and export
  resend.ts                         — Resend client, single/batch send, HTML wrapper with footer + unsubscribe link
  server/campaign-service.ts        — Server-only campaign send logic shared by manual send and cron
  server/rate-limit.ts              — Postgres-backed fixed-window rate limiter (public endpoints)
  server/resend-webhook.ts          — Svix-style HMAC verification for Resend webhook payloads
  api-client.ts                     — Shared fetch helper for calling the app's own API routes
  utils.ts                          — Utility functions (cn)
supabase/migrations/
  0001_create_subscribers_and_settings.sql
  0002_tighten_rls_authenticated_only.sql
  0003_create_campaigns.sql
  0004_create_rate_limits.sql
```

## Environment Variables

**Client-safe (already configured):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key (this repo's code reads this name, not `NEXT_PUBLIC_SUPABASE_ANON_KEY` — a naming mismatch that existed in the docs before this update; make sure your actual `.env`/Vercel config uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or the app fails to initialize the Supabase client)

**Server-only, required to fully activate email delivery and scheduling — not yet set:**
- `RESEND_API_KEY` — required for any real email to send (confirmation, campaigns, test sends). Without it, signup and unsubscribe flows still work, but no email goes out.
- `RESEND_FROM_EMAIL` — default "from" address used when a campaign doesn't override it
- `RESEND_REPLY_TO` — optional default reply-to address
- `CRON_SECRET` — required for `/api/cron/send-scheduled` to run; without it, scheduled campaigns will never actually send, even though they can be scheduled in the UI
- `RESEND_WEBHOOK_SECRET` — the signing secret shown when you add a webhook endpoint in the Resend dashboard (pointing at `/api/webhooks/resend`). Without it, bounce/complaint events are never processed and hard-bounced addresses stay `active` forever
- `NEXT_PUBLIC_APP_URL` — optional; used to build confirm/unsubscribe links. Falls back to the request origin, but should be set explicitly once deployed so links are stable
- `SUPABASE_SERVICE_ROLE_KEY` — used by `lib/supabase/admin.ts` for the server-only routes above

No server-side secrets are stored in the database or exposed to the frontend bundle.

## Authentication

- Admin signs in at `/login` with email and password via Supabase Auth.
- Session is stored in cookies and persists across browser refresh.
- All admin routes (`/`, `/subscribers`, `/compose`, `/campaigns`, `/campaigns/[id]`, `/settings`) are protected.
- Public routes (`/subscribe`, `/subscribe/confirm`, `/subscribe/confirmed`, `/unsubscribe`) remain accessible without auth.
- Logout button in the sidebar clears the session and redirects to `/login`.

## Known Gaps

These are the remaining items before the roadmap is fully complete — see `ROADMAP.md` and `HANDOFF.md` for details:

- Trend view currently covers the six most recent weekly send buckets; date-range comparison is not yet available
- Image uploads for campaign content remain unimplemented
