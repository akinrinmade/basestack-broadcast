import { supabase } from '@/lib/supabase/client'
import type {
  Subscriber,
  SubscriberInput,
  SubscriberStatus,
  DashboardStats,
} from '@/lib/types'

export async function fetchSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Subscriber[]
}

export async function createSubscriber(input: SubscriberInput): Promise<Subscriber> {
  const { data, error } = await supabase
    .from('subscribers')
    .insert({
      name: input.name || null,
      email: input.email,
      status: input.status,
      source: input.source,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('A subscriber with this email already exists.')
    throw new Error(error.message)
  }
  return data as Subscriber
}

export async function updateSubscriber(
  id: string,
  input: Partial<SubscriberInput>,
): Promise<Subscriber> {
  const { data, error } = await supabase
    .from('subscribers')
    .update({
      ...(input.name !== undefined && { name: input.name || null }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.status !== undefined && { status: input.status }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('A subscriber with this email already exists.')
    throw new Error(error.message)
  }
  return data as Subscriber
}

export async function deleteSubscriber(id: string): Promise<void> {
  const { error } = await supabase.from('subscribers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function bulkCreateSubscribers(
  rows: { name: string; email: string }[],
): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 }

  const { data, error } = await supabase
    .from('subscribers')
    .insert(
      rows.map((r) => ({
        name: r.name || null,
        email: r.email,
        status: 'active' as SubscriberStatus,
        source: 'csv_import',
      })),
    )
    .select('id')

  if (error) {
    if (error.code === '23505')
      throw new Error('One or more emails already exist in the database.')
    throw new Error(error.message)
  }
  return { inserted: data?.length ?? 0 }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { count: total, error: e1 } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })

  const { count: active, error: e2 } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: pending, error: e3 } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: unsubscribed, error: e4 } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'unsubscribed')

  const { count: suppressed, error: e5 } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'suppressed')

  if (e1 || e2 || e3 || e4 || e5) {
    throw new Error(e1?.message || e2?.message || e3?.message || e4?.message || e5?.message)
  }

  return {
    total: total ?? 0,
    active: active ?? 0,
    pending: pending ?? 0,
    unsubscribed: unsubscribed ?? 0,
    suppressed: suppressed ?? 0,
  }
}

export async function checkEmailsExist(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const { data, error } = await supabase
    .from('subscribers')
    .select('email')
    .in(
      'email',
      emails.map((e) => e.toLowerCase()),
    )

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => (r.email as string).toLowerCase()))
}
