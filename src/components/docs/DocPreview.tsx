import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button, Modal } from '@/components/ui'

/** Tombol "Lihat Dokumen" yang merender dokumen (canvas) lalu menampilkannya + unduh */
export function DocPreviewButton({ render, fileName, label = 'Lihat Dokumen', variant = 'secondary' }: {
  render: () => Promise<string> | string
  fileName: string
  label?: string
  variant?: 'secondary' | 'primary' | 'outline'
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      setSrc(await render())
    } finally {
      setBusy(false)
    }
  }
  const download = () => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = fileName
    a.click()
  }
  return (
    <>
      <Button variant={variant} icon={busy ? Loader2 : FileText} onClick={open} disabled={busy}>{label}</Button>
      <Modal
        open={!!src}
        onClose={() => setSrc(null)}
        size="xl"
        title={fileName}
        description="Dokumen dihasilkan dari data sistem"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSrc(null)}>Tutup</Button>
            <Button icon={Download} onClick={download}>Unduh</Button>
          </>
        }
      >
        {src && <img src={src} alt={fileName} className="mx-auto max-h-[65vh] rounded-lg border border-slate-200 object-contain shadow-sm" />}
      </Modal>
    </>
  )
}
