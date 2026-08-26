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

## Phase 3 — Public Signup & Double Opt-In
- Public subscribe form with real database insert (via SECURITY DEFINER function or token-scoped access)
- Confirmation email with token
- Confirm endpoint to activate subscriber
- Unsubscribe with token verification
- SECURITY DEFINER function for anon-safe public writes

## Phase 4 — Campaigns & Resend
- Campaign composition (rich email editor)
- Image uploads (Supabase Storage)
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
- Role-based access control
