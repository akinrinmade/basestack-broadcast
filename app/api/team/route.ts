import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserFromRequest } from '@/lib/supabase/route-auth'

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }

  const admin = getSupabaseAdmin()
  const { data: member } = await admin.from('team_members').select('role').eq('user_id', user.id).maybeSingle()
  if (member?.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) }
  }
  return { user, admin }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => ({})) as { email?: string; role?: string }
  const email = body.email?.trim().toLowerCase()
  const role = body.role === 'viewer' || body.role === 'admin' ? body.role : 'editor'
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const { data, error } = await auth.admin.auth.inviteUserByEmail(email)
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Invite failed.' }, { status: 400 })

  const { error: memberError } = await auth.admin.from('team_members').upsert({
    user_id: data.user.id,
    email,
    role,
  })
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  await auth.admin.from('audit_logs').insert({
    actor_id: auth.user.id,
    action: 'INVITE',
    entity_type: 'team_member',
    entity_id: data.user.id,
    metadata: { email, role },
  })

  return NextResponse.json({ ok: true })
}