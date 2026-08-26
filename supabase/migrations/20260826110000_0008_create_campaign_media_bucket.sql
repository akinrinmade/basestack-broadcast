/*
# Phase 8: Campaign media

Creates a public image bucket for media embedded in campaign HTML. Uploads
remain restricted to authenticated users; public reads are required because
email clients cannot authenticate when loading an image.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campaign-media', 'campaign-media', true, 5242880, ARRAY['image/*']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authenticated_upload_campaign_media" ON storage.objects;
CREATE POLICY "authenticated_upload_campaign_media"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-media');

DROP POLICY IF EXISTS "public_read_campaign_media" ON storage.objects;
CREATE POLICY "public_read_campaign_media"
  ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'campaign-media');

DROP POLICY IF EXISTS "authenticated_delete_campaign_media" ON storage.objects;
CREATE POLICY "authenticated_delete_campaign_media"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-media');
