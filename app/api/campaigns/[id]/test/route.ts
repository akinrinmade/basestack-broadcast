import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/route-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkResendConfig } from '@/lib/resend'
import { sendTestEmail } from '@/lib/server/campaign-service'
import type { Campaign } from '@/lib/types'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to send a test email.' }, { status: 401 })
  }

  const configError = checkResendConfig()
  if (configError) {
    return NextResponse.json(
      { error: 'Email delivery is not configured yet. Set RESEND_API_KEY and RESEND_FROM_EMAIL.' },
      { status: 503 },
    )
  }

  let body: { testEmail?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const testEmail = body.testEmail?.trim() ?? ''
  if (!EMAIL_RE.test(testEmail)) {
    return NextResponse.json({ error: 'Enter a valid test recipient email.' }, { status: 400 })
  }

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: campaign, error: loadError } = await admin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ error: 'Could not load the campaign.' }, { status: 500 })
  }
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const typedCampaign = campaign as Campaign
  if (!typedCampaign.subject.trim() || !typedCampaign.html_content.trim()) {
    return NextResponse.json({ error: 'Add a subject and content before sending a test.' }, { status: 400 })
  }

  const result = await sendTestEmail(typedCampaign, testEmail, request)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Resend rejected the test email.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
