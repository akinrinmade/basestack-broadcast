import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildCampaignHtml, getDefaultFromAddress, sendEmail } from '@/lib/resend'

function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character]
  })
}

export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing confirmation token.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: subscriber, error: loadError } = await admin
    .from('subscribers')
    .select('id, name, email, status, confirmed_at, unsubscribe_token')
    .eq('confirm_token', token)
    .maybeSingle()

  if (loadError || !subscriber) {
    return NextResponse.json({ error: 'This confirmation link is invalid or has expired.' }, { status: 404 })
  }

  if (subscriber.status === 'unsubscribed' || subscriber.status === 'suppressed') {
    return NextResponse.json(
      { error: 'This subscription is no longer active. Please subscribe again.' },
      { status: 409 },
    )
  }

  if (subscriber.status === 'active' || subscriber.confirmed_at) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true })
  }

  const confirmedAt = new Date().toISOString()
  const { data: confirmedSubscriber, error: updateError } = await admin
    .from('subscribers')
    .update({ status: 'active', confirmed_at: confirmedAt })
    .eq('id', subscriber.id)
    .eq('status', 'pending')
    .is('confirmed_at', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: 'Could not confirm your subscription.' }, { status: 500 })
  }
  if (!confirmedSubscriber) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true })
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const appUrl = getAppUrl(request)
    const recipientName = escapeHtml(subscriber.name || 'there')
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${subscriber.unsubscribe_token}`
    const html = buildCampaignHtml({
      bodyHtml: `
        <h2 style="margin:0 0 16px;">Welcome to Basestack Academy</h2>
        <p style="margin:0 0 16px;">Hi ${recipientName},</p>
        <p style="margin:0 0 20px;">Thanks for confirming your subscription. You are now on the list for updates, news, and useful resources from Basestack Academy.</p>
        <p style="margin:0;">We are glad to have you here.</p>
      `,
      unsubscribeUrl,
    })

    try {
      const result = await sendEmail({
        to: subscriber.email,
        subject: 'Welcome to Basestack Academy',
        html,
        from: getDefaultFromAddress('Basestack Academy'),
      })
      if (!result.ok) console.error('[subscribe/confirm] welcome email failed', { email: subscriber.email, error: result.error })
    } catch (error) {
      console.error('[subscribe/confirm] welcome email failed', { email: subscriber.email, error })
    }
  }

  return NextResponse.json({ ok: true })
}
