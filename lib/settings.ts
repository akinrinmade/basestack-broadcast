import { supabase } from '@/lib/supabase/client'
import type { Settings, SettingsInput } from '@/lib/types'

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Settings
}

export async function saveSettings(input: SettingsInput): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update({
      sender_name: input.sender_name,
      reply_to_email: input.reply_to_email || null,
      mailing_address: input.mailing_address || null,
      welcome_subject: input.welcome_subject,
      welcome_html: input.welcome_html,
    })
    .eq('id', 1)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Settings
}
