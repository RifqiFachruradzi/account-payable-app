import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileSignature, Hourglass, Receipt, Wallet } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { spkBilled, spkPaid } from '@/lib/calc'
import { daysOverdue } from '@/lib/dates'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { exportCSV } from '@/lib/export'
import { Badge, Button, KpiCard, PageHeader, Progress, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import type { SPKStatus } from '@/types'

export default function SpkList() {
  const { spks, invoices } = useStore()
  const lk = useLookups()
  const nav = useNavigate()
  const [tab, setTab] = useState<'outstanding' | SPKStatus | 'all'>('outstanding')
  const [q, setQ] = useState('')

  const rows = useMemo(
    () =>
      spks.map((s) => {
        const billed = spkBilled(s, invoices)
        const paid = spkPaid(s, invoices)
        return { s, billed, paid, remaining: s.contractValue - billed, unpaid: billed - paid }
      }),
    [spks, invoices],
  )

  const filtered = rows
    .filter((r) => (tab === 'all' ? true : tab === 'outstanding' ? r.remaining > 0 && r.s.status !== 'Dibatalkan' : r.s.status === tab))
    .filter((r) => !q || `${r.s.number} ${r.s.title} ${lk.vendor.get(r.s.vendorId)?.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.remaining - a.remaining)

  const tot = rows.reduce((t, r) => ({ c: t.c + r.s.contractValue, b: t.b + r.billed, p: t.p + r.paid, r: t.r + Math.max(0, r.remaining) }), { c: 0, b: 0, p: 0, r: 0 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surat Perintah Kerja (SPK)"
        description="Monitoring nilai kontrak, progres pekerjaan, realisasi tagihan dan sisa outstanding SPK."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'SPK' }]}
        actions={
          <Button
            variant="secondary"
            icon={Download}
            onClick={() =>
              exportCSV(
                'spk-outstanding.csv',
                filtered.map((r) => ({
                  'No. SPK': r.s.number,
                  Pekerjaan: r.s.title,
                  Vendor: lk.vendor.get(r.s.vendorId)?.name,
                  Mulai: r.s.startDate,
                  Selesai: r.s.endDate,
                  'Nilai Kontrak': r.s.contractValue,
                  'Progres %': r.s.progress,
                  Tertagih: r.billed,
                  Dibayar: r.paid,
                  'Sisa Outstanding': r.remaining,
                  Status: r.s.status,
                })),
              )
            }
          >
            Export CSV
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Nilai Kontrak" value={formatCompact(tot.c)} hint={`${spks.length} SPK`} icon={FileSignature} />
        <KpiCard label="Sudah Ditagih Vendor" value={formatCompact(tot.b)} hint={`${Math.round((tot.b / tot.c) * 100)}% dari kontrak`} icon={Receipt} tone="cyan" />
        <KpiCard label="Sudah Dibayar" value={formatCompact(tot.p)} hint={`${Math.round((tot.p / tot.c) * 100)}% dari kontrak`} icon={Wallet} tone="emerald" />
        <KpiCard label="Sisa SPK Outstanding" value={formatCompact(tot.r)} hint="Belum ditagihkan" icon={Hourglass} tone="violet" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'outstanding', label: 'Outstanding', count: rows.filter((r) => r.remaining > 0 && r.s.status !== 'Dibatalkan').length },
              { value: 'Berjalan', label: 'Berjalan', count: rows.filter((r) => r.s.status === 'Berjalan').length },
              { value: 'Selesai', label: 'Selesai', count: rows.filter((r) => r.s.status === 'Selesai').length },
              { value: 'all', label: 'Semua', count: rows.length },
            ]}
          />
          <SearchInput value={q} onChange={setQ} className="mb-2 ml-auto w-full sm:w-72" placeholder="Cari SPK / vendor…" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. SPK / Pekerjaan</th>
                <th className="th">Vendor</th>
                <th className="th">Periode</th>
                <th className="th">Progres Fisik</th>
                <th className="th">Realisasi Tagihan</th>
                <th className="th text-right">Nilai Kontrak</th>
                <th className="th text-right">Sisa Outstanding</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ s, billed, paid, remaining }) => {
                const late = s.status === 'Berjalan' && daysOverdue(s.endDate) > 0
                const bp = Math.round((billed / s.contractValue) * 100)
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/spk/${s.id}`)}>
                    <td className="td max-w-80">
                      <p className="font-mono text-xs text-brand-700">{s.number}</p>
                      <p className="truncate font-medium text-slate-800">{s.title}</p>
                      <p className="text-xs text-slate-500">{s.department} • PIC {s.pic}</p>
                    </td>
                    <td className="td text-slate-600">{lk.vendor.get(s.vendorId)?.name}</td>
                    <td className="td whitespace-nowrap text-xs text-slate-600">
                      {formatDate(s.startDate)} –<br />
                      {formatDate(s.endDate)} {late && <Badge tone="rose">Lewat</Badge>}
                    </td>
                    <td className="td w-36">
                      <div className="flex items-center gap-2"><Progress value={s.progress} tone="emerald" /><span className="w-9 text-xs tabular-nums">{s.progress}%</span></div>
                    </td>
                    <td className="td w-44">
                      <div className="flex items-center gap-2"><Progress value={bp} /><span className="w-9 text-xs tabular-nums">{bp}%</span></div>
                      <p className="mt-1 text-[11px] text-slate-500">Dibayar {formatCompact(paid)}</p>
                    </td>
                    <td className="td num">{formatIDR(s.contractValue)}</td>
                    <td className="td num font-semibold text-slate-900">{formatIDR(remaining)}</td>
                    <td className="td"><StatusBadge status={s.status} /></td>
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
