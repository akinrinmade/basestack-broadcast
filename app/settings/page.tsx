'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Check, ImagePlus, Italic, Link as LinkIcon, Settings2, Underline } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { fetchSettings, saveSettings } from '@/lib/settings'
import { supabase } from '@/lib/supabase/client'
import type { Settings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    sender_name: '',
    reply_to_email: '',
    mailing_address: '',
    welcome_subject: '',
    welcome_html: '',
  })
  const editorRef = useRef<HTMLDivElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
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
          welcome_subject: s.welcome_subject ?? 'Welcome to Basestack Academy',
          welcome_html: s.welcome_html ?? '',
        })
        if (editorRef.current) editorRef.current.innerHTML = s.welcome_html ?? ''
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
        welcome_subject: form.welcome_subject.trim() || 'Welcome to Basestack Academy',
        welcome_html: form.welcome_html.trim(),
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

  function formatWelcome(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setForm((current) => ({ ...current, welcome_html: editorRef.current?.innerHTML ?? '' }))
  }

  function handleWelcomePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboardHtml = event.clipboardData.getData('text/html')
    const clipboardText = event.clipboardData.getData('text/plain')
    const html = clipboardHtml || (/^\s*<[a-z][\s\S]*>\s*$/i.test(clipboardText) ? clipboardText : '')
    if (!html) return

    event.preventDefault()
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    setForm((current) => ({ ...current, welcome_html: editorRef.current?.innerHTML ?? '' }))
  }

  async function uploadWelcomeImage(file: File | undefined) {
    if (!file) return
    setMediaError(null)
    if (!file.type.startsWith('image/')) {
      setMediaError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMediaError('Images must be 5 MB or smaller.')
      return
    }
    setUploadingMedia(true)
    try {
      const path = `campaign-media/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const { error } = await supabase.storage.from('campaign-media').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('campaign-media').getPublicUrl(path)
      formatWelcome('insertHTML', `<p><img src="${data.publicUrl}" alt="${file.name.replace(/"/g, '')}" style="max-width:100%;height:auto;" /></p>`)
    } catch (e) {
      setMediaError((e as Error).message)
    } finally {
      setUploadingMedia(false)
      if (mediaInputRef.current) mediaInputRef.current.value = ''
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

              <div className="flex flex-col gap-4 border-t border-border pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Welcome email</h3>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Sent once after a new subscriber confirms. Use {'{{name}}'} for personalization.
                  </p>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Subject
                  <input
                    className="modal-input"
                    value={form.welcome_subject}
                    onChange={(e) => setForm({ ...form, welcome_subject: e.target.value })}
                    placeholder="Welcome to Basestack Academy"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Message
                  <div className="overflow-hidden rounded-lg border border-input bg-background">
                    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-2">
                      <WelcomeTool label="Bold" onClick={() => formatWelcome('bold')}><Bold className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Italic" onClick={() => formatWelcome('italic')}><Italic className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Underline" onClick={() => formatWelcome('underline')}><Underline className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Add link" onClick={() => { const url = window.prompt('Paste a link URL'); if (url) formatWelcome('createLink', url) }}><LinkIcon className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Add image" onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia}><ImagePlus className="size-4" /></WelcomeTool>
                      <input ref={mediaInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadWelcomeImage(e.target.files?.[0])} />
                    </div>
                    <div
                      ref={editorRef}
                      className="welcome-editor min-h-[180px] p-4 text-sm leading-6 outline-none"
                      contentEditable
                      data-placeholder="Write your welcome message..."
                      suppressContentEditableWarning
                      onPaste={handleWelcomePaste}
                      onInput={(e) => setForm({ ...form, welcome_html: e.currentTarget.innerHTML })}
                    />
                  </div>
                  {uploadingMedia && <span className="text-xs font-normal text-muted-foreground">Uploading image...</span>}
                  {mediaError && <span className="text-xs font-normal text-destructive">{mediaError}</span>}
                </label>
              </div>

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
          :global(.welcome-editor:empty::before) {
            color: var(--muted-foreground);
            content: attr(data-placeholder);
            pointer-events: none;
          }
        `}</style>
      </ProtectedRoute>
    </AdminShell>
  )
}

function WelcomeTool({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button type="button" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
