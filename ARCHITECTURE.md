# Architecture

## Overview

Basestack Broadcast is a Next.js App Router application with Supabase as the backend.

## Frontend

- **Next.js 16** with App Router — all pages are client components (`'use client'`) because they interact with Supabase directly.
- **Admin Shell** (`components/admin-shell.tsx`) — shared layout with sidebar navigation and topbar. Used by all admin routes.
- **Public Pages** (`components/public-pages.tsx`) — standalone components for subscribe/unsubscribe/confirmed flows, separate from the admin shell.

## Backend

- **Supabase** provides PostgreSQL database, auth, and edge functions.
- **Client Singleton** (`lib/supabase/client.ts`) — single Supabase client instance using the anon key. Safe for client-side use.
- **Query Layer** (`lib/subscribers.ts`, `lib/settings.ts`) — data access functions that wrap Supabase queries. Components call these rather than using the client directly.

## Database Schema (Phase 1)

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

Both tables have RLS enabled. Phase 1 uses `TO anon, authenticated` policies because authentication is not yet implemented. Phase 2 will tighten these to `TO authenticated` with admin role checks.

## Data Flow

```
Component → lib/subscribers.ts (or lib/settings.ts) → lib/supabase/client.ts → Supabase
```

Components never call `supabase.from()` directly — they use the query layer functions.

## CSV Import Flow

1. User selects a CSV file
2. `parseCsv()` extracts name/email rows (handles headers, quoted fields)
3. `validateCsv()` checks:
   - Email format
   - Missing name/email
   - Duplicate emails within the CSV
   - Duplicate emails against the database
4. Preview shows valid/invalid rows with reasons
5. User confirms → `bulkCreateSubscribers()` inserts valid rows as `active` with source `csv_import`
