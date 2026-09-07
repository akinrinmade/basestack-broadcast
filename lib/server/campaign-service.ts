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
async function claimCampaignForSending(admin: ReturnType<typeof getSupabaseAdmin>, campaignId: string) {
  const { data, error } = await admin.from('campaigns').update({ status: 'sending' }).eq('id', campaignId).in('status', ['ready', 'scheduled']).select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new CampaignAlreadyClaimedError()
}

function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function getEligibleRecipients(filter: RecipientFilter): Promise<EligibleSubscriber[]> {
  const admin = getSupabaseAdmin()
  let query = admin.from('subscribers').select('id, email, name, unsubscribe_token').eq('status', 'active')
  if (filter.mode === 'selected') {
    const ids = filter.subscriber_ids ?? []
    if (!ids.length) return []
    query = query.in('id', ids)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as EligibleSubscriber[]
}

const FULL_DOCUMENT_RE = /^\s*<\s*(!doctype|html)\b/i

export function renderCampaignEmail(campaign: Pick<Campaign, 'html_content'>, recipient: { name: string | null; unsubscribe_token: string }, request: Request, mailingAddress?: string | null): string {
  const unsubscribeUrl = `${getAppUrl(request)}/unsubscribe?token=${recipient.unsubscribe_token}`
  const bodyHtml = campaign.html_content
    .replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'there')
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubscribeUrl)
    .replace(/\{\{\s*mailing_address\s*\}\}/gi, mailingAddress || '')
  return FULL_DOCUMENT_RE.test(campaign.html_content) ? bodyHtml : buildCampaignHtml({ bodyHtml, unsubscribeUrl, mailingAddress })
}

export function resolveFromAddress(campaign: Pick<Campaign, 'sender_name' | 'sender_email'>): string {
  if (campaign.sender_email) return campaign.sender_name ? `${campaign.sender_name} <${campaign.sender_email}>` : campaign.sender_email
  return getDefaultFromAddress(campaign.sender_name)
}

export async function snapshotCampaignRecipients(campaign: Campaign): Promise<number> {
  const admin = getSupabaseAdmin()
  const { count } = await admin.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id)
  if ((count ?? 0) > 0) return count ?? 0
  const recipients = await getEligibleRecipients(campaign.recipient_filter)
  if (!recipients.length) return 0
  const rows = recipients.map(r => ({ campaign_id: campaign.id, subscriber_id: r.id, email: r.email, name: r.name, unsubscribe_token: r.unsubscribe_token }))
  const { error } = await admin.from('campaign_recipients').insert(rows)
  if (error) throw new Error(error.message)
  await admin.from('campaigns').update({ recipient_count: recipients.length, sent_count: 0, failed_count: 0 }).eq('id', campaign.id)
  return recipients.length
}

export async function markCampaignReady(campaign: Campaign): Promise<number> {
  const count = await snapshotCampaignRecipients(campaign)
  if (!count) throw new Error('No eligible active subscribers match this campaign.')
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('campaigns').update({ status: 'ready', recipient_count: count, scheduled_at: null }).eq('id', campaign.id).in('status', ['draft', 'failed'])
  if (error) throw new Error(error.message)
  return count
}

export interface SendCampaignResult { recipientCount: number; sentCount: number; failedCount: number; pendingCount: number; status: 'ready' | 'completed' | 'failed' }

export async function getCampaignProgress(campaignId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.from('campaign_recipients').select('status').eq('campaign_id', campaignId)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const sentCount = rows.filter(r => r.status === 'sent').length
  const failedCount = rows.filter(r => r.status === 'failed').length
  const pendingCount = rows.filter(r => r.status === 'pending').length
  return { recipientCount: rows.length, sentCount, failedCount, pendingCount, percent: rows.length ? Math.round(sentCount / rows.length * 100) : 0 }
}

export async function sendNextCampaignBatch(campaign: Campaign, request: Request): Promise<SendCampaignResult> {
  const admin = getSupabaseAdmin()
  await snapshotCampaignRecipients(campaign)
  await claimCampaignForSending(admin, campaign.id)
  const batchSize = Math.max(1, Math.min(100, campaign.batch_size || 100))
  const { data: roster, error: rosterError } = await admin.from('campaign_recipients').select('*').eq('campaign_id', campaign.id).in('status', ['pending','failed']).order('created_at').limit(batchSize)
  if (rosterError) throw new Error(rosterError.message)
  const batch = roster ?? []
  if (!batch.length) {
    await admin.from('campaigns').update({ status: 'completed', sent_at: new Date().toISOString() }).eq('id', campaign.id)
    const p = await getCampaignProgress(campaign.id)
    return { recipientCount: p.recipientCount, sentCount: p.sentCount, failedCount: p.failedCount, pendingCount: p.pendingCount, status: 'completed' }
  }
  const [{ data: settings }] = await Promise.all([admin.from('settings').select('mailing_address').eq('id', 1).maybeSingle()])
  const from = resolveFromAddress(campaign)
  const results = await sendEmailBatch(batch.map(r => ({ to: r.email, subject: campaign.subject, html: renderCampaignEmail(campaign, { name: r.name, unsubscribe_token: r.unsubscribe_token ?? '' }, request, settings?.mailing_address), from, replyTo: campaign.reply_to || getDefaultReplyTo() })))
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i], result = results[i]
    const status = result?.ok ? 'sent' : 'failed'
    await admin.from('campaign_recipients').update({ status, attempts: (r.attempts ?? 0) + 1, error: result?.ok ? null : result?.error ?? 'Unknown error', sent_at: result?.ok ? new Date().toISOString() : null }).eq('id', r.id)
    await admin.from('campaign_sends').upsert({ campaign_id: campaign.id, subscriber_id: r.subscriber_id, email: r.email, status, error: result?.ok ? null : result?.error ?? 'Unknown error', resend_id: result?.id ?? null }, { onConflict: 'campaign_id,subscriber_id' })
  }
  const p = await getCampaignProgress(campaign.id)
  const finalStatus = p.pendingCount === 0 ? 'completed' : 'ready'
  await admin.from('campaigns').update({ status: finalStatus, recipient_count: p.recipientCount, sent_count: p.sentCount, failed_count: p.failedCount, sent_at: finalStatus === 'completed' ? new Date().toISOString() : null }).eq('id', campaign.id)
  return { ...p, status: finalStatus }
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
