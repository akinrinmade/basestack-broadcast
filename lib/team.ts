import { supabase } from '@/lib/supabase/client'
import type { AuditLog, TeamMember, TeamRole } from '@/lib/types'

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from('team_members').select('*').order('created_at')
  if (error) throw new Error(error.message)
  return data as TeamMember[]
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) throw new Error(error.message)
  return data as AuditLog[]
}

export async function updateTeamRole(userId: string, role: TeamRole): Promise<void> {
  const { error } = await supabase.from('team_members').update({ role }).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function removeTeamMember(userId: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('user_id', userId)
  if (error) throw new Error(error.message)
}