import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/route-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkResendConfig } from '@/lib/resend'
import { sendCampaignToRecipients } from '@/lib/server/campaign-service'
import type { Campaign } from '@/lib/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to send a campaign.' }, { status: 401 })
  }

  const configError = checkResendConfig()
  if (configError) {
    return NextResponse.json(
      { error: 'Email delivery is not configured yet. Set RESEND_API_KEY and RESEND_FROM_EMAIL.' },
      { status: 503 },
    )
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

  if (!['draft', 'failed', 'scheduled'].includes(typedCampaign.status)) {
    return NextResponse.json(
      { error: `This campaign is already "${typedCampaign.status}" and cannot be sent again.` },
      { status: 409 },
    )
  }
  if (typedCampaign.status === 'sending') {
    return NextResponse.json({ error: 'This campaign is already sending.' }, { status: 409 })
  }
  if (!typedCampaign.subject.trim() || !typedCampaign.html_content.trim()) {
    return NextResponse.json({ error: 'Add a subject and content before sending.' }, { status: 400 })
  }

  try {
    const result = await sendCampaignToRecipients(typedCampaign, request)

    if (result.recipientCount === 0) {
      return NextResponse.json(
        { error: 'No eligible active subscribers matched this campaign\u2019s recipient selection.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      status: result.status,
      recipientCount: result.recipientCount,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    })
  } catch (err) {
    console.error('[api/campaigns/send] failed', err)
    await admin.from('campaigns').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sending failed unexpectedly.' },
      { status: 500 },
    )
  }
}
