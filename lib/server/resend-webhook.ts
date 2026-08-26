import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export interface SvixHeaders {
  svixId: string
  svixTimestamp: string
  svixSignature: string
}

/** Reject a webhook whose timestamp is further than this from "now" (replay protection). */
const TOLERANCE_SECONDS = 5 * 60

/**
 * Verifies a Resend webhook signature. Resend signs webhooks the same way
 * Svix does: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`,
 * using the byte secret encoded in the `whsec_...` signing secret from the
 * Resend dashboard. `svix-signature` may contain multiple space-separated
 * `v1,<base64>` values (for secret rotation) — a match on any of them is
 * accepted.
 *
 * `rawBody` MUST be the exact, unparsed request body text — verify before
 * calling JSON.parse.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
): boolean {
  const timestampSeconds = Number(headers.svixTimestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds)
  if (ageSeconds > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  for (const part of headers.svixSignature.split(' ')) {
    const [, value] = part.split(',')
    if (!value) continue
    const candidate = Buffer.from(value)
    if (candidate.length !== expectedBuf.length) continue
    if (timingSafeEqual(candidate, expectedBuf)) return true
  }

  return false
}
