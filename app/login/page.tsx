'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export default function LoginPage() {
  const { signIn, resetPassword, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/')
    }
  }, [authLoading, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError(
        error.includes('Invalid login credentials')
          ? 'Invalid email or password.'
          : error,
      )
      setLoading(false)
    }
    // On success, onAuthStateChange + useEffect will redirect
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await resetPassword(email.trim())
    if (result.error) setError(result.error)
    else setSent(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-5">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              BASESTACK
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              BROADCAST
            </p>
          </div>
        </div>

        <div className="mt-8 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in to manage subscribers and broadcast settings.
        </p>

        <form className="mt-7 flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="admin@basestack.io"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            type="password"
            required
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {sent && <p className="text-sm text-primary" role="status">Check your inbox for a password reset link.</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <button type="button" onClick={handleReset} disabled={loading} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          Forgot password?
        </button>

        <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
          Basestack Academy · Admin access only
        </p>
      </div>
    </main>
  )
}
