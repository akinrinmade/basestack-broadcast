import { supabase } from '@/lib/supabase/client'
import type { Campaign, CampaignInput, CampaignProgress, CampaignRecipient, CampaignSend, RecipientFilter } from '@/lib/types'

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Campaign[]
}
export async function fetchCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function fetchCampaignSends(id: string): Promise<CampaignSend[]> {
  const { data, error } = await supabase.from('campaign_sends').select('*').eq('campaign_id', id).order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as CampaignSend[]
}
export async function fetchCampaignRecipients(id: string): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase.from('campaign_recipients').select('*').eq('campaign_id', id).order('created_at')
  if (error) throw new Error(error.message)
  return data as CampaignRecipient[]
}
export async function fetchCampaignProgress(id: string): Promise<CampaignProgress> {
  const rows = await fetchCampaignRecipients(id)
  const recipientCount = rows.length
  const sentCount = rows.filter(r => r.status === 'sent').length
  const failedCount = rows.filter(r => r.status === 'failed').length
  const pendingCount = rows.filter(r => r.status === 'pending').length
  return { recipientCount, sentCount, failedCount, pendingCount, percent: recipientCount ? Math.round(sentCount / recipientCount * 100) : 0 }
}
export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('campaigns').insert({ ...input, status: 'draft', scheduled_at: input.scheduled_at ?? null, batch_size: input.batch_size ?? 100, created_by: userData.user?.id ?? null }).select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function updateCampaign(id: string, input: Partial<CampaignInput>): Promise<Campaign> {
  const patch: Record<string, unknown> = {}
  for (const key of ['name','subject','sender_name','sender_email','reply_to','html_content','recipient_filter','scheduled_at','batch_size'] as const) {
    if (input[key] !== undefined) patch[key] = input[key] ?? null
  }
  if (patch.batch_size !== undefined) patch.batch_size = Math.max(1, Math.min(100, Number(patch.batch_size)))
  const { data, error } = await supabase.from('campaigns').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function markCampaignReady(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'ready', scheduled_at: null }).eq('id', id).in('status', ['draft','failed']).select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function scheduleCampaign(id: string, scheduledAtIso: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'scheduled', scheduled_at: scheduledAtIso }).eq('id', id).in('status', ['draft','ready']).select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function unscheduleCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'ready', scheduled_at: null }).eq('id', id).eq('status', 'scheduled').select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function pauseCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id).eq('status', 'ready').select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function resumeCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'ready' }).eq('id', id).eq('status', 'paused').select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function unreadyCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').update({ status: 'draft' }).eq('id', id).eq('status', 'ready').select().single()
  if (error) throw new Error(error.message)
  return data as Campaign
}
export async function deleteCampaign(id: string): Promise<void> { const { error } = await supabase.from('campaigns').delete().eq('id', id); if (error) throw new Error(error.message) }
export async function duplicateCampaign(id: string): Promise<Campaign> { const c = await fetchCampaign(id); return createCampaign({ name: `${c.name} copy`, subject: c.subject, sender_name: c.sender_name, sender_email: c.sender_email, reply_to: c.reply_to, html_content: c.html_content, recipient_filter: c.recipient_filter, batch_size: c.batch_size }) }
export async function countEligibleRecipients(filter: RecipientFilter): Promise<number> {
  let q = supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('status','active')
  if (filter.mode === 'selected') { const ids = filter.subscriber_ids ?? []; if (!ids.length) return 0; q = q.in('id', ids) }
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}
