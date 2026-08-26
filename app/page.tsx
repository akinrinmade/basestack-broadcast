'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Gauge, Inbox, Send, Users, Clock3, Mail } from 'lucide-react'
import Link from 'next/link'
import { AdminShell, StatusDot } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authFetchJson } from '@/lib/api-client'
import { fetchCampaigns } from '@/lib/campaigns'
import { fetchDashboardStats } from '@/lib/subscribers'
import type { Campaign, CampaignStatus, DashboardStats } from '@/lib/types'

function Metric({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string
  value: string
  change: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-primary">
        <ArrowUpRight className="size-3" />
        {change}
      </p>
    </div>
  )
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

interface SystemStatus {
  emailDeliveryConfigured: boolean
  scheduledJobsConfigured: boolean
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function loadAll() {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchDashboardStats(),
      fetchCampaigns().catch(() => [] as Campaign[]),
      authFetchJson<SystemStatus>('/api/status').catch(() => null),
    ])
      .then(([s, c, status]) => {
        setStats(s)
        setCampaigns(c)
        setSystemStatus(status)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentCampaigns = campaigns.slice(0, 5)
  const nextScheduled = campaigns.find((c) => c.status === 'scheduled')
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (5 - index) * 7)
    const start = new Date(date)
    start.setDate(start.getDate() - 6)
    const sent = campaigns
      .filter((campaign) => campaign.sent_at && new Date(campaign.sent_at) >= start && new Date(campaign.sent_at) <= date)
      .reduce((total, campaign) => total + campaign.sent_count, 0)
    return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sent }
  })
  const maxTrend = Math.max(...trend.map((point) => point.sent), 1)

  return (
    <AdminShell>
      <ProtectedRoute>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Your communications hub for the Basestack Academy community. Monitor delivery,
              manage subscribers, and ship better lessons.
            </p>
          </div>
          <Link href="/subscribers">
            <Button className="gap-2">
              <Send className="size-4" />
              Manage subscribers
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm font-medium text-destructive">Failed to load dashboard data</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadAll}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Total subscribers"
                value={stats.total.toLocaleString()}
                change={`${stats.total} in database`}
                icon={Users}
              />
              <Metric
                label="Active"
                value={stats.active.toLocaleString()}
                change="Ready to receive"
                icon={Gauge}
              />
              <Metric
                label="Pending"
                value={stats.pending.toLocaleString()}
                change="Awaiting confirmation"
                icon={Inbox}
              />
              <Metric
                label="Unsubscribed"
                value={stats.unsubscribed.toLocaleString()}
                change="Opted out"
                icon={Send}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h2 className="font-semibold">Campaigns</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaigns.length === 0
                        ? 'No campaigns yet'
                        : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} total`}
                    </p>
                  </div>
                  <Link href="/campaigns">
                    <Button variant="outline" size="sm">
                      View all
                    </Button>
                  </Link>
                </div>

                {recentCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                      <Mail className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No campaigns yet</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Compose your first broadcast to send it to your Basestack Academy
                      subscribers.
                    </p>
                    <Link href="/compose">
                      <Button variant="outline" size="sm" className="mt-1">
                        Compose a campaign
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {recentCampaigns.map((c) => (
                      <Link
                        key={c.id}
                        href={`/campaigns/${c.id}`}
                        className="flex items-center justify-between border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.subject || 'No subject yet'}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-semibold">Send trend</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Successful deliveries by week</p>
                </div>
                <div className="flex h-52 items-end gap-2 px-5 py-6">
                  {trend.map((point) => (
                    <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{point.sent}</span>
                      <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max((point.sent / maxTrend) * 100, point.sent ? 8 : 2)}%` }} />
                      <span className="font-mono text-[9px] text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-semibold">System pulse</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Live delivery infrastructure
                  </p>
                </div>
                <div className="flex flex-col gap-5 p-5">
                  {[
                    [
                      'Email delivery',
                      systemStatus?.emailDeliveryConfigured ? 'Operational' : 'Not configured',
                      systemStatus?.emailDeliveryConfigured ? 'bg-primary' : 'bg-muted-foreground',
                    ],
                    ['Subscriber sync', 'Operational', 'bg-primary'],
                    [
                      'Scheduled jobs',
                      systemStatus?.scheduledJobsConfigured ? 'Operational' : 'Not configured',
                      systemStatus?.scheduledJobsConfigured ? 'bg-primary' : 'bg-muted-foreground',
                    ],
                    ['API health', 'Operational', 'bg-primary'],
                  ].map((row) => (
                    <div className="flex items-center justify-between" key={row[0]}>
                      <span className="flex items-center gap-2 text-sm">
                        <StatusDot color={row[2]} />
                        {row[0]}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        {row[1]}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 rounded-lg bg-muted p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Next scheduled send
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                      <Clock3 className="size-4 text-muted-foreground" />
                      {nextScheduled ? nextScheduled.name : 'No campaigns scheduled'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
      </ProtectedRoute>
    </AdminShell>
  )
}
