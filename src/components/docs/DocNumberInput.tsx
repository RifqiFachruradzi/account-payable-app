import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DocOption {
  id: string
  number: string
  /** keterangan singkat (pekerjaan, vendor, nilai) */
  detail?: string
}

/** Normalisasi nomor dokumen: abaikan besar-kecil huruf, spasi, dan variasi pemisah (- _ . \) */
export const normDocNo = (v: string) => v.toUpperCase().replace(/\s+/g, '').replace(/[-_.\\]/g, '/')

export function findDoc(docs: DocOption[], text: string) {
  const k = normDocNo(text)
  if (!k) return { exact: undefined, partial: [] as DocOption[] }
  const exact = docs.find((d) => normDocNo(d.number) === k)
  const partial = docs.filter((d) => normDocNo(d.number).includes(k) || (d.detail ?? '').toUpperCase().includes(text.trim().toUpperCase()))
  return { exact, partial }
}

const MAX_ITEMS = 8

/** Tebalkan bagian nomor yang cocok dengan ketikan */
function Highlight({ number, query }: { number: string; query: string }) {
  const q = normDocNo(query)
  const n = normDocNo(number)
  const i = q ? n.indexOf(q) : -1
  if (i < 0) return <>{number}</>
  // panjang karakter sama setelah normalisasi (hanya pemisah/spasi yang berubah) — potong teks asli
  return (
    <>
      {number.slice(0, i)}
      <mark className="rounded-sm bg-amber-100 px-0.5 font-semibold text-slate-900">{number.slice(i, i + q.length)}</mark>
      {number.slice(i + q.length)}
    </>
  )
}

/**
 * Kolom nomor dokumen dengan daftar saran: ketik sebagian nomor (mis. "101") → dokumen yang cocok
 * muncul di daftar untuk dipilih. Nomor yang diketik lengkap langsung terhubung.
 */
export function DocNumberInput({ docs, value, onResolve, placeholder }: {
  docs: DocOption[]
  value?: string // id dokumen yang terhubung
  onResolve: (id: string) => void
  placeholder?: string
}) {
  const linked = docs.find((d) => d.id === value)
  const [text, setText] = useState(linked?.number ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Sinkron bila dokumen terhubung berubah dari luar (hasil OCR / tertarik dari dokumen lain)
  useEffect(() => {
    if (linked && normDocNo(text) !== normDocNo(linked.number)) setText(linked.number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked?.id])

  // Tutup daftar saat klik di luar
  useEffect(() => {
    const h = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const { exact, partial } = useMemo(() => findDoc(docs, text), [docs, text])
  const items = partial.slice(0, MAX_ITEMS)
  const showList = open && text.trim().length > 0 && !(exact && linked?.id === exact.id && partial.length === 1)

  useEffect(() => setActive(0), [text])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (d: DocOption) => {
    setText(d.number)
    setOpen(false)
    if (d.id !== value) onResolve(d.id)
  }
  const change = (v: string) => {
    setText(v)
    setOpen(true)
    const r = findDoc(docs, v)
    if (r.exact) {
      if (r.exact.id !== value) onResolve(r.exact.id)
    } else if (value) onResolve('')
  }
  const keyDown = (e: React.KeyboardEvent) => {
    if (!showList || !items.length) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape') setOpen(false)
  }

  const status: 'linked' | 'notfound' | 'idle' = linked ? 'linked' : text.trim() && partial.length === 0 ? 'notfound' : 'idle'

  return (
    <div ref={wrap} className="relative">
      <div className="relative">
        <input
          className={cn(
            'input pr-9 font-mono uppercase placeholder:normal-case',
            status === 'linked' && 'border-emerald-400 bg-emerald-50/40',
            status === 'notfound' && 'border-rose-300 bg-rose-50/40',
          )}
          value={text}
          onChange={(e) => change(e.target.value)}
          onFocus={() => text.trim() && setOpen(true)}
          onKeyDown={keyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
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

      {showList && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-lg">
          {items.length ? (
            <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
              {items.map((d, i) => (
                <li
                  key={d.id}
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(d)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn('cursor-pointer px-3 py-2', i === active ? 'bg-brand-50' : 'hover:bg-slate-50', d.id === value && 'border-l-2 border-emerald-500')}
                >
                  <p className="font-mono text-sm text-slate-800"><Highlight number={d.number} query={text} /></p>
                  {d.detail && <p className="truncate text-xs text-slate-500">{d.detail}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2.5 text-xs text-rose-600">Tidak ada dokumen dengan nomor "{text}"</p>
          )}
          {partial.length > MAX_ITEMS && <p className="border-t border-line bg-slate-50 px-3 py-1.5 text-xs text-slate-500">{partial.length - MAX_ITEMS} dokumen lain — ketik lebih lengkap</p>}
        </div>
      )}

      {!showList && status === 'linked' && linked?.detail && <p className="mt-1 truncate text-xs text-emerald-700">{linked.detail}</p>}
      {!showList && status === 'notfound' && <p className="mt-1 text-xs text-rose-600">Nomor tidak ditemukan di sistem</p>}
    </div>
  )
}
