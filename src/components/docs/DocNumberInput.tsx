import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DocOption {
  id: string
  number: string
  /** keterangan singkat yang tampil setelah dokumen terbaca */
  detail?: string
}

/** Normalisasi nomor dokumen: abaikan besar-kecil huruf, spasi, dan variasi pemisah (- _ . \) */
export const normDocNo = (v: string) => v.toUpperCase().replace(/\s+/g, '').replace(/[-_.\\]/g, '/')

export function findDoc(docs: DocOption[], text: string) {
  const k = normDocNo(text)
  if (!k) return { exact: undefined, partial: [] as DocOption[] }
  const exact = docs.find((d) => normDocNo(d.number) === k)
  const partial = k.length >= 3 ? docs.filter((d) => normDocNo(d.number).includes(k)) : []
  return { exact, partial }
}

/**
 * Kolom nomor dokumen yang diketik (bukan dipilih). Dokumen terbaca otomatis bila nomornya
 * cocok persis; bila ketikan hanya sebagian dan cocok dengan satu dokumen, nomor dilengkapi saat
 * kolom ditinggalkan.
 */
export function DocNumberInput({ docs, value, onResolve, placeholder, highlight }: {
  docs: DocOption[]
  value?: string // id dokumen yang sedang terhubung
  onResolve: (id: string) => void
  placeholder?: string
  highlight?: boolean
}) {
  const linked = docs.find((d) => d.id === value)
  const [text, setText] = useState(linked?.number ?? '')

  // Sinkron bila dokumen terhubung berubah dari luar (hasil OCR / tertarik dari dokumen lain)
  useEffect(() => {
    if (linked && normDocNo(text) !== normDocNo(linked.number)) setText(linked.number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked?.id])

  const { exact, partial } = useMemo(() => findDoc(docs, text), [docs, text])

  const change = (v: string) => {
    setText(v)
    const r = findDoc(docs, v)
    if (r.exact) {
      if (r.exact.id !== value) onResolve(r.exact.id)
    } else if (value) onResolve('')
  }
  const blur = () => {
    if (!exact && partial.length === 1) {
      setText(partial[0].number)
      onResolve(partial[0].id)
    }
  }

  const status: 'linked' | 'notfound' | 'ambiguous' | 'idle' = linked
    ? 'linked'
    : !text.trim()
      ? 'idle'
      : partial.length > 1
        ? 'ambiguous'
        : partial.length === 1
          ? 'idle'
          : 'notfound'

  return (
    <div>
      <div className="relative">
        <input
          className={cn(
            'input pr-9 font-mono uppercase placeholder:normal-case',
            status === 'linked' && 'border-emerald-400 bg-emerald-50/40',
            status === 'notfound' && 'border-rose-300 bg-rose-50/40',
            highlight && status === 'linked' && 'border-emerald-300',
          )}
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={blur}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {status === 'linked' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : status === 'notfound' ? (
            <AlertCircle className="size-4 text-rose-500" />
          ) : (
            <Search className="size-4 text-slate-400" />
          )}
        </span>
      </div>
      {status === 'linked' && linked?.detail && <p className="mt-1 truncate text-xs text-emerald-700">{linked.detail}</p>}
      {status === 'notfound' && <p className="mt-1 text-xs text-rose-600">Nomor tidak ditemukan di sistem</p>}
      {status === 'ambiguous' && <p className="mt-1 text-xs text-amber-700">{partial.length} dokumen cocok — ketik nomor lebih lengkap</p>}
      {status === 'idle' && partial.length === 1 && <p className="mt-1 text-xs text-slate-500">Maksud Anda <b className="font-mono">{partial[0].number}</b>? Tinggalkan kolom untuk melengkapi.</p>}
    </div>
  )
}
