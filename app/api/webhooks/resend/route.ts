import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verifyResendWebhook } from '@/lib/server/resend-webhook'

/**
 * Receives delivery-event webhooks from Resend and auto-suppresses
 * subscribers on hard bounces and spam complaints, so campaigns stop
 * emailing addresses that are actively hurting deliverability.
 *
 * Configure this URL (`/api/webhooks/resend`) in the Resend dashboard's
 * webhook settings, and set RESEND_WEBHOOK_SECRET to the signing secret
 * shown there.
 *
 * We deliberately do NOT suppress on soft/transient bounces (a full inbox,
 * a temporary mail-server issue) — those are expected to resolve and
 * suppressing on them would silently drop real subscribers. Only
 * `email.complained` and hard/permanent bounces flip status to
 * `suppressed`. Every bounce, hard or soft, still increments bounce_count
 * so a pattern is visible even before suppression kicks in.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook not configured: RESEND_WEBHOOK_SECRET is missing on the server.' },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers.' }, { status: 400 })
  }

  const valid = verifyResendWebhook(
    rawBody,
    { svixId, svixTimestamp, svixSignature },
    secret,
  )
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let event: {
    type?: string
    data?: {
      email_id?: string
      to?: string | string[]
      bounce?: { type?: string }
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const type = event.type
  const data = event.data ?? {}

  if (type === 'email.opened' || type === 'email.clicked') {
    if (!data.email_id) {
      return NextResponse.json({ ok: true, ignored: true, note: 'No email id in payload.' })
    }

    const column = type === 'email.opened' ? 'open_count' : 'click_count'
    const timestampColumn = type === 'email.opened' ? 'opened_at' : 'clicked_at'
    const admin = getSupabaseAdmin()
    const { data: send } = await admin
      .from('campaign_sends')
      .select(`id, ${column}`)
      .eq('resend_id', data.email_id)
      .maybeSingle()

    if (!send) {
      return NextResponse.json({ ok: true, ignored: true, note: 'No matching campaign send.' })
    }

    const currentCount = (send as Record<string, unknown>)[column] as number | null | undefined

    const { error } = await admin
      .from('campaign_sends')
      .update({
        [column]: (currentCount ?? 0) + 1,
        [timestampColumn]: new Date().toISOString(),
      })
      .eq('id', send.id)

    if (error) {
      console.error('[webhooks/resend] failed to record engagement', error)
      return NextResponse.json({ error: 'Failed to record event.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, recorded: type })
  }

  // Events we care about; everything else (delivered, ...)
  // is acknowledged and ignored so Resend doesn't retry it as a failure.
  if (type !== 'email.bounced' && type !== 'email.complained') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const recipients = Array.isArray(data.to) ? data.to : data.to ? [data.to] : []
  const email = recipients[0]?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ ok: true, ignored: true, note: 'No recipient email in payload.' })
  }

  const admin = getSupabaseAdmin()
  const { data: subscriber } = await admin
    .from('subscribers')
    .select('id, bounce_count')
    .ilike('email', email)
    .maybeSingle()

  if (!subscriber) {
    return NextResponse.json({ ok: true, ignored: true, note: 'No matching subscriber.' })
  }

  const isSoftBounce = type === 'email.bounced' && data.bounce?.type === 'Transient'
  const reason = type === 'email.complained' ? 'complaint' : isSoftBounce ? 'soft_bounce' : 'hard_bounce'
  const shouldSuppress = !isSoftBounce

  const update: Record<string, unknown> = {
    bounce_count: (subscriber.bounce_count ?? 0) + 1,
  }
  if (shouldSuppress) {
    update.status = 'suppressed'
    update.suppression_reason = reason
  }

  const { error } = await admin.from('subscribers').update(update).eq('id', subscriber.id)
  if (error) {
    console.error('[webhooks/resend] failed to update subscriber', error)
    return NextResponse.json({ error: 'Failed to record event.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, reason, suppressed: shouldSuppress })
}
