import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/route-auth'
import { checkResendConfig } from '@/lib/resend'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  return NextResponse.json({
    emailDeliveryConfigured: checkResendConfig() === null,
    // Scheduled sending has no cron/worker infrastructure yet — `campaigns.scheduled_at`
    // exists so campaigns can be marked "scheduled", but nothing currently picks them up.
    scheduledJobsConfigured: false,
  })
}
