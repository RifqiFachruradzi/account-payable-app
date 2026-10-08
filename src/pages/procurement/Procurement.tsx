import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { itemsTotal, poValue } from '@/lib/calc'
import { formatDate, formatIDR } from '@/lib/format'
import { Badge, PageHeader, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import type { LineItem } from '@/types'
import { cn } from '@/lib/cn'

type Tab = 'pr' | 'po' | 'gr'

function Items({ items, ppnRate }: { items: LineItem[]; ppnRate?: number }) {
  const sub = itemsTotal(items)
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead>
          <tr><th className="th">Item</th><th className="th text-right">Qty</th><th className="th text-right">Harga Satuan</th><th className="th text-right">Jumlah</th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="td">{i.description}</td>
              <td className="td num">{i.qty.toLocaleString('id-ID')} {i.unit}</td>
              <td className="td num">{formatIDR(i.unitPrice)}</td>
              <td className="td num">{formatIDR(i.qty * i.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td className="td text-right font-medium" colSpan={3}>Subtotal</td><td className="td num font-medium">{formatIDR(sub)}</td></tr>
          {ppnRate !== undefined && (
            <>
              <tr><td className="td text-right text-slate-500" colSpan={3}>PPN {ppnRate}%</td><td className="td num text-slate-500">{formatIDR((sub * ppnRate) / 100)}</td></tr>
              <tr><td className="td text-right font-semibold" colSpan={3}>Total</td><td className="td num font-semibold">{formatIDR(sub * (1 + ppnRate / 100))}</td></tr>
            </>
          )}
        </tfoot>
      </table>
    </div>
  )
}

export default function Procurement() {
  const { prs, pos, grs, spks } = useStore()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'pr'
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const k = q.toLowerCase()

  return (
    <div>
      <PageHeader
        title="Dokumen Pengadaan (PR & PO)"
        description="Data Purchase Requisition, Purchase Order dan penerimaan (GR/BAST) yang ditarik dari sistem pengadaan perusahaan sebagai rujukan pembayaran."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'PR & PO' }]}
      />
      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
          <Tabs
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            tabs={[
              { value: 'pr', label: 'Purchase Requisition', count: prs.length },
              { value: 'po', label: 'Purchase Order', count: pos.length },
              { value: 'gr', label: 'Penerimaan (GR / BAST)', count: grs.length },
            ]}
          />
          <SearchInput value={q} onChange={setQ} className="mb-2 ml-auto w-full sm:w-72" placeholder="Cari nomor / keterangan…" />
        </div>
        <div className="overflow-x-auto">
          {tab === 'pr' && (
            <table className="w-full">
              <thead>
                <tr><th className="th w-8" /><th className="th">No. PR</th><th className="th">Tanggal</th><th className="th">Keperluan</th><th className="th">Departemen / Pemohon</th><th className="th">Cost Center</th><th className="th text-right">Estimasi Nilai</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {prs
                  .filter((p) => !k || `${p.number} ${p.purpose} ${p.department} ${p.requester}`.toLowerCase().includes(k))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => (
                    <Fragment key={p.id}>
                      <tr className="cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(open === p.id ? null : p.id)}>
                        <td className="td"><ChevronRight className={cn('size-4 text-slate-400 transition', open === p.id && 'rotate-90')} /></td>
                        <td className="td font-mono text-xs text-brand-700">{p.number}</td>
                        <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                        <td className="td font-medium text-slate-800">{p.purpose}</td>
                        <td className="td text-slate-600">{p.department}<br /><span className="text-xs text-slate-500">{p.requester}</span></td>
                        <td className="td font-mono text-xs">{p.costCenter}</td>
                        <td className="td num">{formatIDR(itemsTotal(p.items))}</td>
                        <td className="td"><StatusBadge status={p.status} /></td>
                      </tr>
                      {open === p.id && <tr><td colSpan={8} className="bg-slate-50 p-4"><Items items={p.items} /></td></tr>}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          )}
          {tab === 'po' && (
            <table className="w-full">
              <thead>
                <tr><th className="th w-8" /><th className="th">No. PO</th><th className="th">Tanggal</th><th className="th">Vendor</th><th className="th">Rujukan PR / SPK</th><th className="th">Tgl Kirim</th><th className="th text-right">Nilai (DPP)</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {pos
                  .filter((p) => !k || `${p.number} ${lk.vendor.get(p.vendorId)?.name} ${lk.pr.get(p.prId)?.purpose}`.toLowerCase().includes(k))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => {
                    const spk = spks.find((s) => s.poId === p.id)
                    return (
                      <Fragment key={p.id}>
                        <tr className="cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(open === p.id ? null : p.id)}>
                          <td className="td"><ChevronRight className={cn('size-4 text-slate-400 transition', open === p.id && 'rotate-90')} /></td>
                          <td className="td font-mono text-xs text-brand-700">{p.number}</td>
                          <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                          <td className="td font-medium text-slate-800">{lk.vendor.get(p.vendorId)?.name}<br /><span className="text-xs font-normal text-slate-500">{lk.pr.get(p.prId)?.purpose}</span></td>
                          <td className="td font-mono text-xs text-slate-600">
                            {lk.pr.get(p.prId)?.number}
                            {spk && <Link onClick={(e) => e.stopPropagation()} to={`/spk/${spk.id}`} className="block text-brand-700 hover:underline">{spk.number}</Link>}
                          </td>
                          <td className="td whitespace-nowrap">{formatDate(p.deliveryDate)}</td>
                          <td className="td num font-medium">{formatIDR(poValue(p))}</td>
                          <td className="td"><StatusBadge status={p.status} /></td>
                        </tr>
                        {open === p.id && <tr><td colSpan={8} className="bg-slate-50 p-4"><Items items={p.items} ppnRate={p.ppnRate} /></td></tr>}
                      </Fragment>
                    )
                  })}
              </tbody>
            </table>
          )}
          {tab === 'gr' && (
            <table className="w-full">
              <thead>
                <tr><th className="th">No. Dokumen</th><th className="th">Jenis</th><th className="th">Tanggal</th><th className="th">Uraian</th><th className="th">Rujukan</th><th className="th">Diterima Oleh</th><th className="th text-right">Nilai</th></tr>
              </thead>
              <tbody>
                {grs
                  .filter((g) => !k || `${g.number} ${g.description}`.toLowerCase().includes(k))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70">
                      <td className="td font-mono text-xs text-brand-700">{g.number}</td>
                      <td className="td"><Badge tone={g.type === 'BAST' ? 'violet' : 'cyan'}>{g.type}</Badge></td>
                      <td className="td whitespace-nowrap">{formatDate(g.date)}</td>
                      <td className="td">{g.description}</td>
                      <td className="td font-mono text-xs text-slate-600">{lk.spk.get(g.spkId ?? '')?.number ?? lk.po.get(g.poId ?? '')?.number}</td>
                      <td className="td text-slate-600">{g.receivedBy}</td>
                      <td className="td num">{formatIDR(g.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
