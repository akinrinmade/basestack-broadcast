'use client'

import { useEffect, useState } from 'react'
import { Activity, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-5">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-10">
        {children}
      </div>
    </main>
  )
}

type Mode = 'subscribe' | 'confirm' | 'confirmed' | 'unsubscribe'

export function PublicSubscribe({
  mode = 'subscribe',
  token,
}: {
  mode?: Mode
  token?: string | null
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  // Auto-run the confirm action as soon as the page with a token loads.
  useEffect(() => {
    if (mode !== 'confirm' || !token) return
    setStatus('loading')
    fetch('/api/subscribe/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not confirm your subscription.')
        setStatus('done')
      })
      .catch((e: Error) => {
        setError(e.message)
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token])

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not subscribe.')
      setStatus('done')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function handleUnsubscribe() {
    if (!token) {
      setError('This unsubscribe link is missing a token.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not process your request.')
      setStatus('done')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  if (mode === 'confirm')
    return (
      <PublicFrame>
        <Activity className="size-6 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Confirm your subscription</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {status === 'done'
            ? "You're confirmed. Watch your inbox for practical technology lessons, resources, and updates."
            : status === 'error'
              ? error
              : 'One last step. Confirming your subscription now\u2026'}
        </p>
        {!token && (
          <p className="mt-3 text-sm text-destructive">This confirmation link is missing a token.</p>
        )}
      </PublicFrame>
    )

  if (mode === 'confirmed')
    return (
      <PublicFrame>
        <Check className="size-6 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">You&apos;re confirmed.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You&apos;re now on the Basestack Academy broadcast list. Watch your inbox for practical
          practical technology lessons, resources, and updates.
        </p>
      </PublicFrame>
    )

  if (mode === 'unsubscribe')
    return (
      <PublicFrame>
        <X className="size-6 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Unsubscribe from Broadcast</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {status === 'done'
            ? "You've been unsubscribed. We'll miss you."
            : "We'll miss you. Confirm below to stop receiving Basestack Academy broadcasts."}
        </p>
        {status === 'error' && error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {status !== 'done' && (
          <Button
            className="mt-7 w-full"
            onClick={handleUnsubscribe}
            disabled={status === 'loading' || !token}
          >
            {status === 'loading' ? 'Unsubscribing...' : 'Unsubscribe'}
          </Button>
        )}
      </PublicFrame>
    )

  return (
    <PublicFrame>
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Activity className="size-6" />
      </div>
      <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        Basestack Academy
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Practical technology learning, delivered.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        A short, useful broadcast for builders working with AWS, infrastructure, and systems
        that need to stay up.
      </p>

      {status === 'done' ? (
        <p className="mt-7 text-sm font-medium">
          Check your inbox to confirm your subscription.
        </p>
      ) : (
        <form className="mt-7 flex flex-col gap-3" onSubmit={handleSubscribe}>
          <input
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your name"
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === 'loading'}
          />
          <input
            required
            type="email"
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@example.com"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
          />
          {status === 'error' && error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={status === 'loading'}>
            {status === 'loading' ? 'Subscribing...' : 'Subscribe to Broadcast'}
          </Button>
        </form>
      )}

      <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
        No noise. Unsubscribe anytime.
      </p>
    </PublicFrame>
  )
}
