'use client'

import { Activity, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
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
          Authentication will be implemented in Phase 2. For now, the admin console is accessible
          without sign-in during development.
        </p>

        <form className="mt-7 flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="admin@basestack.io"
            aria-label="Email address"
            disabled
          />
          <input
            type="password"
            className="rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Password"
            aria-label="Password"
            disabled
          />
          <Button type="submit" disabled>
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
          Phase 2 — Authentication coming soon
        </p>
      </div>
    </main>
  )
}
