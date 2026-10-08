import { Plus, Trash2 } from 'lucide-react'
import type { LineItem } from '@/types'
import { uid } from '@/lib/id'
import { formatIDR } from '@/lib/format'

export const newItem = (): LineItem => ({ id: uid('li'), description: '', qty: 1, unit: 'Unit', unitPrice: 0 })

/** Tabel item barang/jasa yang dapat diedit */
export function ItemsEditor({ items, onChange, priceLabel = 'Harga Satuan', ppnRate }: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  priceLabel?: string
  ppnRate?: number
}) {
  const set = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const sub = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              <th className="th">Uraian Barang / Jasa</th>
              <th className="th w-24 text-right">Qty</th>
              <th className="th w-28">Satuan</th>
              <th className="th w-44 text-right">{priceLabel}</th>
              <th className="th w-40 text-right">Jumlah</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className="td text-slate-400">{i + 1}</td>
                <td className="td"><input className="input" value={it.description} onChange={(e) => set(it.id, { description: e.target.value })} placeholder="Nama barang / jasa" /></td>
                <td className="td"><input type="number" min={0} step="any" className="input text-right" value={it.qty} onChange={(e) => set(it.id, { qty: +e.target.value })} /></td>
                <td className="td"><input className="input" value={it.unit} onChange={(e) => set(it.id, { unit: e.target.value })} /></td>
                <td className="td"><input type="number" min={0} className="input text-right" value={it.unitPrice || ''} onChange={(e) => set(it.id, { unitPrice: +e.target.value })} /></td>
                <td className="td num font-medium">{formatIDR(it.qty * it.unitPrice)}</td>
                <td className="td">
                  <button type="button" disabled={items.length === 1} onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label="Hapus item">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <button type="button" onClick={() => onChange([...items, newItem()])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
          <Plus className="size-4" /> Tambah Item
        </button>
        <dl className="w-72 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatIDR(sub)}</dd></div>
          {ppnRate !== undefined && (
            <>
              <div className="flex justify-between"><dt className="text-slate-500">PPN {ppnRate}%</dt><dd className="tabular-nums">{formatIDR((sub * ppnRate) / 100)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatIDR(sub * (1 + ppnRate / 100))}</dd></div>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
