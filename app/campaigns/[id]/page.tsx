'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Pencil, Send, XCircle } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authFetchJson } from '@/lib/api-client'
import { fetchCampaign, fetchCampaignSends } from '@/lib/campaigns'
import type { Campaign, CampaignSend, CampaignStatus } from '@/lib/types'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function CampaignDetailContent({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [sends, setSends] = useState<CampaignSend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [openersOnly, setOpenersOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s] = await Promise.all([fetchCampaign(id), fetchCampaignSends(id)])
      setCampaign(c)
      setSends(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSend() {
    if (!campaign) return
    if (!confirm(`Send "${campaign.name}" now?`)) return
    setSending(true)
    setSendError(null)
    try {
      await authFetchJson(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
      await load()
    } catch (e) {
      setSendError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Send className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Campaign not found</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {error || `No campaign record exists for ${id}.`}
        </p>
        <Link href="/campaigns">
          <Button variant="outline" className="mt-6">
            Back to campaigns
          </Button>
        </Link>
      </div>
    )
  }

  const canEdit = ['draft', 'failed'].includes(campaign.status)
  const canSend = ['draft', 'failed'].includes(campaign.status)
  const deliveredCount = sends.filter((send) => send.status === 'sent').length
  const openedCount = sends.filter((send) => (send.open_count ?? 0) > 0).length
  const clickedCount = sends.filter((send) => (send.click_count ?? 0) > 0).length
  const engagementRate = (count: number) =>
    deliveredCount > 0 ? `${Math.round((count / deliveredCount) * 100)}%` : '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{campaign.name}</h2>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{campaign.subject || 'No subject yet'}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/compose?id=${campaign.id}`}>
              <Button variant="outline" className="gap-2">
                <Pencil className="size-4" />
                Edit
              </Button>
            </Link>
          )}
          {canSend && (
            <Button className="gap-2" onClick={handleSend} disabled={sending}>
              <Send className="size-4" />
              {sending ? 'Sending...' : 'Send now'}
            </Button>
          )}
        </div>
      </div>

      {sendError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recipients" value={campaign.recipient_count.toLocaleString()} />
        <Stat label="Sent" value={campaign.sent_count.toLocaleString()} />
        <Stat label="Failed" value={campaign.failed_count.toLocaleString()} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Unique opens" value={`${openedCount.toLocaleString()} (${engagementRate(openedCount)})`} />
        <Stat label="Unique clicks" value={`${clickedCount.toLocaleString()} (${engagementRate(clickedCount)})`} />
        <Stat label="Delivery rate" value={campaign.recipient_count > 0 ? `${Math.round((deliveredCount / campaign.recipient_count) * 100)}%` : '—'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Sender</p>
          <p className="mt-1">{campaign.sender_name || 'Default'} {campaign.sender_email ? `<${campaign.sender_email}>` : ''}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Reply-to</p>
          <p className="mt-1">{campaign.reply_to || '—'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1">{formatDateTime(campaign.created_at)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Sent at</p>
          <p className="mt-1">{formatDateTime(campaign.sent_at)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="font-semibold">Delivery log</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Per-recipient send results, and when each recipient opened this email.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenersOnly((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              openersOnly
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {openersOnly ? `Showing openers (${openedCount})` : 'Show only openers'}
          </button>
        </div>
        {sends.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <AlertCircle className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {campaign.status === 'draft' ? 'This campaign has not been sent yet.' : 'No delivery records yet.'}
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {sends
                  .filter((s) => !openersOnly || (s.open_count ?? 0) > 0)
                  .map((s) => {
                    const opened = (s.open_count ?? 0) > 0
                    return (
                      <tr key={s.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {s.status === 'sent' ? (
                              <CheckCircle2 className="size-3.5 text-primary" />
                            ) : (
                              <XCircle className="size-3.5 text-destructive" />
                            )}
                            {s.email}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {s.status === 'failed' ? s.error : formatDateTime(s.sent_at)}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {s.status !== 'sent' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : opened ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                              <Eye className="size-3" />
                              Opened {formatDateTime(s.opened_at)}
                              {(s.open_count ?? 0) > 1 ? ` · ${s.open_count}×` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                              <EyeOff className="size-3" />
                              Not opened
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <AdminShell>
      <ProtectedRoute>
        <CampaignDetailContent id={id} />
      </ProtectedRoute>
    </AdminShell>
  )
}
