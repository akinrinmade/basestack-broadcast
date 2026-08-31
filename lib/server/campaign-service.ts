import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildCampaignHtml, getDefaultFromAddress, getDefaultReplyTo, sendEmail, sendEmailBatch } from '@/lib/resend'
import type { Campaign, RecipientFilter } from '@/lib/types'

export interface EligibleSubscriber {
  id: string
  email: string
  name: string | null
  unsubscribe_token: string
}

/**
 * Thrown by claimCampaignForSending() when another request has already
 * claimed this campaign. Callers must NOT mark the campaign 'failed' when
 * they catch this — doing so would stomp on whatever the winning process
 * is doing (or has already done).
 */
export class CampaignAlreadyClaimedError extends Error {
  constructor() {
    super('This campaign is already being sent (or was already sent) by another request.')
    this.name = 'CampaignAlreadyClaimedError'
  }
}

/**
 * Atomically moves a campaign from a sendable status (draft, scheduled,
 * failed) to 'sending' via a conditional UPDATE ... WHERE status IN (...).
 *
 * This is the actual double-send guard. The `campaign_sends` unique
 * constraint (campaign_id, subscriber_id) only protects *sequential*
 * retries — it does nothing to stop two requests that are mid-flight at
 * the same instant (e.g. an overlapping/retried cron invocation, or cron
 * firing at the same moment someone clicks "Send" manually) from both
 * reading "no existing sends yet" and both calling Resend for the same
 * recipient. A conditional UPDATE is atomic at the database level, so
 * only one caller can ever win the row; the loser gets
 * CampaignAlreadyClaimedError before it sends a single email.
 */
async function claimCampaignForSending(
  admin: ReturnType<typeof getSupabaseAdmin>,
  campaignId: string,
): Promise<void> {
  const { data, error } = await admin
    .from('campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)
    .in('status', ['draft', 'scheduled', 'failed'])
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new CampaignAlreadyClaimedError()
}

function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

/** Loads active, eligible subscribers for a campaign's recipient filter. Never includes unsubscribed/suppressed/pending. */
export async function getEligibleRecipients(filter: RecipientFilter): Promise<EligibleSubscriber[]> {
  const admin = getSupabaseAdmin()

  let query = admin
    .from('subscribers')
    .select('id, email, name, unsubscribe_token')
    .eq('status', 'active')

  if (filter.mode === 'selected') {
    const ids = filter.subscriber_ids ?? []
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as EligibleSubscriber[]
}

/**
 * Campaigns whose html_content is already a complete, self-designed
 * document (starts with <!doctype ...> or <html ...>) are sent as-is
 * instead of being wrapped by buildCampaignHtml(). Wrapping a full
 * document would nest <html> inside <html>, strip the author's own
 * <head>/<style> block, and double up the compliance footer with the
 * standard theme's auto-appended one. These documents are expected to
 * embed {{unsubscribe_url}} (and optionally {{mailing_address}}) tokens
 * wherever they need a live link, same as {{name}}.
 */
const FULL_DOCUMENT_RE = /^\s*<\s*(!doctype|html)\b/i

export function renderCampaignEmail(
  campaign: Pick<Campaign, 'html_content'>,
  recipient: { name: string | null; unsubscribe_token: string },
  request: Request,
  mailingAddress?: string | null,
): string {
  const appUrl = getAppUrl(request)
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${recipient.unsubscribe_token}`
  const bodyHtml = campaign.html_content
    .replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'there')
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubscribeUrl)
    .replace(/\{\{\s*mailing_address\s*\}\}/gi, mailingAddress || '')

  if (FULL_DOCUMENT_RE.test(campaign.html_content)) {
    return bodyHtml
  }

  return buildCampaignHtml({ bodyHtml, unsubscribeUrl, mailingAddress })
}

export function resolveFromAddress(campaign: Pick<Campaign, 'sender_name' | 'sender_email'>): string {
  if (campaign.sender_email) {
    return campaign.sender_name
      ? `${campaign.sender_name} <${campaign.sender_email}>`
      : campaign.sender_email
  }
  return getDefaultFromAddress(campaign.sender_name)
}

export interface SendCampaignResult {
  recipientCount: number
  sentCount: number
  failedCount: number
  status: 'sent' | 'failed'
}

/**
 * Sends a campaign to every eligible recipient who hasn't already received
 * it (checked via the campaign_sends unique constraint), records each
 * outcome, and updates the campaign's aggregate counters + status.
 * Safe to call again on a campaign stuck in "sending" or "failed" — it
 * only (re)sends to recipients without a prior successful row.
 */
export async function sendCampaignToRecipients(
  campaign: Campaign,
  request: Request,
): Promise<SendCampaignResult> {
  const admin = getSupabaseAdmin()

  // Claim the campaign first, before touching recipients or Resend at all —
  // see claimCampaignForSending() for why this is what actually makes
  // concurrent sends safe.
  await claimCampaignForSending(admin, campaign.id)

  const [{ data: settings }, recipients] = await Promise.all([
    admin.from('settings').select('mailing_address').eq('id', 1).maybeSingle(),
    getEligibleRecipients(campaign.recipient_filter),
  ])

  const { data: alreadySent } = await admin
    .from('campaign_sends')
    .select('subscriber_id')
    .eq('campaign_id', campaign.id)
    .eq('status', 'sent')

  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.subscriber_id))
  const toSend = recipients.filter((r) => !alreadySentIds.has(r.id))

  await admin
    .from('campaigns')
    .update({ recipient_count: recipients.length })
    .eq('id', campaign.id)

  const from = resolveFromAddress(campaign)

  const emailInputs = toSend.map((recipient) => ({
    to: recipient.email,
    subject: campaign.subject,
    html: renderCampaignEmail(campaign, recipient, request, settings?.mailing_address),
    from,
    replyTo: campaign.reply_to || getDefaultReplyTo(),
  }))

  const results = toSend.length > 0 ? await sendEmailBatch(emailInputs) : []

  const sendRows = toSend.map((recipient, i) => ({
    campaign_id: campaign.id,
    subscriber_id: recipient.id,
    email: recipient.email,
    status: results[i]?.ok ? 'sent' : 'failed',
    error: results[i]?.ok ? null : results[i]?.error ?? 'Unknown error',
    resend_id: results[i]?.id ?? null,
  }))

  if (sendRows.length > 0) {
    // Upsert so a retry overwrites a prior failed row for the same recipient.
    const { error: insertError } = await admin
      .from('campaign_sends')
      .upsert(sendRows, { onConflict: 'campaign_id,subscriber_id' })
    if (insertError) console.error('[campaign-service] failed to record sends', insertError)
  }

  const newSentCount = alreadySentIds.size + results.filter((r) => r.ok).length
  const newFailedCount = results.filter((r) => !r.ok).length
  const finalStatus: 'sent' | 'failed' = newFailedCount === 0 ? 'sent' : newSentCount > 0 ? 'sent' : 'failed'

  await admin
    .from('campaigns')
    .update({
      status: finalStatus,
      recipient_count: recipients.length,
      sent_count: newSentCount,
      failed_count: newFailedCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  return {
    recipientCount: recipients.length,
    sentCount: newSentCount,
    failedCount: newFailedCount,
    status: finalStatus,
  }
}

export async function sendTestEmail(
  campaign: Campaign,
  testEmail: string,
  request: Request,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin()
  const { data: settings } = await admin.from('settings').select('mailing_address').eq('id', 1).maybeSingle()

  const from = resolveFromAddress(campaign)
  const html = renderCampaignEmail(
    campaign,
    { name: 'there', unsubscribe_token: 'test-preview' },
    request,
    settings?.mailing_address,
  )

  const result = await sendEmail({
    to: testEmail,
    subject: `[TEST] ${campaign.subject}`,
    html,
    from,
    replyTo: campaign.reply_to || getDefaultReplyTo(),
  })

  return { ok: result.ok, error: result.error }
}
