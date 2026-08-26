import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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
    .select('id, status')
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

  const { error: updateError } = await admin
    .from('subscribers')
    .update({ status: 'active', confirmed_at: new Date().toISOString() })
    .eq('id', subscriber.id)

  if (updateError) {
    return NextResponse.json({ error: 'Could not confirm your subscription.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
