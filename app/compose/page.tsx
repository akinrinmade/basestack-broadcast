'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Eye, Save, Send, TestTube2, Users, X } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { authFetchJson } from '@/lib/api-client'
import {
  countEligibleRecipients,
  createCampaign,
  fetchCampaign,
  scheduleCampaign,
  unscheduleCampaign,
  updateCampaign,
} from '@/lib/campaigns'
import { fetchSubscribers } from '@/lib/subscribers'
import { fetchSettings } from '@/lib/settings'
import type { Campaign, RecipientFilter, Subscriber } from '@/lib/types'

interface FormState {
  name: string
  subject: string
  senderName: string
  senderEmail: string
  replyTo: string
  htmlContent: string
  recipientFilter: RecipientFilter
}

const EMPTY_FORM: FormState = {
  name: '',
  subject: '',
  senderName: '',
  senderEmail: '',
  replyTo: '',
  htmlContent: '',
  recipientFilter: { mode: 'all_active' },
}

function ComposeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('id')

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(Boolean(campaignId))
  const [loadError, setLoadError] = useState<string | null>(null)

  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [showRecipientPicker, setShowRecipientPicker] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [scheduledAtInput, setScheduledAtInput] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Load an existing draft (edit mode), the sender default from settings, and the subscriber list.
  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setForm((f) =>
          f.senderName ? f : { ...f, senderName: s.sender_name, replyTo: s.reply_to_email ?? '' },
        )
      })
      .catch(() => {})

    fetchSubscribers()
      .then(setSubscribers)
      .catch(() => {})

    if (!campaignId) return
    fetchCampaign(campaignId)
      .then((c) => {
        setCampaign(c)
        setForm({
          name: c.name,
          subject: c.subject,
          senderName: c.sender_name ?? '',
          senderEmail: c.sender_email ?? '',
          replyTo: c.reply_to ?? '',
          htmlContent: c.html_content,
          recipientFilter: c.recipient_filter,
        })
        if (c.scheduled_at) {
          // toISOString() -> "2026-08-26T14:30:00.000Z"; datetime-local wants
          // "2026-08-26T14:30" in local time, so trim seconds/ms/zone.
          const local = new Date(c.scheduled_at)
          const pad = (n: number) => String(n).padStart(2, '0')
          setScheduledAtInput(
            `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`,
          )
        }
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [campaignId])

  const refreshRecipientCount = useCallback((filter: RecipientFilter) => {
    countEligibleRecipients(filter)
      .then(setRecipientCount)
      .catch(() => setRecipientCount(null))
  }, [])

  useEffect(() => {
    refreshRecipientCount(form.recipientFilter)
  }, [form.recipientFilter, refreshRecipientCount])

  const isLocked = campaign ? !['draft', 'failed'].includes(campaign.status) : false

  function toCampaignInput() {
    return {
      name: form.name.trim() || 'Untitled campaign',
      subject: form.subject.trim(),
      sender_name: form.senderName.trim() || null,
      sender_email: form.senderEmail.trim() || null,
      reply_to: form.replyTo.trim() || null,
      html_content: form.htmlContent,
      recipient_filter: form.recipientFilter,
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    setSaveError(null)
    try {
      if (campaign) {
        const updated = await updateCampaign(campaign.id, toCampaignInput())
        setCampaign(updated)
      } else {
        const created = await createCampaign(toCampaignInput())
        setCampaign(created)
        router.replace(`/compose?id=${created.id}`)
      }
      setSavedAt(Date.now())
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function ensureSaved(): Promise<Campaign> {
    if (campaign && !isLocked) {
      const updated = await updateCampaign(campaign.id, toCampaignInput())
      setCampaign(updated)
      return updated
    }
    if (campaign) return campaign
    const created = await createCampaign(toCampaignInput())
    setCampaign(created)
    router.replace(`/compose?id=${created.id}`)
    return created
  }

  async function handleSendTest() {
    setTestSending(true)
    setTestResult(null)
    try {
      const saved = await ensureSaved()
      await authFetchJson(`/api/campaigns/${saved.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ testEmail }),
      })
      setTestResult({ ok: true, message: `Test email sent to ${testEmail}.` })
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message })
    } finally {
      setTestSending(false)
    }
  }

  async function handleSendCampaign() {
    if (!confirm(`Send this campaign to ${recipientCount ?? 'all eligible'} subscribers now?`)) return
    setSending(true)
    setSendResult(null)
    try {
      const saved = await ensureSaved()
      const result = await authFetchJson<{
        status: string
        recipientCount: number
        sentCount: number
        failedCount: number
      }>(`/api/campaigns/${saved.id}/send`, { method: 'POST' })
      setSendResult({
        ok: result.status === 'sent',
        message: `Sent to ${result.sentCount} of ${result.recipientCount} recipients${
          result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''
        }.`,
      })
      router.push(`/campaigns/${saved.id}`)
    } catch (e) {
      setSendResult({ ok: false, message: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  async function handleSchedule() {
    setScheduling(true)
    setScheduleError(null)
    try {
      if (!scheduledAtInput) {
        throw new Error('Pick a date and time first.')
      }
      const iso = new Date(scheduledAtInput).toISOString()
      if (new Date(iso).getTime() <= Date.now()) {
        throw new Error('Pick a time in the future.')
      }
      const saved = await ensureSaved()
      const updated = await scheduleCampaign(saved.id, iso)
      setCampaign(updated)
    } catch (e) {
      setScheduleError((e as Error).message)
    } finally {
      setScheduling(false)
    }
  }

  async function handleUnschedule() {
    if (!campaign) return
    setScheduling(true)
    setScheduleError(null)
    try {
      const updated = await unscheduleCampaign(campaign.id)
      setCampaign(updated)
    } catch (e) {
      setScheduleError((e as Error).message)
    } finally {
      setScheduling(false)
    }
  }

  function toggleSelectedSubscriber(id: string) {
    setForm((f) => {
      const current = f.recipientFilter.subscriber_ids ?? []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return { ...f, recipientFilter: { mode: 'selected', subscriber_ids: next } }
    })
  }

  const activeSubscribers = subscribers.filter((s) => s.status === 'active')

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">Failed to load campaign</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {campaign ? `Editing "${campaign.name || 'Untitled campaign'}"` : 'Compose a new broadcast'}
          </p>
          {campaign && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Status: {campaign.status}
            </p>
          )}
        </div>
        {savedAt && !saveError && (
          <p className="font-mono text-[10px] text-primary">Draft saved</p>
        )}
      </div>

      {isLocked && campaign?.status === 'scheduled' && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            This campaign is scheduled to send at{' '}
            <strong>
              {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'an unknown time'}
            </strong>
            . Cancel the schedule to edit it again.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={handleUnschedule}
            disabled={scheduling}
          >
            <X className="size-4" />
            {scheduling ? 'Cancelling...' : 'Cancel schedule'}
          </Button>
        </div>
      )}

      {isLocked && campaign?.status !== 'scheduled' && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          This campaign is <strong>{campaign?.status}</strong> and can no longer be edited.{' '}
          <Link href={`/campaigns/${campaign?.id}`} className="underline">
            View campaign details
          </Link>
          .
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <Field label="Campaign name (internal)">
            <input
              className="field-input"
              placeholder="August product update"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isLocked}
            />
          </Field>
          <Field label="Subject">
            <input
              className="field-input"
              placeholder="What's new this week"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              disabled={isLocked}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sender name">
              <input
                className="field-input"
                placeholder="Basestack Academy"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                disabled={isLocked}
              />
            </Field>
            <Field label="Sender email (optional override)">
              <input
                className="field-input"
                placeholder="Uses RESEND_FROM_EMAIL if blank"
                value={form.senderEmail}
                onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                disabled={isLocked}
              />
            </Field>
          </div>
          <Field label="Reply-to">
            <input
              className="field-input"
              placeholder="hello@basestack.academy"
              value={form.replyTo}
              onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
              disabled={isLocked}
            />
          </Field>
          <Field label="Email content (HTML)">
            <textarea
              className="field-input min-h-[280px] font-mono text-xs leading-6"
              placeholder="<p>Hi {{name}},</p>"
              value={form.htmlContent}
              onChange={(e) => setForm({ ...form, htmlContent: e.target.value })}
              disabled={isLocked}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1 py-0.5">{'{{name}}'}</code> to personalize
            with the recipient&apos;s name. A mailing address and unsubscribe link are added
            automatically.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />
                Recipients
              </h3>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={form.recipientFilter.mode === 'all_active'}
                  onChange={() => setForm({ ...form, recipientFilter: { mode: 'all_active' } })}
                  disabled={isLocked}
                />
                All active subscribers
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={form.recipientFilter.mode === 'selected'}
                  onChange={() =>
                    setForm({
                      ...form,
                      recipientFilter: { mode: 'selected', subscriber_ids: [] },
                    })
                  }
                  disabled={isLocked}
                />
                Selected subscribers
              </label>
              {form.recipientFilter.mode === 'selected' && !isLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 self-start"
                  onClick={() => setShowRecipientPicker(true)}
                >
                  Choose subscribers ({form.recipientFilter.subscriber_ids?.length ?? 0} selected)
                </Button>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm font-medium">
              {recipientCount === null
                ? 'Calculating recipients\u2026'
                : `Ready to send to ${recipientCount.toLocaleString()} subscriber${recipientCount === 1 ? '' : 's'}`}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Unsubscribed and suppressed subscribers are always excluded.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Actions</h3>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="size-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={handleSaveDraft}
              disabled={saving || isLocked}
            >
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save draft'}
            </Button>

            <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
              <label className="text-xs font-medium text-muted-foreground">Send test email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  variant="outline"
                  className="shrink-0 gap-2"
                  onClick={handleSendTest}
                  disabled={testSending || !testEmail}
                >
                  <TestTube2 className="size-4" />
                  {testSending ? 'Sending...' : 'Send test'}
                </Button>
              </div>
              {testResult && (
                <p className={`text-xs ${testResult.ok ? 'text-primary' : 'text-destructive'}`}>
                  {testResult.message}
                </p>
              )}
            </div>

            {!isLocked && (
              <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Schedule for later (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    className="field-input"
                    value={scheduledAtInput}
                    onChange={(e) => setScheduledAtInput(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={handleSchedule}
                    disabled={
                      scheduling || !scheduledAtInput || !form.subject.trim() || !form.htmlContent.trim()
                    }
                  >
                    <Calendar className="size-4" />
                    {scheduling ? 'Scheduling...' : 'Schedule'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sent automatically at this time — no need to keep this tab open.
                </p>
                {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
              </div>
            )}

            <div className="mt-1 border-t border-border pt-3">
              <Button
                className="w-full gap-2"
                onClick={handleSendCampaign}
                disabled={sending || isLocked || !form.subject.trim() || !form.htmlContent.trim()}
              >
                <Send className="size-4" />
                {sending ? 'Sending...' : 'Send campaign now'}
              </Button>
              {saveError && <p className="mt-2 text-xs text-destructive">{saveError}</p>}
              {sendResult && (
                <p className={`mt-2 text-xs ${sendResult.ok ? 'text-primary' : 'text-destructive'}`}>
                  {sendResult.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRecipientPicker && (
        <Modal onClose={() => setShowRecipientPicker(false)} title="Choose subscribers" subtitle="Only active subscribers can be selected.">
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {activeSubscribers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active subscribers yet.</p>
            )}
            {activeSubscribers.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={(form.recipientFilter.subscriber_ids ?? []).includes(s.id)}
                  onChange={() => toggleSelectedSubscriber(s.id)}
                />
                <span className="flex-1 truncate">{s.name || s.email}</span>
                <span className="truncate text-xs text-muted-foreground">{s.email}</span>
              </label>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => setShowRecipientPicker(false)}>
            Done
          </Button>
        </Modal>
      )}

      {showPreview && (
        <Modal onClose={() => setShowPreview(false)} title="Preview" subtitle={form.subject || 'No subject yet'}>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-white p-4">
            {form.htmlContent ? (
              <div dangerouslySetInnerHTML={{ __html: form.htmlContent.replace(/\{\{\s*name\s*\}\}/gi, 'there') }} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        </Modal>
      )}

      <style jsx global>{`
        .field-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--input);
          background: var(--background);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .field-input:focus {
          box-shadow: 0 0 0 2px var(--primary);
        }
        .field-input:disabled {
          opacity: 0.6;
        }
      `}</style>
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

export default function ComposePage() {
  return (
    <AdminShell>
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
            </div>
          }
        >
          <ComposeContent />
        </Suspense>
      </ProtectedRoute>
    </AdminShell>
  )
}
