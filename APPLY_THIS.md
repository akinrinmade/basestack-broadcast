# How to apply this

This zip contains only the files that are **new or changed** for Phase 5
(rate limiting, bounce/complaint webhook, CSV export) — same relative
paths as the repo, so you can drop them straight in and overwrite.

## New files
- `app/api/webhooks/resend/route.ts`
- `lib/server/rate-limit.ts`
- `lib/server/resend-webhook.ts`
- `supabase/migrations/20260826080000_0004_create_rate_limits.sql`

## Modified files (overwrite the existing ones)
- `app/api/subscribe/route.ts` — now rate-limited, also records `signup_ip`
- `app/subscribers/page.tsx` — adds "Export CSV" button, shows suppression reason/bounce count
- `lib/csv.ts` — adds `exportSubscribersToCsv()`
- `PROJECT.md`, `ROADMAP.md`, `HANDOFF.md`, `ARCHITECTURE.md`, `CHANGELOG.md` — updated to reflect all of the above, plus everything from the earlier Phase 3/4 doc sync

## Steps after uploading to GitHub

1. **Apply the new migration** against your Supabase project (via the Supabase CLI, `supabase db push`, or pasting the SQL into the SQL editor):
   `supabase/migrations/20260826080000_0004_create_rate_limits.sql`
2. **Set `RESEND_WEBHOOK_SECRET`** in your environment (Vercel project settings, or `.env` locally).
3. **Register the webhook** in the Resend dashboard: add an endpoint pointing at
   `https://<your-app-domain>/api/webhooks/resend`, select the `email.bounced` and
   `email.complained` events, and copy the signing secret it gives you into
   `RESEND_WEBHOOK_SECRET` from step 2.
4. Double-check your Supabase anon-key env var is named `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (not `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the docs had this wrong before this update; the
   code has always read the `PUBLISHABLE_KEY` name).

Everything else (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_APP_URL`) is unchanged from before — see `PROJECT.md` for the full list.

Verified before packaging: `npx tsc --noEmit` passes with zero errors across the whole project.
