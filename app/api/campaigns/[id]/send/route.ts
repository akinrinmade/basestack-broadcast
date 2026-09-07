import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/route-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkResendConfig } from '@/lib/resend'
import { CampaignAlreadyClaimedError, sendNextCampaignBatch } from '@/lib/server/campaign-service'
import type { Campaign } from '@/lib/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'You must be signed in to send a campaign.' }, { status: 401 })
  const configError = checkResendConfig()
  if (configError) return NextResponse.json({ error: 'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.' }, { status: 503 })
  const { id } = await params
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  const campaign = data as Campaign
  if (!['ready','scheduled'].includes(campaign.status)) return NextResponse.json({ error: `Campaign must be Ready, Scheduled, or Paused before sending. Current status: ${campaign.status}.` }, { status: 409 })
  if (!campaign.subject.trim() || !campaign.html_content.trim()) return NextResponse.json({ error: 'Add a subject and content before sending.' }, { status: 400 })
  try { return NextResponse.json(await sendNextCampaignBatch(campaign, request)) }
  catch (err) {
    if (err instanceof CampaignAlreadyClaimedError) return NextResponse.json({ error: 'This campaign is already sending.' }, { status: 409 })
    console.error('[api/campaigns/send]', err)
    await admin.from('campaigns').update({ status: 'failed' }).eq('id', id).eq('status','sending')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sending failed.' }, { status: 500 })
  }
}
