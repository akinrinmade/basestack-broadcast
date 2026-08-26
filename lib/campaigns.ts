import { supabase } from '@/lib/supabase/client'
import type { Campaign, CampaignInput, CampaignSend, RecipientFilter } from '@/lib/types'

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Campaign[]
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as Campaign
}

export async function fetchCampaignSends(campaignId: string): Promise<CampaignSend[]> {
  const { data, error } = await supabase
    .from('campaign_sends')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as CampaignSend[]
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const { data: userData } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name: input.name,
      subject: input.subject,
      sender_name: input.sender_name || null,
      sender_email: input.sender_email || null,
      reply_to: input.reply_to || null,
      html_content: input.html_content,
      recipient_filter: input.recipient_filter,
      status: input.scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: input.scheduled_at ?? null,
      created_by: userData.user?.id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Campaign
}

export async function updateCampaign(
  id: string,
  input: Partial<CampaignInput>,
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.sender_name !== undefined && { sender_name: input.sender_name || null }),
      ...(input.sender_email !== undefined && { sender_email: input.sender_email || null }),
      ...(input.reply_to !== undefined && { reply_to: input.reply_to || null }),
      ...(input.html_content !== undefined && { html_content: input.html_content }),
      ...(input.recipient_filter !== undefined && { recipient_filter: input.recipient_filter }),
      ...(input.scheduled_at !== undefined && {
        scheduled_at: input.scheduled_at,
        status: input.scheduled_at ? 'scheduled' : 'draft',
      }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Campaign
}

/** Sets a draft/failed campaign to send automatically at the given time (picked up by the cron job). */
export async function scheduleCampaign(id: string, scheduledAtIso: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'scheduled', scheduled_at: scheduledAtIso })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Campaign
}

/** Cancels a pending schedule, returning the campaign to a draft you can edit or send manually. */
export async function unscheduleCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'draft', scheduled_at: null })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Counts eligible (active) recipients for a given filter, for the "Ready to send to N subscribers" preview. */
export async function countEligibleRecipients(filter: RecipientFilter): Promise<number> {
  if (filter.mode === 'selected') {
    const ids = filter.subscriber_ids ?? []
    if (ids.length === 0) return 0
    const { count, error } = await supabase
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const { count, error } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  return count ?? 0
}
