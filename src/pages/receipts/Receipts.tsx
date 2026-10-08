import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { formatDate, formatIDR } from '@/lib/format'
import { renderReceiptDocument } from '@/lib/documents'
import { Badge, PageHeader, SearchInput } from '@/components/ui'
import { DocPreviewButton } from '@/components/docs/DocPreview'

export default function Receipts() {
  const { grs, settings } = useStore()
  const lk = useLookups()
  const [q, setQ] = useState('')
  const list = grs
    .filter((g) => !q || `${g.number} ${g.description} ${g.receivedBy}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div>
      <PageHeader
        title="Penerimaan (GR / BAST)"
        description="Bukti penerimaan barang (Goods Receipt) dan Berita Acara Serah Terima pekerjaan sebagai dasar 3-way matching tagihan."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Penerimaan' }]}
      />
      <div className="card">
        <div className="flex p-4"><SearchInput value={q} onChange={setQ} className="ml-auto w-full sm:w-72" placeholder="Cari nomor / uraian…" /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">No. Dokumen</th><th className="th">Jenis</th><th className="th">Tanggal</th><th className="th">Uraian</th><th className="th">Rujukan</th><th className="th">Diterima Oleh</th><th className="th text-right">Nilai</th><th className="th" /></tr></thead>
            <tbody>
              {list.map((g) => {
                const spk = lk.spk.get(g.spkId ?? '')
                const po = lk.po.get(g.poId ?? '')
                const vendor = lk.vendor.get(spk?.vendorId ?? po?.vendorId ?? '')
                return (
                  <tr key={g.id} className="hover:bg-slate-50/70">
                    <td className="td font-mono text-xs text-brand-700">{g.number}</td>
                    <td className="td"><Badge tone={g.type === 'BAST' ? 'violet' : 'cyan'}>{g.type}</Badge></td>
                    <td className="td whitespace-nowrap">{formatDate(g.date)}</td>
                    <td className="td">{g.description}<p className="text-xs text-slate-500">{vendor?.name}</p></td>
                    <td className="td font-mono text-xs">
                      {spk ? <Link className="text-brand-700 hover:underline" to={`/spk/${spk.id}`}>{spk.number}</Link> : po ? <Link className="text-brand-700 hover:underline" to={`/po/${po.id}`}>{po.number}</Link> : '-'}
                    </td>
                    <td className="td text-slate-600">{g.receivedBy}</td>
                    <td className="td num">{formatIDR(g.amount)}</td>
                    <td className="td text-right">{vendor && <DocPreviewButton label="Lihat" render={() => renderReceiptDocument(g, vendor, settings, spk?.number ?? po?.number)} fileName={`${g.number.replace(/\//g, '-')}.jpg`} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
