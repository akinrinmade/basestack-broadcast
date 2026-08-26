'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Check, ImagePlus, Italic, Link as LinkIcon, Settings2, Underline } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { fetchSettings, saveSettings } from '@/lib/settings'
import { supabase } from '@/lib/supabase/client'
import type { EmailTheme, Settings } from '@/lib/types'

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
    confirmation_subject: '',
    confirmation_html: '',
    email_theme: 'clean' as EmailTheme,
  })
  const editorRef = useRef<HTMLDivElement>(null)
  const confirmationEditorRef = useRef<HTMLDivElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const confirmationMediaInputRef = useRef<HTMLInputElement>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<'welcome' | 'confirmation' | null>(null)
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
          confirmation_subject: s.confirmation_subject ?? 'Confirm your Basestack Academy subscription',
          confirmation_html: s.confirmation_html ?? '',
          email_theme: s.email_theme ?? 'clean',
        })
        if (editorRef.current) editorRef.current.innerHTML = s.welcome_html ?? ''
        if (confirmationEditorRef.current) confirmationEditorRef.current.innerHTML = s.confirmation_html ?? ''
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
        confirmation_subject: form.confirmation_subject.trim() || 'Confirm your Basestack Academy subscription',
        confirmation_html: form.confirmation_html.trim(),
        email_theme: form.email_theme,
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
    const html = clipboardHtml || extractPastedHtml(clipboardText)
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

  function formatConfirmation(command: string, value?: string) {
    confirmationEditorRef.current?.focus()
    document.execCommand(command, false, value)
    setForm((current) => ({ ...current, confirmation_html: confirmationEditorRef.current?.innerHTML ?? '' }))
  }

  function handleConfirmationPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboardHtml = event.clipboardData.getData('text/html')
    const clipboardText = event.clipboardData.getData('text/plain')
    const html = clipboardHtml || extractPastedHtml(clipboardText)
    if (!html) return
    event.preventDefault()
    confirmationEditorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    setForm((current) => ({ ...current, confirmation_html: confirmationEditorRef.current?.innerHTML ?? '' }))
  }

  async function uploadConfirmationImage(file: File | undefined) {
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
      const { error } = await supabase.storage.from('campaign-media').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('campaign-media').getPublicUrl(path)
      formatConfirmation('insertHTML', `<p><img src="${data.publicUrl}" alt="${file.name.replace(/"/g, '')}" style="max-width:100%;height:auto;" /></p>`)
    } catch (e) {
      setMediaError((e as Error).message)
    } finally {
      setUploadingMedia(false)
      if (confirmationMediaInputRef.current) confirmationMediaInputRef.current.value = ''
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

              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Email theme</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Choose the look used by verification and welcome emails.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EMAIL_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={`rounded-lg border p-2 text-left transition ${form.email_theme === theme.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                      onClick={() => setForm({ ...form, email_theme: theme.id })}
                    >
                      <span className="block h-8 rounded" style={{ background: theme.page, borderTop: `5px solid ${theme.accent}` }} />
                      <span className="mt-2 block text-xs font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

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
                      <button type="button" className="ml-2 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => setPreviewTemplate(previewTemplate === 'welcome' ? null : 'welcome')}>Preview</button>
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
                  {previewTemplate === 'welcome' && <TemplatePreview html={form.welcome_html} name="there" theme={form.email_theme} />}
                </label>
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-5">
                <div>
                  <h3 className="text-sm font-semibold">Verification email</h3>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Sent when someone registers. Include {'{{confirm_url}}'} in a link so they can verify.
                  </p>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Subject
                  <input className="modal-input" value={form.confirmation_subject} onChange={(e) => setForm({ ...form, confirmation_subject: e.target.value })} placeholder="Confirm your subscription" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Message
                  <div className="overflow-hidden rounded-lg border border-input bg-background">
                    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-2">
                      <WelcomeTool label="Bold" onClick={() => formatConfirmation('bold')}><Bold className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Italic" onClick={() => formatConfirmation('italic')}><Italic className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Underline" onClick={() => formatConfirmation('underline')}><Underline className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Add link" onClick={() => { const url = window.prompt('Paste a link URL'); if (url) formatConfirmation('createLink', url) }}><LinkIcon className="size-4" /></WelcomeTool>
                      <WelcomeTool label="Add image" onClick={() => confirmationMediaInputRef.current?.click()} disabled={uploadingMedia}><ImagePlus className="size-4" /></WelcomeTool>
                      <button type="button" className="ml-2 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => setPreviewTemplate(previewTemplate === 'confirmation' ? null : 'confirmation')}>Preview</button>
                      <input ref={confirmationMediaInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadConfirmationImage(e.target.files?.[0])} />
                    </div>
                    <div ref={confirmationEditorRef} className="welcome-editor min-h-[180px] p-4 text-sm leading-6 outline-none" contentEditable data-placeholder="Write your verification message..." suppressContentEditableWarning onPaste={handleConfirmationPaste} onInput={(e) => setForm({ ...form, confirmation_html: e.currentTarget.innerHTML })} />
                  </div>
                  {previewTemplate === 'confirmation' && <TemplatePreview html={form.confirmation_html} name="there" theme={form.email_theme} />}
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

function extractPastedHtml(text: string): string {
  const trimmed = text.trim()
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) return ''

  // Strip document-level wrappers because the editor only needs the body content.
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return (bodyMatch?.[1] ?? trimmed)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .trim()
}

const EMAIL_THEMES: { id: EmailTheme; label: string; page: string; accent: string }[] = [
  { id: 'clean', label: 'Clean', page: '#f4f4f5', accent: '#18181b' },
  { id: 'sunset', label: 'Sunset', page: '#fff1e8', accent: '#d3542a' },
  { id: 'forest', label: 'Forest', page: '#edf6ef', accent: '#19734a' },
  { id: 'ocean', label: 'Ocean', page: '#eaf6f8', accent: '#087f8c' },
]

function TemplatePreview({ html, name, theme }: { html: string; name: string; theme: EmailTheme }) {
  const rendered = html.replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{\{\s*confirm_url\s*\}\}/gi, 'https://example.com/confirm')
  const selectedTheme = EMAIL_THEMES.find((item) => item.id === theme) ?? EMAIL_THEMES[0]
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border p-3" style={{ background: selectedTheme.page }}>
      <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">Live email preview</div>
      <div className="mx-auto mt-3 max-h-80 max-w-xl overflow-y-auto rounded-lg border-t-4 bg-white p-5" style={{ borderColor: selectedTheme.accent }} dangerouslySetInnerHTML={{ __html: rendered || '<p style="color:#71717a;">Nothing to preview yet.</p>' }} />
    </div>
  )
}
