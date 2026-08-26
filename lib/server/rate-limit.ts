import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface RateLimitResult {
  allowed: boolean
  /** Present when allowed is false — how long the caller should wait before retrying. */
  retryAfterSeconds?: number
}

/**
 * Simple fixed-window rate limiter backed by Postgres (see migration
 * 0004_create_rate_limits). Not perfectly atomic under heavy concurrent
 * load from the exact same key (there's a read-then-write gap), but that's
 * an acceptable tradeoff here: the goal is to blunt casual abuse/spam on a
 * public endpoint, not to provide hard guarantees against a determined,
 * parallelized attacker. If this ever needs to be airtight, replace the
 * body with a single atomic SQL UPSERT ... ON CONFLICT DO UPDATE RPC.
 *
 * @param key Unique identifier for what's being limited, e.g. `subscribe:203.0.113.4`.
 * @param max Maximum requests allowed within the window. Default 5.
 * @param windowMs Window length in milliseconds. Default 15 minutes.
 */
export async function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60 * 1000,
): Promise<RateLimitResult> {
  const admin = getSupabaseAdmin()
  const now = new Date()

  const { data: existing } = await admin
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle()

  if (!existing) {
    await admin
      .from('rate_limits')
      .upsert({ key, count: 1, window_start: now.toISOString() }, { onConflict: 'key' })
    return { allowed: true }
  }

  const windowStart = new Date(existing.window_start)
  const elapsedMs = now.getTime() - windowStart.getTime()

  if (elapsedMs > windowMs) {
    // Window has expired — start a fresh one.
    await admin
      .from('rate_limits')
      .update({ count: 1, window_start: now.toISOString() })
      .eq('key', key)
    return { allowed: true }
  }

  if (existing.count >= max) {
    const retryAfterSeconds = Math.ceil((windowMs - elapsedMs) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  await admin
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key)
  return { allowed: true }
}

/** Best-effort client IP extraction behind Vercel's proxy / a generic reverse proxy. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}
