# Production activation

The application code is ready, but production activation requires access to Supabase, Resend, and Vercel. Do not commit secret values.

## Supabase

Run migrations `0001` through `0006` in order in the Supabase SQL editor or with the Supabase CLI. Migration `0006` seeds existing users as admins; review `team_members` afterward and reduce access where needed.

## Vercel environment variables

Set these for Production (and Preview if needed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO` (optional)
- `CRON_SECRET`
- `RESEND_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Redeploy after saving the variables. Use `/api/status` while authenticated to confirm delivery and cron configuration.

## Resend webhook

Create a webhook pointing to `https://YOUR_APP_DOMAIN/api/webhooks/resend`. Subscribe to `email.bounced`, `email.complained`, `email.opened`, and `email.clicked`. Copy the generated signing secret into `RESEND_WEBHOOK_SECRET`, then redeploy.

## Auth recovery

In Supabase Auth URL Configuration, add `https://YOUR_APP_DOMAIN/reset-password` to the allowed redirect URLs. The login page sends recovery links to that path.