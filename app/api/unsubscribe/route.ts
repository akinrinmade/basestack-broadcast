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
    return NextResponse.json({ error: 'Missing unsubscribe token.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: subscriber, error: loadError } = await admin
    .from('subscribers')
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (loadError || !subscriber) {
    return NextResponse.json({ error: 'This unsubscribe link is invalid.' }, { status: 404 })
  }

  if (subscriber.status === 'unsubscribed') {
    return NextResponse.json({ ok: true, alreadyUnsubscribed: true })
  }

  const { error: updateError } = await admin
    .from('subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', subscriber.id)

  if (updateError) {
    return NextResponse.json({ error: 'Could not process your unsubscribe request.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
