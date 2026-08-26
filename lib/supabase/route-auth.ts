import 'server-only'
import { createClient, type User } from '@supabase/supabase-js'

/**
 * Verifies the caller's Supabase session from the `Authorization: Bearer <token>`
 * header sent by the browser client. Uses the anon/publishable key (not the
 * service role key) so this only ever confirms "who is this token for" —
 * it does not grant elevated access by itself.
 *
 * Returns the authenticated user, or null if the request has no valid session.
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) return null

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
