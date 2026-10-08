import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Render seluruh halaman PDF dengan PDF.js (tidak bergantung pada viewer PDF bawaan browser) */
export function PdfViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ loading: boolean; pages: number; error?: string }>({ loading: true, pages: 0 })

  useEffect(() => {
    let cancelled = false
    const el = host.current!
    el.innerHTML = ''
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        const doc = await pdfjs.getDocument({ url }).promise
        const total = Math.min(doc.numPages, 30)
        const width = el.clientWidth || 800
        for (let i = 1; i <= total && !cancelled; i++) {
          const page = await doc.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const ratio = window.devicePixelRatio || 1
          const viewport = page.getViewport({ scale: (width / base.width) * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.className = 'mb-3 rounded-md border border-slate-200 bg-white shadow-sm'
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
          if (!cancelled) el.appendChild(canvas)
        }
        if (!cancelled) setState({ loading: false, pages: doc.numPages })
      } catch (e) {
        console.error('PdfViewer', e)
        if (!cancelled) setState({ loading: false, pages: 0, error: 'PDF tidak dapat ditampilkan. Gunakan tombol Unduh.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="mx-auto max-w-3xl">
      {state.loading && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Memuat PDF…</p>
      )}
      {state.error && <p className="py-10 text-center text-sm text-rose-600">{state.error}</p>}
      <div ref={host} />
      {state.pages > 30 && <p className="text-center text-xs text-slate-500">Menampilkan 30 dari {state.pages} halaman — unduh untuk melihat seluruhnya.</p>}
    </div>
  )
}
