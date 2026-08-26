import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildCampaignHtml, getDefaultFromAddress, sendEmail } from '@/lib/resend'
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limit'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// This is a public, unauthenticated endpoint — cap it per-IP so it can't be
// used to spam-create pending subscribers or flood confirmation emails.
const SUBSCRIBE_RATE_LIMIT_MAX = 5
const SUBSCRIBE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit(
    `subscribe:${ip}`,
    SUBSCRIBE_RATE_LIMIT_MAX,
    SUBSCRIBE_RATE_LIMIT_WINDOW_MS,
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? 60) } },
    )
  }

  let body: { name?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const name = body.name?.trim() || null

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: settings } = await admin
    .from('settings')
    .select('confirmation_subject, confirmation_html, mailing_address, email_theme')
    .eq('id', 1)
    .maybeSingle()

  // Reuse an existing row (including one that previously unsubscribed) rather
  // than erroring, so re-subscribing "just works" from the visitor's side.
  const { data: existing } = await admin
    .from('subscribers')
    .select('id, status, confirm_token, unsubscribe_token')
    .eq('email', email)
    .maybeSingle()

  let confirmToken = existing?.confirm_token
  let unsubscribeToken = existing?.unsubscribe_token

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ ok: true, alreadyActive: true })
    }
    const { error } = await admin
      .from('subscribers')
      .update({ status: 'pending', name: name ?? undefined, source: 'public_signup' })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: 'Could not update your subscription.' }, { status: 500 })
  } else {
    const { data: inserted, error } = await admin
      .from('subscribers')
      .insert({ email, name, status: 'pending', source: 'public_signup', signup_ip: ip })
      .select('confirm_token, unsubscribe_token')
      .single()
    if (error) return NextResponse.json({ error: 'Could not create your subscription.' }, { status: 500 })
    confirmToken = inserted.confirm_token
    unsubscribeToken = inserted.unsubscribe_token
  }

  // Best-effort confirmation email — if Resend isn't configured yet, the
  // subscriber still lands as "pending" and can be confirmed manually later.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && confirmToken) {
    const appUrl = getAppUrl(request)
    const confirmUrl = `${appUrl}/subscribe/confirm?token=${confirmToken}`
    const confirmationBody = (settings?.confirmation_html || '<h2>Confirm your subscription</h2><p>Click below to join Basestack Academy for practical technology lessons, resources, and updates.</p><p><a href="{{confirm_url}}">Confirm subscription</a></p><p>If you did not request this, you can ignore this email.</p>')
      .replace(/\{\{\s*confirm_url\s*\}\}/gi, confirmUrl)
    const html = buildCampaignHtml({
      bodyHtml: confirmationBody,
      unsubscribeUrl: `${appUrl}/unsubscribe?token=${unsubscribeToken ?? ''}`,
      mailingAddress: settings?.mailing_address,
      theme: settings?.email_theme,
    })

    await sendEmail({
      to: email,
      subject: settings?.confirmation_subject || 'Confirm your Basestack Academy subscription',
      html,
      from: getDefaultFromAddress('Basestack Academy'),
    })
  }

  return NextResponse.json({ ok: true })
}
