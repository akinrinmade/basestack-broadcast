'use client'

import { Send } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'

export default function CampaignsPage() {
  return (
    <AdminShell>
      <ProtectedRoute>
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Create, schedule, and analyze your academy broadcasts.
          </p>
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Send className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">No campaigns yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Campaign creation, scheduling, and Resend email delivery will be implemented in a
              future phase. The subscriber foundation is ready now.
            </p>
            <Button className="mt-6" disabled>
              Coming soon
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    </AdminShell>
  )
}
