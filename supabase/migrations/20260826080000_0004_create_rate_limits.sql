/*
# Phase 5: Rate limiting

## Purpose
Adds a `rate_limits` table backing a simple fixed-window rate limiter for
public, unauthenticated endpoints — currently `/api/subscribe`, which had
no protection against being spammed to create `pending` subscribers.

## New Table

### rate_limits
| Column | Type | Description |
|--------|------|--------------|
| key | TEXT PK | Identifies what's being limited, e.g. `subscribe:<ip>` |
| count | INTEGER | Requests seen in the current window |
| window_start | TIMESTAMPTZ | When the current window began |

## Security (RLS)
RLS is enabled with no policies for `anon` or `authenticated` — this table
is only ever read/written by server-side code using the service-role key
(`lib/server/rate-limit.ts`), so no client role should ever touch it
directly.
*/

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated on purpose: this table is only ever
-- touched by server code using the service-role key, which bypasses RLS.
