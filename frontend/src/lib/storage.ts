import { supabase } from './supabaseClient'

export async function uploadPublicFile(params: {
  bucket: string
  path: string
  file: File
}): Promise<string> {
  const { bucket, path, file } = params

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  if (!data.publicUrl) throw new Error('Could not build public URL for uploaded file')
  return data.publicUrl
}

