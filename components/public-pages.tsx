'use client'

import { useState } from 'react'
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

export function PublicSubscribe({
  mode = 'subscribe',
}: {
  mode?: 'subscribe' | 'confirmed' | 'unsubscribe'
}) {
  const [submitted, setSubmitted] = useState(mode !== 'subscribe')

  if (mode === 'confirmed')
    return (
      <PublicFrame>
        <Check className="size-6 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">You&apos;re confirmed.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You&apos;re now on the Basestack Academy broadcast list. Watch your inbox for practical
          cloud engineering lessons.
        </p>
      </PublicFrame>
    )

  if (mode === 'unsubscribe')
    return (
      <PublicFrame>
        <X className="size-6 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Unsubscribe from Broadcast</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We&apos;ll miss you. Confirm below to stop receiving Basestack Academy broadcasts.
        </p>
        <Button className="mt-7 w-full" onClick={() => setSubmitted(true)}>
          {submitted ? 'You are unsubscribed' : 'Unsubscribe'}
        </Button>
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
        Practical cloud engineering, delivered.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        A short, useful broadcast for builders working with AWS, infrastructure, and systems
        that need to stay up.
      </p>
      <form
        className="mt-7 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(true)
        }}
      >
        <input
          required
          type="email"
          className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          placeholder="you@example.com"
          aria-label="Email address"
        />
        <Button type="submit" className="w-full">
          {submitted ? 'Check your inbox' : 'Subscribe to Broadcast'}
        </Button>
      </form>
      <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
        No noise. Unsubscribe anytime.
      </p>
    </PublicFrame>
  )
}
