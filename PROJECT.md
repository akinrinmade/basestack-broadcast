# Basestack Broadcast

An internal one-way email broadcast system for Basestack Academy.

Administrators manage subscribers and send broadcast emails. The system is being built incrementally in engineering phases.

## Current Phase

**Phase 2 — Authentication + Security** (COMPLETE)

- Supabase email/password authentication
- Protected admin routes (redirect to `/login` when unauthenticated)
- Logout functionality
- Session persistence across browser refresh
- RLS tightened to `authenticated`-only (anon has zero database access)
- All Phase 1 CRUD/settings/CSV import functionality preserved

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn (base-nova style)
- **UI Components:** @base-ui/react, lucide-react
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Package Manager:** npm

## Getting Started

The dev server runs automatically. Dependencies are already installed.

## Project Structure

```
app/
  page.tsx                  — Dashboard (real metrics, protected)
  subscribers/page.tsx      — Subscriber management (CRUD, search, filter, CSV import, protected)
  compose/page.tsx          — Compose UI shell (future phase, protected)
  campaigns/page.tsx        — Campaign history shell (future phase, protected)
  settings/page.tsx         — Settings (real persistence, protected)
  login/page.tsx            — Login page (email/password auth)
  subscribe/                — Public subscribe pages
  unsubscribe/               — Public unsubscribe page
components/
  auth-provider.tsx         — Supabase auth context provider
  protected-route.tsx       — Route guard (redirects to /login if unauthenticated)
  admin-shell.tsx           — Admin layout shell (sidebar, topbar, logout)
  public-pages.tsx          — Public-facing subscribe/unsubscribe/confirmed components
  ui/
    button.tsx              — Button component (base-ui)
    badge.tsx               — Badge component
lib/
  types.ts                  — Shared TypeScript types
  supabase/client.ts        — Supabase client singleton
  subscribers.ts            — Subscriber query functions
  settings.ts               — Settings query functions
  csv.ts                    — CSV parsing and validation
  utils.ts                  — Utility functions (cn)
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public, client-safe)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public, client-safe)

No server-side secrets are stored in the database or frontend code.

## Authentication

- Admin signs in at `/login` with email and password via Supabase Auth.
- Session is stored in cookies and persists across browser refresh.
- All admin routes (`/`, `/subscribers`, `/compose`, `/campaigns`, `/settings`) are protected.
- Public routes (`/subscribe`, `/subscribe/confirmed`, `/unsubscribe`) remain accessible without auth.
- Logout button in the sidebar clears the session and redirects to `/login`.
