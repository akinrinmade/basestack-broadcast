'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Gauge, Inbox, Send, Users, Clock3, Mail } from 'lucide-react'
import Link from 'next/link'
import { AdminShell, StatusDot } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { fetchDashboardStats } from '@/lib/subscribers'
import type { DashboardStats } from '@/lib/types'

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
      .then((s) => {
        setStats(s)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminShell>
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
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setLoading(true)
                setError(null)
                fetchDashboardStats()
                  .then(setStats)
                  .catch((e: Error) => setError(e.message))
                  .finally(() => setLoading(false))
              }}
            >
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
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-semibold">Campaigns</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Campaign sending is not yet configured
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                    <Mail className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No campaigns yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Campaign composition and Resend email delivery will be implemented in a future
                    phase. Subscriber management is ready now.
                  </p>
                  <Link href="/compose">
                    <Button variant="outline" size="sm" className="mt-1">
                      Preview compose UI
                    </Button>
                  </Link>
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
                    ['Email delivery', 'Not configured', 'bg-muted-foreground'],
                    ['Subscriber sync', 'Operational', 'bg-primary'],
                    ['Scheduled jobs', 'Not configured', 'bg-muted-foreground'],
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
                      No campaigns scheduled
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
