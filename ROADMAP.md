# Roadmap

## Phase 1 — Foundation (COMPLETE)
- Supabase integration
- Database schema (subscribers, settings)
- RLS policies
- Subscriber CRUD
- CSV import with validation
- Settings persistence
- Dashboard with real metrics
- Route structure
- TypeScript types

## Phase 2 — Authentication + Security (COMPLETE)
- Supabase email/password authentication
- Login page with loading/error states
- Protected admin routes (redirect to /login)
- Session persistence across browser refresh
- Logout functionality
- RLS tightened to authenticated-only (anon has zero access)
- Real user display in sidebar
- Public routes remain accessible without auth

## Phase 3 — Public Signup & Double Opt-In (COMPLETE)
- Public subscribe form with real database insert (`/api/subscribe`)
- Confirmation email with token (best-effort — no-ops cleanly if Resend isn't configured)
- Confirm endpoint to activate subscriber (`/api/subscribe/confirm`)
- Unsubscribe with token verification (`/api/unsubscribe`)
- Re-subscribing a previously unsubscribed email reactivates the existing row instead of erroring
- Server-side routes use the service-role key rather than a `SECURITY DEFINER` SQL function, keeping `anon` at zero direct table access

## Phase 4 — Campaigns & Resend (COMPLETE)
- Campaign composition (name, subject, HTML body, sender/reply-to overrides, recipient filter)
- Resend API integration (server-side, via `lib/resend.ts` and `lib/server/campaign-service.ts`)
- Manual send and send-test actions
- Batched sending (100/request, concurrency-limited) for large recipient lists
- Campaign scheduling (schedule/unschedule from the composer)
- Vercel Cron job to pick up and send due scheduled campaigns
- Per-recipient send logs (`campaign_sends`) with idempotent retries
- Campaign detail page showing send history per recipient

**Not carried over from the original Phase 4 plan:**
- Image uploads (Supabase Storage) for campaign content — not yet implemented

## Phase 5 — Deliverability (IN PROGRESS)

**Done:**
- Rate limiting on the public `/api/subscribe` endpoint — 5 requests / 15 minutes per IP, backed by a new `rate_limits` table (migration 0004). Returns `429` with a `Retry-After` header when exceeded.
- Bounce/complaint webhook handling — `/api/webhooks/resend` verifies Resend's Svix-style HMAC signature, then auto-sets `status = 'suppressed'` with a `suppression_reason` on hard bounces (`email.bounced`, non-transient) and complaints (`email.complained`). Soft/transient bounces increment `bounce_count` but don't suppress, since those addresses are expected to recover.
- Subscriber CSV export — "Export CSV" button on the subscribers page, exports whatever the current search/status filter shows (name, email, status, source, suppression reason, bounce count, timestamps — tokens are deliberately excluded since they grant unauthenticated write access)
- Suppression reason + bounce count now surface inline in the subscribers table under the status badge

**Still open:**
- Delivery metrics beyond the current send/open/click counts

## Phase 6 — Polish (IN PROGRESS)
- Dashboard send trends
- Audit logging for subscriber and campaign mutations
- Team management with invite and role controls
- Role-based access control (`admin`, `editor`, `viewer`)
- Forgot-password flow
- Admin user provisioning UI (team invitations are now supported; Supabase remains the recovery path for the first admin)

## To fully activate what's already built

These aren't code work — they're configuration/deployment steps needed before Phase 3 and 4 features actually function end-to-end in production:
- Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optionally `RESEND_REPLY_TO`
- Set `CRON_SECRET` (must match what's configured in Vercel Cron)
- Set `NEXT_PUBLIC_APP_URL` for stable confirm/unsubscribe links
- Set `SUPABASE_SERVICE_ROLE_KEY` for the server-only API routes
- Set `RESEND_WEBHOOK_SECRET` and add `/api/webhooks/resend` as a webhook endpoint in the Resend dashboard, or bounces/complaints will never be processed
- Confirm your Supabase  anon key env var is actually named `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — that's what the code reads (a longstanding docs/code naming mismatch, now corrected here)
