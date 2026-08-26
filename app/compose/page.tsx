'use client'

import { Mail, Send } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'

export default function ComposePage() {
  return (
    <AdminShell>
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Compose</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          The rich email composition workspace will be implemented in a future phase alongside
          Resend email delivery integration. Subscriber management is ready now.
        </p>
        <Button className="mt-6" disabled>
          <Send className="size-4" />
          Coming soon
        </Button>
      </div>
    </AdminShell>
  )
}
