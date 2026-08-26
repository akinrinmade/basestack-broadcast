# Basestack Broadcast

An internal one-way email broadcast system for Basestack Academy.

Administrators manage subscribers and send broadcast emails. The system is being built incrementally in engineering phases.

## Current Phase

**Phase 1 — Foundation** (COMPLETE)

- Subscriber CRUD against Supabase
- CSV import with validation and preview
- Settings persistence
- Dashboard with real database metrics
- Supabase integration with RLS

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn (base-nova style)
- **UI Components:** @base-ui/react, lucide-react
- **Database:** Supabase (PostgreSQL)
- **Package Manager:** npm

## Getting Started

The dev server runs automatically. Dependencies are already installed.

## Project Structure

```
app/
  page.tsx                  — Dashboard (real metrics)
  subscribers/page.tsx      — Subscriber management (CRUD, search, filter, CSV import)
  compose/page.tsx          — Compose UI shell (future phase)
  campaigns/page.tsx        — Campaign history shell (future phase)
  settings/page.tsx         — Settings (real persistence)
  login/page.tsx            — Login shell (future phase)
  subscribe/                — Public subscribe pages
  unsubscribe/               — Public unsubscribe page
components/
  admin-shell.tsx           — Admin layout shell (sidebar, topbar)
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
