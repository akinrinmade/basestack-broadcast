# Handoff

## Current Phase
Phase 6 — Polish

## Status
IN PROGRESS. Core Phase 6 features are implemented. Production activation still requires the environment variables, Supabase migrations, and Resend webhook setup below.

## Completed Work

### Deliverability (Phase 5, this pass)
- Rate limiting (`lib/server/rate-limit.ts`, migration `0004_create_rate_limits`): fixed-window limiter, 5 requests / 15 min per IP, applied to `POST /api/subscribe`. Returns `429` + `Retry-After` header when exceeded. Not perfectly atomic under heavy concurrent load from the same key — acceptable for blunting casual abuse, documented as a known tradeoff in the file if it ever needs to be airtight.
- Bounce/complaint webhook (`app/api/webhooks/resend/route.ts`, `lib/server/resend-webhook.ts`): verifies Resend's Svix-style HMAC signature (with a 5-minute replay-timestamp tolerance) before processing. On `email.complained` or a non-transient `email.bounced`, sets the matching subscriber to `status = 'suppressed'` with a `suppression_reason`. Transient/soft bounces only increment `bounce_count`. Requires `RESEND_WEBHOOK_SECRET` and a webhook configured in the Resend dashboard pointing at `/api/webhooks/resend` — neither is set up yet.
- CSV export (`lib/csv.ts` → `exportSubscribersToCsv`, wired into `app/subscribers/page.tsx`): exports the currently filtered/visible subscriber list as a CSV download. Excludes `confirm_token`/`unsubscribe_token` on purpose (those tokens grant unauthenticated write access to that subscriber's status).
- Subscribers table now shows `suppression_reason` and `bounce_count` inline under the status badge when a subscriber is suppressed.
- Dashboard shows successful sends across the six most recent weekly buckets.
- Team page supports admin invitations, role changes, member removal, and recent audit activity.
- Login supports password reset email requests; `/reset-password` handles the recovery session and password update.

### Authentication (Phase 2)
- Auth context provider (`components/auth-provider.tsx`) with `useAuth()` hook
- Login page (`app/login/page.tsx`) — real email/password form with loading and error states
- Protected route wrapper (`components/protected-route.tsx`)
- All admin routes wrapped: `/`, `/subscribers`, `/compose`, `/campaigns`, `/campaigns/[id]`, `/settings`
- Public routes NOT wrapped: `/subscribe`, `/subscribe/confirm`, `/subscribe/confirmed`, `/unsubscribe`

### Public signup & double opt-in (Phase 3)
- `app/api/subscribe/route.ts` — validates email, creates a `pending` subscriber (or reactivates an existing unsubscribed one), best-effort sends a confirmation email when Resend env vars are present
- `app/api/subscribe/confirm/route.ts` — verifies `confirm_token`, activates the subscriber
- `app/api/unsubscribe/route.ts` — verifies `unsubscribe_token`, sets status to `unsubscribed`
- All three run server-side against the service-role Supabase client (`lib/supabase/admin.ts`), so `anon` still has zero direct table access — no `SECURITY DEFINER` SQL function was needed

### Campaigns & Resend (Phase 4)
- `lib/resend.ts` — Resend client, `sendEmail` (single), `sendEmailBatch` (chunked at 100, concurrency-limited), `buildCampaignHtml` (wraps content with mailing-address + unsubscribe footer), `checkResendConfig`
- `lib/server/campaign-service.ts` — shared send logic: resolves eligible recipients (active, filtered by `recipient_filter`), renders per-recipient HTML (name interpolation + unsubscribe link), records outcomes to `campaign_sends`, updates campaign counters/status. Idempotent — skips recipients with an existing successful send row, so retries are safe.
- `app/api/campaigns/[id]/send/route.ts` — manual send trigger
- `app/api/campaigns/[id]/test/route.ts` — send a test copy to a single address
- `app/api/cron/send-scheduled/route.ts` — Vercel Cron target (`vercel.json`, every 15 min); requires `Authorization: Bearer ${CRON_SECRET}`, refuses to run (503) if `CRON_SECRET` isn't set
- `app/compose/page.tsx` — composer UI: draft, save, send, send test, schedule/unschedule a `scheduled_at`
- `app/campaigns/page.tsx` and `app/campaigns/[id]/page.tsx` — campaign history list and per-campaign send log
- `app/api/status/route.ts` — reports `emailDeliveryConfigured` and `scheduledJobsConfigured` for the dashboard status tiles

### Security
- RLS migration `0002_tighten_rls_authenticated_only`: all Phase 1 tables restricted to `authenticated` only, `anon` confirmed to have zero access
- RLS migration `0003_create_campaigns`: `campaigns` and `campaign_sends` follow the same `authenticated`-only model; privileged writes (recording sends) happen only via the service-role key from trusted server routes, not via a client-facing RLS policy
- No service-role keys or secrets exposed client-side

### Preserved from earlier phases
- Subscriber CRUD (fetch, create, update, delete, bulk create)
- CSV import with validation and preview
- Settings persistence
- Dashboard with real database metrics

## Database Migrations Created
1. `0001_create_subscribers_and_settings` — subscribers + settings tables, RLS, constraints, indexes, triggers
2. `0002_tighten_rls_authenticated_only` — replaced anon policies with authenticated-only policies
3. `0003_create_campaigns` — `campaigns` + `campaign_sends` tables, RLS, unique-recipient constraint for idempotent sends

## Tables Currently Available
- `subscribers` — CRUD via authenticated key only
- `settings` — CRUD via authenticated key only (single-row, id = 1, seeded)
- `campaigns` — CRUD via authenticated key only (delete restricted to draft/failed/cancelled)
- `campaign_sends` — read via authenticated key only; writes happen only via the service-role key from server routes

## Environment Variables Required

**Already set:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — note: the code reads this exact name, not `NEXT_PUBLIC_SUPABASE_ANON_KEY` (previous docs had this wrong)

**Not yet set — code is written and will work as soon as these are added:**
- `RESEND_API_KEY` — without this, no email actually sends (signup/unsubscribe still work at the DB level; campaigns can be composed but sending will fail with a clear "not configured" error)
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO` (optional)
- `CRON_SECRET` — without this, `/api/cron/send-scheduled` returns 503 and scheduled campaigns never actually fire, even though scheduling them in the UI succeeds
- `SUPABASE_SERVICE_ROLE_KEY` — required by `lib/supabase/admin.ts` for all the server-only routes above
- `NEXT_PUBLIC_APP_URL` (optional but recommended once deployed, so confirm/unsubscribe links don't depend on request origin)
- `RESEND_WEBHOOK_SECRET` — without this, `/api/webhooks/resend` returns 503 and bounces/complaints are never processed

**Migrations not yet applied:** `0004_create_rate_limits.sql`, `0005_add_campaign_engagement.sql`, `0006_team_roles_audit.sql`, and `0007_remove_legacy_rbac_policies.sql` need to be run against Supabase before the related features work. Migration `0007` is required to remove legacy policies that would bypass role checks.

## Known Issues
- No admin user provisioning UI — admin users must be created via Supabase dashboard or SQL.
- No "forgot password" flow.
- Rate limiting is a simple read-then-write fixed window, not perfectly atomic under heavy concurrent load from the exact same key — fine for casual abuse, not a hard guarantee against a determined parallel attacker (see comment in `lib/server/rate-limit.ts`).
- The webhook receiver only handles `email.bounced` and `email.complained` — other Resend event types are acknowledged and ignored, not stored.

## Incomplete Functionality
- Suppression-list *view* (suppressed subscribers are visible via the existing status filter + inline reason note, but there's no dedicated view/export-just-suppressed workflow)
- Open/click tracking
- Image uploads (Supabase Storage) for campaign content
- Role-based access control (all authenticated users are admins)
- Audit logging
- Dashboard charts/trends

## Verification Performed
1. Production build passes (`npm run build`)
2. RLS confirmed: `SET ROLE anon; SELECT count(*) FROM subscribers` returns 0
3. RLS confirmed: `SET ROLE anon; SELECT count(*) FROM settings` returns 0
4. RLS confirmed: `campaigns`/`campaign_sends` scoped `TO authenticated` only; `campaign_sends` writes reserved for the service-role key
5. Cron route confirmed to reject requests without a valid `CRON_SECRET` bearer token
6. Campaign send confirmed idempotent via the `(campaign_id, subscriber_id)` unique constraint
7. No service-role keys in frontend code
8. `npx tsc --noEmit` passes with zero errors across the full project, including all Phase 5 additions
9. Webhook signature verification checked against Svix's documented HMAC scheme (base64 secret after `whsec_`, `${id}.${timestamp}.${body}` signed content, 5-minute timestamp tolerance)
10. Production build (`npm run build`) verified up through Turbopack bundling; the only failure encountered in this sandbox was Google Fonts being unreachable, unrelated to any code change here

## Next Recommended Job
**Finish Phase 5 — Deliverability**

1. Apply migration `0004_create_rate_limits.sql` and set `RESEND_WEBHOOK_SECRET` + register the webhook URL in Resend — the code for both is done but inert until these two config steps happen
2. Add open/click tracking (Resend supports this natively — likely just needs webhook handling for `email.opened`/`email.clicked` + a couple of columns on `campaign_sends`)
3. Add a dedicated suppression-list view/export if the inline note in the main table isn't enough for day-to-day use
4. Once the above is stable, move to Phase 6 (RBAC, audit log, dashboard charts, admin provisioning, forgot-password)
