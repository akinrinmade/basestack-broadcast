'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Clock3, Download, FileUp, MoveHorizontal as MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, Upload, Users, X } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  fetchSubscribers,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  bulkCreateSubscribers,
} from '@/lib/subscribers'
import { parseCsv, validateCsv, exportSubscribersToCsv } from '@/lib/csv'
import type { Subscriber, SubscriberStatus, CsvPreview } from '@/lib/types'

const STATUS_FILTERS: ('all' | SubscriberStatus)[] = [
  'all',
  'active',
  'pending',
  'unsubscribed',
  'suppressed',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriberStatus>('all')

  // Add modal
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', status: 'active' as SubscriberStatus })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit modal
  const [editing, setEditing] = useState<Subscriber | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', status: 'active' as SubscriberStatus })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation
  const [deleting, setDeleting] = useState<Subscriber | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // CSV import
  const [showCsv, setShowCsv] = useState(false)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvResult, setCsvResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSubscribers()
      setSubscribers(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = subscribers.filter((s) => {
    const matchesQuery =
      !query ||
      s.name?.toLowerCase().includes(query.toLowerCase()) ||
      s.email.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    return matchesQuery && matchesStatus
  })

  const counts = {
    total: subscribers.length,
    active: subscribers.filter((s) => s.status === 'active').length,
    pending: subscribers.filter((s) => s.status === 'pending').length,
    unsubscribed: subscribers.filter((s) => s.status === 'unsubscribed').length,
    suppressed: subscribers.filter((s) => s.status === 'suppressed').length,
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    try {
      await createSubscriber({
        name: addForm.name.trim() || null,
        email: addForm.email.trim(),
        status: addForm.status,
        source: 'manual',
      })
      setShowAdd(false)
      setAddForm({ name: '', email: '', status: 'active' })
      await load()
    } catch (e) {
      setAddError((e as Error).message)
    } finally {
      setAddLoading(false)
    }
  }

  function openEdit(s: Subscriber) {
    setEditing(s)
    setEditForm({ name: s.name ?? '', email: s.email, status: s.status })
    setEditError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditLoading(true)
    setEditError(null)
    try {
      await updateSubscriber(editing.id, {
        name: editForm.name.trim() || null,
        email: editForm.email.trim(),
        status: editForm.status,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setEditError((e as Error).message)
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteSubscriber(deleting.id)
      setDeleting(null)
      await load()
    } catch {
      // keep modal open on error
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvLoading(true)
    setCsvError(null)
    setCsvPreview(null)
    setCsvResult(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) {
        setCsvError('No data rows found in CSV file.')
        return
      }
      const preview = await validateCsv(rows)
      setCsvPreview(preview)
    } catch (e) {
      setCsvError((e as Error).message)
    } finally {
      setCsvLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleExport() {
    // Exports whatever is currently visible (respects the search query and
    // status filter), so "export active subscribers" is just filter + export.
    const csv = exportSubscribersToCsv(shown)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const datestamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `subscribers-${datestamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleCsvImport() {
    if (!csvPreview || csvPreview.validRows.length === 0) return
    setCsvLoading(true)
    setCsvError(null)
    try {
      const result = await bulkCreateSubscribers(
        csvPreview.validRows.map((r) => ({ name: r.name, email: r.email })),
      )
      setCsvResult({ inserted: result.inserted, skipped: csvPreview.totalInvalid })
      setCsvPreview(null)
      await load()
    } catch (e) {
      setCsvError((e as Error).message)
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <AdminShell>
      <ProtectedRoute>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <p className="text-sm text-muted-foreground">
            Manage consent, audiences, and subscriber health.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              disabled={shown.length === 0}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowCsv(true)}>
              <Upload className="size-4" />
              Import CSV
            </Button>
            <Button className="gap-2" onClick={() => setShowAdd(true)}>
              <Plus className="size-4" />
              Add subscriber
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total" value={counts.total.toLocaleString()} change="All records" icon={Users} />
          <Metric
            label="Active"
            value={counts.active.toLocaleString()}
            change="Receiving broadcasts"
            icon={ShieldCheck}
          />
          <Metric
            label="Pending"
            value={counts.pending.toLocaleString()}
            change="Needs confirmation"
            icon={Clock3}
          />
          <Metric
            label="Unsubscribed"
            value={counts.unsubscribed.toLocaleString()}
            change="Opted out"
            icon={Users}
          />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition ${
                    statusFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => setStatusFilter('suppressed')}
                className={`rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition ${
                  statusFilter === 'suppressed' ? 'bg-destructive text-destructive-foreground' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                }`}
              >
                Suppression list
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-64"
                placeholder="Search subscribers"
              />
            </div>
          </div>

          {loading && (
            <div className="p-8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mb-3 h-14 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-destructive">Failed to load subscribers</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && shown.length === 0 && subscribers.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No subscribers yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Add your first subscriber manually or import a CSV file to get started.
              </p>
              <Button size="sm" className="mt-1 gap-2" onClick={() => setShowAdd(true)}>
                <Plus className="size-4" />
                Add subscriber
              </Button>
            </div>
          )}

          {!loading && !error && shown.length === 0 && subscribers.length > 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No subscribers match your filters.</p>
            </div>
          )}

          {!loading && !error && shown.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-muted/50 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-normal">Subscriber</th>
                    <th className="px-5 py-3 font-normal">Source</th>
                    <th className="px-5 py-3 font-normal">Status</th>
                    <th className="px-5 py-3 font-normal">Joined</th>
                    <th className="px-5 py-3 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id} className="border-t border-border text-sm">
                      <td className="px-5 py-4">
                        <p className="font-medium">{s.name || '—'}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        <span className="font-mono text-[10px] uppercase">{s.source.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          tone={
                            s.status === 'active'
                              ? 'success'
                              : s.status === 'pending'
                                ? 'warning'
                                : s.status === 'suppressed'
                                  ? 'error'
                                  : 'default'
                          }
                        >
                          {s.status}
                        </Badge>
                        {s.status === 'suppressed' && s.suppression_reason && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {s.suppression_reason.replace('_', ' ')}
                            {s.bounce_count > 0 ? ` · ${s.bounce_count} bounce${s.bounce_count === 1 ? '' : 's'}` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Edit subscriber"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => setDeleting(s)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete subscriber"
                          >
                            <Trash2 className="size-4" />
                          </button>
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add subscriber" subtitle="Create a new subscriber record.">
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <Field label="Name">
              <input
                className="modal-input"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                className="modal-input"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="jane@example.com"
              />
            </Field>
            <Field label="Status">
              <select
                className="modal-input"
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value as SubscriberStatus })}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </Field>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <Button type="submit" disabled={addLoading} className="mt-2 gap-2">
              {addLoading ? 'Adding...' : 'Add subscriber'}
            </Button>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Edit subscriber" subtitle="Update subscriber details.">
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            <Field label="Name">
              <input
                className="modal-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                className="modal-input"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className="modal-input"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as SubscriberStatus })}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </Field>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <Button type="submit" disabled={editLoading} className="mt-2 gap-2">
              {editLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Modal
          onClose={() => setDeleting(null)}
          title="Delete subscriber"
          subtitle="This action cannot be undone."
        >
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">
              {deleting.name || deleting.email}
            </span>
            ? This will permanently remove their record.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex-1 gap-2"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}

      {/* CSV import modal */}
      {showCsv && (
        <Modal
          onClose={() => {
            setShowCsv(false)
            setCsvPreview(null)
            setCsvError(null)
            setCsvResult(null)
          }}
          title="Import subscribers from CSV"
          subtitle="Upload a CSV with name and email columns."
        >
          {csvResult && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
                <Check className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {csvResult.inserted} imported, {csvResult.skipped} skipped
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Valid rows were inserted as active subscribers.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setShowCsv(false)
                  setCsvPreview(null)
                  setCsvError(null)
                  setCsvResult(null)
                }}
              >
                Done
              </Button>
            </div>
          )}

          {!csvResult && !csvPreview && (
            <div className="flex flex-col gap-4">
              {csvError && <p className="text-sm text-destructive">{csvError}</p>}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary/40">
                <FileUp className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Choose a CSV file</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Headers: name, email
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFile}
                  disabled={csvLoading}
                />
              </label>
              {csvLoading && (
                <p className="text-center text-sm text-muted-foreground">Processing...</p>
              )}
            </div>
          )}

          {!csvResult && csvPreview && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="font-mono text-[10px] uppercase text-primary">Valid</p>
                  <p className="mt-1 text-2xl font-semibold">{csvPreview.totalValid}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="font-mono text-[10px] uppercase text-destructive">Skipped</p>
                  <p className="mt-1 text-2xl font-semibold">{csvPreview.totalInvalid}</p>
                </div>
              </div>

              {csvPreview.invalidRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 font-mono text-[9px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-normal">Row</th>
                        <th className="px-3 py-2 font-normal">Email</th>
                        <th className="px-3 py-2 font-normal">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.invalidRows.map((r) => (
                        <tr key={r.rowNumber} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-[10px]">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-mono text-[10px]">{r.email || '—'}</td>
                          <td className="px-3 py-2 text-destructive">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {csvPreview.totalValid === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No valid rows to import. Please fix the issues above and try again.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {csvPreview.totalValid} valid row(s) will be imported as active subscribers with
                  source <span className="font-mono text-[10px]">csv_import</span>.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvPreview(null)
                    setCsvError(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCsvImport}
                  disabled={csvLoading || csvPreview.totalValid === 0}
                  className="flex-1 gap-2"
                >
                  {csvLoading ? 'Importing...' : `Import ${csvPreview.totalValid} row(s)`}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      <style jsx>{`
        :global(.modal-input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--input);
          background: var(--background);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.modal-input:focus) {
          box-shadow: 0 0 0 2px var(--primary);
        }
      `}</style>
      </ProtectedRoute>
    </AdminShell>
  )
}

function Modal({
  children,
  onClose,
  title,
  subtitle,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
  subtitle: string
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-foreground/20 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}
