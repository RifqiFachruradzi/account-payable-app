import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, FileUp, Hourglass, Plus, ShoppingCart } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { itemsTotal } from '@/lib/calc'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { importPR, PR_TEMPLATE } from '@/lib/importers'
import { Badge, Button, EmptyState, KpiCard, PageHeader, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import { CsvImportModal } from '@/components/docs/CsvImportModal'
import type { PRStatus } from '@/types'

const TABS: (PRStatus | 'Semua')[] = ['Semua', 'Draft', 'Diajukan', 'Disetujui', 'Diproses PO', 'Ditolak']

export default function PrList() {
  const { prs, pos, vendors, spks, importDocs, notify } = useStore()
  const me = useCurrentUser()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as PRStatus | null) ?? 'Semua'
  const [q, setQ] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const list = useMemo(
    () =>
      prs
        .filter((p) => status === 'Semua' || p.status === status)
        .filter((p) => !q || `${p.number} ${p.purpose} ${p.department} ${p.requester} ${p.costCenter}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [prs, status, q],
  )

  const pending = prs.filter((p) => p.status === 'Diajukan')
  const approvedNoPo = prs.filter((p) => p.status === 'Disetujui')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Request (PR)"
        description="Permintaan pembelian barang / jasa yang diterbitkan User (departemen) kepada bagian Procurement."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Purchase Request' }]}
        actions={
          <>
            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button icon={Plus} onClick={() => nav('/pr/new')}>Buat PR</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total PR" value={prs.length} hint={`${prs.filter((p) => p.status === 'Draft').length} draft`} icon={ClipboardList} />
        <KpiCard label="Menunggu Persetujuan" value={pending.length} hint={formatCompact(pending.reduce((s, p) => s + itemsTotal(p.items), 0))} icon={Hourglass} tone="amber" />
        <KpiCard label="Disetujui — Belum PO" value={approvedNoPo.length} hint={formatCompact(approvedNoPo.reduce((s, p) => s + itemsTotal(p.items), 0))} icon={ClipboardCheck} tone="violet" />
        <KpiCard label="Sudah Diproses PO" value={prs.filter((p) => p.status === 'Diproses PO' || p.status === 'Selesai').length} hint={`${pos.length} PO terbit`} icon={ShoppingCart} tone="emerald" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
          <Tabs
            value={status}
            onChange={(v) => setParams(v === 'Semua' ? {} : { status: v }, { replace: true })}
            tabs={TABS.map((t) => ({ value: t, label: t, count: t === 'Semua' ? prs.length : prs.filter((p) => p.status === t).length }))}
          />
          <SearchInput value={q} onChange={setQ} className="mb-2 ml-auto w-full sm:w-72" placeholder="Cari no. PR, keperluan, departemen…" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. PR</th>
                <th className="th">Keperluan</th>
                <th className="th">Departemen / Pemohon</th>
                <th className="th">Tanggal</th>
                <th className="th">Dibutuhkan</th>
                <th className="th text-right">Estimasi Nilai</th>
                <th className="th">PO</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const prPos = pos.filter((o) => o.prId === p.id)
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/pr/${p.id}`)}>
                    <td className="td">
                      <p className="font-mono text-xs text-brand-700">{p.number}</p>
                      {p.source === 'Import CSV' && <Badge className="mt-0.5">CSV</Badge>}
                    </td>
                    <td className="td max-w-72">
                      <p className="truncate font-medium text-slate-800">{p.purpose}</p>
                      <p className="text-xs text-slate-500">{p.items.length} item • {p.costCenter}</p>
                    </td>
                    <td className="td text-slate-600">{p.department}<br /><span className="text-xs text-slate-500">{p.requester}</span></td>
                    <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDate(p.neededDate)}</td>
                    <td className="td num font-medium">{formatIDR(itemsTotal(p.items))}</td>
                    <td className="td font-mono text-xs text-slate-600">{prPos.map((o) => <p key={o.id}>{o.number}</p>)}{!prPos.length && <span className="text-slate-300">—</span>}</td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState title="Belum ada PR" action={<Button icon={Plus} onClick={() => nav('/pr/new')}>Buat PR</Button>} />}
        </div>
      </div>

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Purchase Request dari CSV"
        template={PR_TEMPLATE}
        parse={(rows) => importPR(rows, { vendors, prs, pos, spks, userName: me.name })}
        columns={[
          { label: 'No. PR', render: (d) => <span className="font-mono">{d.number}</span> },
          { label: 'Keperluan', render: (d) => d.purpose },
          { label: 'Departemen', render: (d) => `${d.department} • ${d.requester}` },
          { label: 'Item', render: (d) => d.items.length, className: 'text-right' },
          { label: 'Estimasi', render: (d) => formatIDR(itemsTotal(d.items)), className: 'text-right whitespace-nowrap' },
        ]}
        onImport={(docs) => {
          importDocs({ prs: docs })
          notify({ type: 'success', title: `${docs.length} PR berhasil diimport`, message: 'Status: Diajukan — menunggu persetujuan.' })
        }}
      />
    </div>
  )
}
