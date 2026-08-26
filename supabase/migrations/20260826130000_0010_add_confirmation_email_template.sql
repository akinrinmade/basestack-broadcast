/* Adds an editable double-opt-in verification email template. */

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS confirmation_subject TEXT NOT NULL DEFAULT 'Confirm your Basestack Academy subscription',
  ADD COLUMN IF NOT EXISTS confirmation_html TEXT NOT NULL DEFAULT '<h2 style="margin:0 0 16px;">Confirm your subscription</h2><p style="margin:0 0 20px;">Click below to join Basestack Academy for practical technology lessons, resources, and updates.</p><p style="margin:0 0 20px;"><a href="{{confirm_url}}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Confirm subscription</a></p><p style="margin:0;color:#71717a;font-size:12px;">If you did not request this, you can ignore this email.</p>';