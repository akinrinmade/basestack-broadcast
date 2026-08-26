'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export default function ResetPasswordPage() {
  const { updatePassword, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) router.replace('/login')
  }, [authLoading, session, router])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmation) return setError('Passwords do not match.')
    setSaving(true)
    setError(null)
    const result = await updatePassword(password)
    if (result.error) setError(result.error)
    else setSaved(true)
    setSaving(false)
  }

  return <main className="flex min-h-screen items-center justify-center bg-muted/40 p-5"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-10"><div className="flex size-12 items-center justify-center rounded-xl bg-primary/10"><Lock className="size-6 text-primary" /></div><h1 className="mt-5 text-2xl font-semibold">Set a new password</h1><p className="mt-2 text-sm text-muted-foreground">Choose a new password for your Broadcast account.</p>{saved ? <div className="mt-7"><p className="text-sm text-primary">Password updated successfully.</p><Button className="mt-4" onClick={() => router.replace('/')}>Continue to dashboard</Button></div> : <form onSubmit={submit} className="mt-7 flex flex-col gap-3"><input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="New password" /><input required type="password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Confirm new password" />{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button type="submit" disabled={saving}>{saving ? 'Updating...' : 'Update password'}</Button></form>}</div></main>
}