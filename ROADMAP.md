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

## Phase 2 — Authentication
- Supabase email/password auth
- Login/signup UI
- Protected admin routes
- Tighten RLS to `TO authenticated` with admin role checks
- Session management

## Phase 3 — Public Signup & Double Opt-In
- Public subscribe form with real database insert
- Confirmation email with token
- Confirm endpoint to activate subscriber
- Unsubscribe with token verification

## Phase 4 — Campaigns & Resend
- Campaign composition (rich email editor)
- Image uploads
- Resend API integration (server-side via edge function)
- Campaign scheduling
- Per-recipient send logs
- Batching

## Phase 5 — Deliverability
- Bounce/complaint webhook handling
- Suppression list management
- Delivery metrics
- Open/click tracking

## Phase 6 — Polish
- Dashboard charts and trends
- Subscriber import/export
- Audit logging
- Team management
