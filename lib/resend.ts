import 'server-only'
import { Resend } from 'resend'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  from: string
  replyTo?: string | null
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

let cachedClient: Resend | null = null

/** Throws a clear, user-safe error if Resend is not configured. */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'Email delivery is not configured: RESEND_API_KEY is missing on the server.',
    )
  }
  if (!cachedClient) cachedClient = new Resend(apiKey)
  return cachedClient
}

/** Returns null if configured, or a user-safe message describing what's missing. */
export function checkResendConfig(): string | null {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY is not set.'
  if (!process.env.RESEND_FROM_EMAIL) return 'RESEND_FROM_EMAIL is not set.'
  return null
}

export function getDefaultFromAddress(senderName?: string | null): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('Email delivery is not configured: RESEND_FROM_EMAIL is missing on the server.')
  }
  return senderName ? `${senderName} <${fromEmail}>` : fromEmail
}

/** Falls back to RESEND_REPLY_TO, then undefined (Resend defaults reply-to to the from address). */
export function getDefaultReplyTo(): string | undefined {
  return process.env.RESEND_REPLY_TO || undefined
}

/**
 * Sends a single email through Resend. Never throws for delivery-level
 * failures (invalid recipient, Resend API error) — it returns
 * `{ ok: false, error }` instead, so callers (especially batch campaign
 * sending) can record per-recipient failures without one bad address
 * aborting the whole run. Configuration errors (missing API key) still
 * throw, since those affect every recipient and should stop the run early.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient()

  try {
    const { data, error } = await client.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo ?? undefined,
    })

    if (error) {
      // Log server-side only; never surface Resend internals beyond the message.
      console.error('[resend] send failed', { to: input.to, error })
      return { ok: false, error: error.message || 'Resend rejected this email.' }
    }

    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[resend] send threw', { to: input.to, err })
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown email delivery error.' }
  }
}

/**
 * Sends a batch of emails with bounded concurrency instead of firing every
 * request at once. Resend's JS SDK batch endpoint caps at 100 emails per
 * call, so for larger campaigns we chunk into batches of 100 and run those
 * batches with limited concurrency.
 */
export async function sendEmailBatch(
  inputs: SendEmailInput[],
  concurrency = 5,
): Promise<SendEmailResult[]> {
  const client = getResendClient()
  const BATCH_SIZE = 100
  const chunks: SendEmailInput[][] = []
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    chunks.push(inputs.slice(i, i + BATCH_SIZE))
  }

  const results: SendEmailResult[] = new Array(inputs.length)
  let cursor = 0

  async function worker() {
    while (cursor < chunks.length) {
      const chunkIndex = cursor++
      const chunk = chunks[chunkIndex]
      const offset = chunkIndex * BATCH_SIZE

      try {
        const { data, error } = await client.batch.send(
          chunk.map((item) => ({
            from: item.from,
            to: item.to,
            subject: item.subject,
            html: item.html,
            replyTo: item.replyTo ?? undefined,
          })),
        )

        if (error) {
          console.error('[resend] batch failed', { size: chunk.length, error })
          for (let i = 0; i < chunk.length; i++) {
            results[offset + i] = { ok: false, error: error.message || 'Resend batch rejected.' }
          }
          continue
        }

        const items = data?.data ?? []
        for (let i = 0; i < chunk.length; i++) {
          const item = items[i]
          results[offset + i] = item?.id
            ? { ok: true, id: item.id }
            : { ok: false, error: 'No confirmation returned for this recipient.' }
        }
      } catch (err) {
        console.error('[resend] batch threw', { size: chunk.length, err })
        const message = err instanceof Error ? err.message : 'Unknown email delivery error.'
        for (let i = 0; i < chunk.length; i++) {
          results[offset + i] = { ok: false, error: message }
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, chunks.length) || 1 }, () => worker())
  await Promise.all(workers)

  return results
}

/**
 * Wraps campaign HTML content with a standard footer: mailing address
 * (required for compliance) and a one-click unsubscribe link.
 */
export function buildCampaignHtml(options: {
  bodyHtml: string
  unsubscribeUrl: string
  mailingAddress?: string | null
}): string {
  const { bodyHtml, unsubscribeUrl, mailingAddress } = options
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px;color:#18181b;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.6;">
                ${mailingAddress ? `<p style="margin:0 0 8px;">${mailingAddress}</p>` : ''}
                <p style="margin:0;">
                  <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a> from Basestack Academy broadcasts.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim()
}
