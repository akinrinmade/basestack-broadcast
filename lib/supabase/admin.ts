import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 *
 * NEVER import this file from a Client Component or any code that ships
 * to the browser — the `server-only` import above makes Next.js throw a
 * build error if that happens by mistake.
 *
 * Used by API routes that need to:
 *  - bypass RLS for trusted, already-authenticated operations
 *    (recording campaign sends, updating campaign stats)
 *  - perform public actions that RLS intentionally blocks for the
 *    `anon` role (public subscribe, confirm, unsubscribe by token)
 */
let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client is not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
