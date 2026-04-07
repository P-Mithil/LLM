import { useState } from 'react'

import { Button } from './Button'
import { uploadPublicFile } from '../lib/storage'

export function FileUpload({
  label,
  bucket,
  pathPrefix,
  onUploaded,
}: {
  label: string
  bucket: string
  pathPrefix: string
  onUploaded: (url: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload() {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const safeName = file.name.replaceAll(' ', '_')
      const path = `${pathPrefix}/${crypto.randomUUID()}-${safeName}`
      const url = await uploadPublicFile({ bucket, path, file })
      onUploaded(url)
      setFile(null)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        <Button variant="secondary" loading={uploading} onClick={upload} type="button" disabled={!file}>
          Upload
        </Button>
      </div>
      {error ? <div className="text-sm text-rose-700">{error}</div> : null}
    </div>
  )
}

