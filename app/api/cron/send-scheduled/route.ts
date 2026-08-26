import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { CampaignAlreadyClaimedError, sendCampaignToRecipients } from '@/lib/server/campaign-service'
import type { Campaign } from '@/lib/types'

/**
 * Picks up campaigns with status 'scheduled' whose scheduled_at has arrived
 * and sends them via the same logic used by the manual "Send" button.
 *
 * Invoked by Vercel Cron (see vercel.json). Vercel automatically sends a
 * `Authorization: Bearer ${CRON_SECRET}` header on cron-triggered requests,
 * so this route rejects any call that doesn't present that secret — without
 * it, this URL would be a public, unauthenticated way to trigger mass sends.
 *
 * Safe to run on a short interval, and safe if two invocations overlap:
 * sendCampaignToRecipients() first claims each campaign with an atomic
 * conditional UPDATE (status must be draft/scheduled/failed to become
 * 'sending'), so only one concurrent caller ever proceeds to send. It's
 * also idempotent per-recipient on retries (skips subscribers who already
 * have a successful campaign_sends row), so a campaign that failed
 * partway can be safely picked up again on the next run.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: 'Scheduled sending is not configured: CRON_SECRET is missing on the server.' },
      { status: 503 },
    )
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  const { data: dueCampaigns, error } = await admin
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)

  if (error) {
    console.error('[cron/send-scheduled] failed to load due campaigns', error)
    return NextResponse.json({ error: 'Could not load scheduled campaigns.' }, { status: 500 })
  }

  const campaigns = (dueCampaigns ?? []) as Campaign[]

  const results = []
  for (const campaign of campaigns) {
    try {
      const result = await sendCampaignToRecipients(campaign, request)
      results.push({ id: campaign.id, name: campaign.name, ...result })
    } catch (err) {
      if (err instanceof CampaignAlreadyClaimedError) {
        // Another invocation (an overlapping cron run, or someone hitting
        // "Send" manually) already claimed this campaign. Don't touch its
        // status — that process owns it now.
        console.warn('[cron/send-scheduled] campaign already claimed elsewhere, skipping', {
          id: campaign.id,
        })
        results.push({ id: campaign.id, name: campaign.name, status: 'skipped' as const })
        continue
      }
      console.error('[cron/send-scheduled] send failed', { id: campaign.id, err })
      await admin.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id)
      results.push({
        id: campaign.id,
        name: campaign.name,
        status: 'failed' as const,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    checkedAt: nowIso,
    dueCount: campaigns.length,
    results,
  })
}
