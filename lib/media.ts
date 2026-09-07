import { supabase } from '@/lib/supabase/client'
import type { CampaignMedia } from '@/lib/types'

const BUCKET = 'campaign-media'
const FOLDER = 'campaign-media'

export async function listCampaignMedia(): Promise<CampaignMedia[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((item) => !!item.name && !item.name.endsWith('/'))
    .map((item) => {
      const path = `${FOLDER}/${item.name}`
      return { name: item.name, path, publicUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, createdAt: item.created_at ?? undefined }
    })
}

export async function uploadCampaignMedia(file: File): Promise<CampaignMedia> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.')
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${FOLDER}/${crypto.randomUUID()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return { name: file.name, path, publicUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

export async function deleteCampaignMedia(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
