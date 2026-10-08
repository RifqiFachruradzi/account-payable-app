import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileUp, Handshake, Hourglass, Plus, ShoppingCart, Wallet } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { poValue } from '@/lib/calc'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { importPO, PO_TEMPLATE } from '@/lib/importers'
import { Badge, Button, EmptyState, KpiCard, PageHeader, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import { CsvImportModal } from '@/components/docs/CsvImportModal'
import type { POStatus } from '@/types'

const TABS: (POStatus | 'Semua')[] = ['Semua', 'Draft', 'Menunggu Konfirmasi Vendor', 'Open', 'Partial Received', 'Received', 'Closed', 'Cancelled']

export default function PoList() {
  const { pos, prs, vendors, spks, importDocs, notify } = useStore()
  const lk = useLookups()
  const me = useCurrentUser()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as POStatus | null) ?? 'Semua'
  const [q, setQ] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const list = useMemo(
    () =>
      pos
        .filter((p) => status === 'Semua' || p.status === status)
        .filter((p) => !q || `${p.number} ${lk.vendor.get(p.vendorId)?.name} ${lk.pr.get(p.prId ?? '')?.number} ${lk.pr.get(p.prId ?? '')?.purpose}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [pos, status, q, lk],
  )
  const active = pos.filter((p) => !['Cancelled', 'Draft'].includes(p.status))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Order (PO)"
        description="Pesanan pembelian barang / jasa yang diterbitkan Perusahaan kepada Vendor — berlaku setelah disetujui Perusahaan dan dikonfirmasi Vendor."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Purchase Order' }]}
        actions={
          <>
            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button icon={Plus} onClick={() => nav('/po/new')}>Buat PO</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Nilai PO Aktif" value={formatCompact(active.reduce((s, p) => s + poValue(p), 0))} hint={`${active.length} PO`} icon={Wallet} />
        <KpiCard label="Menunggu Persetujuan" value={pos.filter((p) => p.status === 'Draft').length} hint="Draft — perlu persetujuan perusahaan" icon={Hourglass} tone="amber" />
        <KpiCard label="Menunggu Konfirmasi Vendor" value={pos.filter((p) => p.status === 'Menunggu Konfirmasi Vendor').length} hint="Sudah disetujui perusahaan" icon={Handshake} tone="violet" />
        <KpiCard label="PO Open" value={pos.filter((p) => p.status === 'Open' || p.status === 'Partial Received').length} hint="Berjalan / menunggu penerimaan" icon={ShoppingCart} tone="emerald" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
          <Tabs
            value={status}
            onChange={(v) => setParams(v === 'Semua' ? {} : { status: v }, { replace: true })}
            tabs={TABS.map((t) => ({ value: t, label: t === 'Menunggu Konfirmasi Vendor' ? 'Konfirmasi Vendor' : t, count: t === 'Semua' ? pos.length : pos.filter((p) => p.status === t).length }))}
          />
          <SearchInput value={q} onChange={setQ} className="mb-2 ml-auto w-full sm:w-72" placeholder="Cari no. PO, vendor, PR…" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. PO</th>
                <th className="th">Vendor</th>
                <th className="th">Rujukan PR</th>
                <th className="th">Tanggal</th>
                <th className="th">Tgl Kirim</th>
                <th className="th text-right">Nilai (DPP)</th>
                <th className="th text-right">Total + PPN</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pr = lk.pr.get(p.prId ?? '')
                const v = poValue(p)
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/po/${p.id}`)}>
                    <td className="td">
                      <p className="font-mono text-xs text-brand-700">{p.number}</p>
                      {p.source === 'Import CSV' && <Badge className="mt-0.5">CSV</Badge>}
                    </td>
                    <td className="td max-w-64"><p className="truncate font-medium text-slate-800">{lk.vendor.get(p.vendorId)?.name}</p><p className="text-xs text-slate-500">{p.items.length} item • Buyer {p.buyer}</p></td>
                    <td className="td max-w-56">{pr ? <><p className="font-mono text-xs text-slate-600">{pr.number}</p><p className="truncate text-xs text-slate-500">{pr.purpose}</p></> : <span className="text-slate-300">—</span>}</td>
                    <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDate(p.deliveryDate)}</td>
                    <td className="td num">{formatIDR(v)}</td>
                    <td className="td num font-medium">{formatIDR(v * (1 + p.ppnRate / 100))}</td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState title="Belum ada PO" />}
        </div>
      </div>

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Purchase Order dari CSV"
        template={PO_TEMPLATE}
        parse={(rows) => importPO(rows, { vendors, prs, pos, spks, userName: me.name })}
        columns={[
          { label: 'No. PO', render: (d) => <span className="font-mono">{d.number}</span> },
          { label: 'Vendor', render: (d) => lk.vendor.get(d.vendorId)?.name },
          { label: 'PR', render: (d) => lk.pr.get(d.prId ?? '')?.number ?? '—' },
          { label: 'Item', render: (d) => d.items.length, className: 'text-right' },
          { label: 'Nilai', render: (d) => formatIDR(poValue(d)), className: 'text-right whitespace-nowrap' },
          { label: 'Status', render: (d) => <StatusBadge status={d.status} /> },
        ]}
        onImport={(docs) => {
          importDocs({ pos: docs })
          notify({ type: 'success', title: `${docs.length} PO berhasil diimport` })
        }}
      />
    </div>
  )
}
