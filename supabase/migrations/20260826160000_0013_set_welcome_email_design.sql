/* Sets the current welcome email design for accounts still using the starter template. */

UPDATE settings
SET welcome_html = '<div style="text-align:center;"><h1 style="margin:0 0 12px;color:#18181b;font-size:30px;">Welcome to Basestack Academy</h1><p style="margin:0 0 24px;color:#71717a;font-size:16px;">Practical ideas, useful resources, and updates for your growth.</p><p style="text-align:left;margin:0 0 16px;">Hi {{name}},</p><p style="text-align:left;margin:0 0 16px;">Thanks for joining the Basestack Academy community. You are now subscribed to receive our latest updates, learning resources, and opportunities.</p><p style="text-align:left;margin:0 0 24px;">We are excited to have you with us. Keep an eye on your inbox.</p><p style="margin:0 0 24px;"><a href="https://basestack-broadcast.vercel.app" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Visit Basestack Academy</a></p><p style="margin:0;color:#71717a;font-size:13px;">Thanks for being part of the community.</p></div>'
WHERE id = 1
  AND (welcome_html LIKE '%Thanks for confirming your subscription%'
    OR welcome_html LIKE '%Thanks for joining our technology learning community%');
