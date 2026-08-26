'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, Plus, Send } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchCampaigns } from '@/lib/campaigns'
import type { Campaign, CampaignStatus } from '@/lib/types'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const tone =
    status === 'sent'
      ? 'success'
      : status === 'failed'
        ? 'error'
        : status === 'sending'
          ? 'warning'
          : 'default'
  return <Badge tone={tone}>{status}</Badge>
}

function CampaignsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCampaigns()
      setCampaigns(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Create, send, and analyze your academy broadcasts.
        </p>
        <Link href="/compose">
          <Button className="gap-2">
            <Plus className="size-4" />
            New campaign
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-destructive">Failed to load campaigns</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Send className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">No campaigns yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Compose your first broadcast to send it to your Basestack Academy subscribers.
          </p>
          <Link href="/compose">
            <Button className="mt-6 gap-2">
              <Mail className="size-4" />
              Compose a campaign
            </Button>
          </Link>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Failed</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Sent at</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="block">
                      <p className="font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.subject || 'No subject yet'}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.recipient_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.sent_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.failed_count > 0 ? (
                      <span className="text-destructive">{c.failed_count.toLocaleString()}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.sent_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CampaignsPage() {
  return (
    <AdminShell>
      <ProtectedRoute>
        <CampaignsContent />
      </ProtectedRoute>
    </AdminShell>
  )
}
