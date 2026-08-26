'use client'

import { useEffect, useState } from 'react'
import { Check, Settings2 } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { fetchSettings, saveSettings } from '@/lib/settings'
import type { Settings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ sender_name: '', reply_to_email: '', mailing_address: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s)
        setForm({
          sender_name: s.sender_name,
          reply_to_email: s.reply_to_email ?? '',
          mailing_address: s.mailing_address ?? '',
        })
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    if (!form.sender_name.trim()) {
      setSaveError('Sender name is required.')
      setSaving(false)
      return
    }
    if (!form.mailing_address.trim()) {
      setSaveError('Mailing address is required.')
      setSaving(false)
      return
    }
    if (form.reply_to_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.reply_to_email)) {
      setSaveError('Reply-to email is not a valid email address.')
      setSaving(false)
      return
    }

    try {
      const updated = await saveSettings({
        sender_name: form.sender_name.trim(),
        reply_to_email: form.reply_to_email.trim() || null,
        mailing_address: form.mailing_address.trim() || null,
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell>
      <ProtectedRoute>
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure your broadcast sender identity and compliance details.
              </p>
            </div>
          </div>

          {loading && (
            <div className="mt-8 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm font-medium text-destructive">Failed to load settings</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <form onSubmit={handleSave} className="mt-8 flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Sender name
                <input
                  className="modal-input"
                  value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  placeholder="Basestack Academy"
                />
                <span className="font-mono text-[10px] font-normal text-muted-foreground">
                  Required. Display name for outgoing emails.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Reply-to email
                <input
                  type="email"
                  className="modal-input"
                  value={form.reply_to_email}
                  onChange={(e) => setForm({ ...form, reply_to_email: e.target.value })}
                  placeholder="reply@basestack.io"
                />
                <span className="font-mono text-[10px] font-normal text-muted-foreground">
                  Optional. Must be a valid email if provided.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Physical mailing address
                <textarea
                  className="modal-input min-h-[80px] resize-y"
                  value={form.mailing_address}
                  onChange={(e) => setForm({ ...form, mailing_address: e.target.value })}
                  placeholder="Basestack Academy&#10;123 Main St, Suite 100&#10;San Francisco, CA 94105"
                />
                <span className="font-mono text-[10px] font-normal text-muted-foreground">
                  Required. Included in every broadcast for CAN-SPAM compliance.
                </span>
              </label>

              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && (
                <p className="flex items-center gap-2 text-sm text-primary">
                  <Check className="size-4" />
                  Settings saved successfully.
                </p>
              )}

              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? 'Saving...' : 'Save settings'}
              </Button>
            </form>
          )}
        </div>

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
