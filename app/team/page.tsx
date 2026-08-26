'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, UserPlus, Users, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { authFetchJson } from '@/lib/api-client'
import { fetchAuditLogs, fetchTeamMembers, removeTeamMember, updateTeamRole } from '@/lib/team'
import type { AuditLog, TeamMember, TeamRole } from '@/lib/types'

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [nextMembers, nextLogs] = await Promise.all([fetchTeamMembers(), fetchAuditLogs()])
      setMembers(nextMembers)
      setLogs(nextLogs)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await authFetchJson('/api/team', { method: 'POST', body: JSON.stringify({ email, role }) })
      setEmail('')
      setMessage('Invitation sent.')
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  async function changeRole(member: TeamMember, nextRole: TeamRole) {
    try { await updateTeamRole(member.user_id, nextRole); await load() }
    catch (e) { setError((e as Error).message) }
  }

  async function remove(member: TeamMember) {
    if (!confirm(`Remove ${member.email} from the team?`)) return
    try { await removeTeamMember(member.user_id); await load() }
    catch (e) { setError((e as Error).message) }
  }

  return <AdminShell><ProtectedRoute><div className="flex flex-col gap-6">
    <div><h2 className="text-xl font-semibold">Team access</h2><p className="mt-1 text-sm text-muted-foreground">Invite administrators and control what each teammate can change.</p></div>
    {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</p>}
    <section className="rounded-xl border border-border bg-card p-5">
      <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium">Invite by email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 font-normal" placeholder="teammate@example.com" /></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Role<select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className="rounded-lg border border-input bg-background px-3 py-2 font-normal"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
        <Button type="submit" className="gap-2"><UserPlus className="size-4" />Invite</Button>
      </form>
    </section>
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5"><h3 className="font-semibold">Members</h3></div>
      {loading ? <div className="p-6 text-sm text-muted-foreground">Loading team...</div> : <div className="divide-y divide-border">{members.map((member) => <div key={member.user_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-primary/10"><ShieldCheck className="size-4 text-primary" /></div><span className="truncate text-sm">{member.email}</span></div><select value={member.role} onChange={(e) => changeRole(member, e.target.value as TeamRole)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button onClick={() => remove(member)} aria-label={`Remove ${member.email}`} className="self-end rounded-lg p-2 text-muted-foreground hover:text-destructive sm:self-auto"><Trash2 className="size-4" /></button></div>)}</div>}
    </section>
    <section className="rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><h3 className="font-semibold">Recent activity</h3></div>{logs.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No activity recorded yet.</p> : <div className="divide-y divide-border">{logs.slice(0, 10).map((log) => <div key={log.id} className="flex items-center justify-between gap-4 p-4 text-sm"><span><strong>{log.action}</strong> {log.entity_type}</span><span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span></div>)}</div>}</section>
  </div></ProtectedRoute></AdminShell>
}