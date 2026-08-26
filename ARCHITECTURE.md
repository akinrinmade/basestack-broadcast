# Architecture

## Overview

Basestack Broadcast is a Next.js App Router application with Supabase as the backend for database, authentication, and (future) edge functions.

## Frontend

- **Next.js 16** with App Router — all pages are client components (`'use client'`) because they interact with Supabase directly.
- **Auth Provider** (`components/auth-provider.tsx`) — React context that wraps the entire app, providing `user`, `session`, `loading`, `signIn`, and `signOut` via the `useAuth()` hook. Uses `supabase.auth.getSession()` for initial load and `onAuthStateChange` for session updates.
- **Protected Route** (`components/protected-route.tsx`) — Wrapper component that checks auth state and redirects to `/login` if unauthenticated. Shows a loading spinner while auth state resolves.
- **Admin Shell** (`components/admin-shell.tsx`) — Shared layout with sidebar navigation, topbar, real user display, and logout button. Used by all admin routes.
- **Public Pages** (`components/public-pages.tsx`) — Standalone components for subscribe/unsubscribe/confirmed flows, separate from the admin shell.

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

- **Supabase** provides PostgreSQL database, auth, and edge functions.
- **Client Singleton** (`lib/supabase/client.ts`) — single Supabase client instance using the anon key. Safe for client-side use.
- **Query Layer** (`lib/subscribers.ts`, `lib/settings.ts`) — data access functions that wrap Supabase queries. Components call these rather than using the client directly.

## Database Schema (Phase 1 + 2)

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
| suppression_reason | TEXT | Nullable |
| bounce_count | INTEGER | Default 0 |
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

## Security (RLS)

Both tables have RLS enabled with `TO authenticated` policies only. The `anon` role has zero access — confirmed via direct SQL test (anon SELECT returns 0 rows on both tables).

Phase 2 policies:
- `subscribers`: SELECT, INSERT, UPDATE, DELETE for `authenticated` only
- `settings`: SELECT, INSERT, UPDATE, DELETE for `authenticated` only

Any authenticated user is treated as an admin (no role differentiation yet). Phase 3+ may add role-based access.

## Data Flow

```
Component → useAuth() for session → lib/subscribers.ts → lib/supabase/client.ts → Supabase
```

Components never call `supabase.from()` directly — they use the query layer functions. Auth state is accessed via `useAuth()` hook from the auth provider context.

## CSV Import Flow

1. User selects a CSV file
2. `parseCsv()` extracts name/email rows (handles headers, quoted fields)
3. `validateCsv()` checks: email format, missing name/email, duplicates within CSV, duplicates against database
4. Preview shows valid/invalid rows with reasons
5. User confirms → `bulkCreateSubscribers()` inserts valid rows as `active` with source `csv_import`
