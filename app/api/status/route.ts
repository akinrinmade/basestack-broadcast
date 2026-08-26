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
    // The cron route at /api/cron/send-scheduled picks up due campaigns, but it
    // refuses to run without CRON_SECRET set (see that route for why). Treat
    // "configured" as "the secret exists", since that's the one manual setup
    // step Vercel Cron itself can't do for you.
    scheduledJobsConfigured: Boolean(process.env.CRON_SECRET),
  })
}
