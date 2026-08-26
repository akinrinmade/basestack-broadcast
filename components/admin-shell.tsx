'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Bell, LayoutDashboard, Mail, Menu, MoveHorizontal as MoreHorizontal, Search, Send, Settings2, Users, X } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Subscribers', href: '/subscribers', icon: Users },
  { label: 'Compose', href: '/compose', icon: Mail },
  { label: 'Campaigns', href: '/campaigns', icon: Send },
]

function Logo() {
  return (
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
  )
}

function StatusDot({ color = 'bg-primary' }: { color?: string }) {
  return <span className={`inline-block size-2 rounded-full ${color}`} />
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const currentLabel =
    nav.find((n) => n.href === pathname)?.label ??
    (pathname.startsWith('/settings') ? 'Settings' : 'Dashboard')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-border bg-sidebar p-5 lg:static lg:flex`}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              className="lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-10 flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                pathname.startsWith('/settings')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Settings2 className="size-4" />
              Settings
            </Link>
            <div className="mt-5 flex items-center gap-3 rounded-lg bg-muted/60 p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                SC
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">Sam Carter</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  admin@basestack.io
                </p>
              </div>
              <MoreHorizontal className="ml-auto size-4 text-muted-foreground" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </button>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Broadcast / {currentLabel}
                </p>
                <h1 className="text-lg font-semibold tracking-tight">
                  {currentLabel === 'Dashboard' ? 'Good morning, Sam' : currentLabel}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                aria-label="Search"
                className="hidden rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground sm:block"
              >
                <Search className="size-4" />
              </button>
              <button
                aria-label="Notifications"
                className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
              >
                <Bell className="size-4" />
              </button>
              <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
                <StatusDot />
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  All systems operational
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-5 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}

export { StatusDot }
