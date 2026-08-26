/* Updates the initial welcome copy so the academy is not positioned as cloud-only. */

UPDATE settings
SET welcome_html = '<h2 style="margin:0 0 16px;">Welcome to Basestack Academy</h2><p style="margin:0 0 16px;">Hi {{name}},</p><p style="margin:0;">Thanks for joining our technology learning community. We are glad to have you here.</p>'
WHERE id = 1
  AND welcome_html LIKE '%Thanks for confirming your subscription%';
