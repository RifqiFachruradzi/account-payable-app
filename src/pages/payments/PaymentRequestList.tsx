import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FilePlus2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { formatDate, formatIDR } from '@/lib/format'
import { Button, EmptyState, PageHeader, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import { ApprovalDots } from '@/components/ap/ApprovalChain'
import type { PaymentRequestStatus } from '@/types'

const TABS: (PaymentRequestStatus | 'Semua')[] = ['Semua', 'Menunggu Persetujuan', 'Disetujui', 'Dibayar', 'Ditolak']

export default function PaymentRequestList() {
  const prqs = useStore((s) => s.paymentRequests)
  const lk = useLookups()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as PaymentRequestStatus | null) ?? 'Semua'
  const [q, setQ] = useState('')

  const list = useMemo(
    () =>
      prqs
        .filter((p) => status === 'Semua' || p.status === status)
        .filter((p) => !q || `${p.number} ${p.purpose} ${lk.vendor.get(p.vendorId)?.name}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [prqs, status, q, lk],
  )

  return (
    <div>
      <PageHeader
        title="Pengajuan Pembayaran"
        description="Formulir pengajuan pembayaran tagihan vendor beserta status otorisasi berjenjang."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Pengajuan Pembayaran' }]}
        actions={<Button icon={FilePlus2} onClick={() => nav('/payment-requests/new')}>Buat Pengajuan</Button>}
      />
      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
          <Tabs
            value={status}
            onChange={(v) => setParams(v === 'Semua' ? {} : { status: v }, { replace: true })}
            tabs={TABS.map((t) => ({ value: t, label: t, count: t === 'Semua' ? prqs.length : prqs.filter((p) => p.status === t).length }))}
          />
          <SearchInput value={q} onChange={setQ} className="mb-2 ml-auto w-full sm:w-72" placeholder="Cari no. pengajuan / vendor…" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. Pengajuan</th>
                <th className="th">Vendor / Keperluan</th>
                <th className="th">Rencana Bayar</th>
                <th className="th text-right">Bruto</th>
                <th className="th text-right">Netto</th>
                <th className="th">Otorisasi</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const next = p.steps.find((s) => s.status === 'Menunggu')
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/payment-requests/${p.id}`)}>
                    <td className="td">
                      <p className="font-mono text-xs text-brand-700">{p.number}</p>
                      <p className="text-xs text-slate-500">{formatDate(p.date)} • {p.invoiceIds.length} tagihan</p>
                    </td>
                    <td className="td max-w-72">
                      <p className="truncate font-medium text-slate-800">{lk.vendor.get(p.vendorId)?.name}</p>
                      <p className="truncate text-xs text-slate-500">{p.purpose}</p>
                    </td>
                    <td className="td whitespace-nowrap">{formatDate(p.plannedPaymentDate)}</td>
                    <td className="td num">{formatIDR(p.amount)}</td>
                    <td className="td num font-semibold">{formatIDR(p.netAmount)}</td>
                    <td className="td">
                      <ApprovalDots steps={p.steps} />
                      {next && p.status === 'Menunggu Persetujuan' && <p className="mt-1 text-xs text-amber-700">Menunggu: {next.role}</p>}
                    </td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState title="Belum ada pengajuan" description="Buat pengajuan dari tagihan yang sudah terverifikasi." />}
        </div>
      </div>
    </div>
  )
}
