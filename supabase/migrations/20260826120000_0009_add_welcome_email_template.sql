/*
# Phase 9: Editable welcome email

Adds a single editable welcome template to the settings row. The body is
stored as HTML so the same visual editor can be used for formatting and media.
*/

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS welcome_subject TEXT NOT NULL DEFAULT 'Welcome to Basestack Academy',
  ADD COLUMN IF NOT EXISTS welcome_html TEXT NOT NULL DEFAULT '<h2 style="margin:0 0 16px;">Welcome to Basestack Academy</h2><p style="margin:0 0 16px;">Hi {{name}},</p><p style="margin:0;">Thanks for confirming your subscription. We are glad to have you here.</p>';
