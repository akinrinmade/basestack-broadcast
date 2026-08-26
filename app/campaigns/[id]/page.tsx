'use client'

import { use } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <AdminShell>
      <ProtectedRoute>
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Send className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Campaign not found</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Campaign creation and sending have not been implemented yet, so there is no
              campaign record for <span className="font-mono text-[11px]">{id}</span>. This page
              will show campaign details once campaigns are built in a future phase.
            </p>
            <Link href="/campaigns">
              <Button variant="outline" className="mt-6">
                Back to campaigns
              </Button>
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    </AdminShell>
  )
}
