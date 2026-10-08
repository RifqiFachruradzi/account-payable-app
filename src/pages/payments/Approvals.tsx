import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { formatDate, formatDateTime, formatIDR } from '@/lib/format'
import { Button, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { ApprovalDots } from '@/components/ap/ApprovalChain'

export default function Approvals() {
  const me = useCurrentUser()
  const prqs = useStore((s) => s.paymentRequests)
  const lk = useLookups()
  const nav = useNavigate()
  const waiting = prqs.filter((p) => p.status === 'Menunggu Persetujuan' && p.steps.find((s) => s.status === 'Menunggu')?.role === me.role)
  const done = prqs
    .flatMap((p) => p.steps.filter((s) => s.userId === me.id && s.status !== 'Menunggu').map((s) => ({ p, s })))
    .sort((a, b) => (b.s.signedAt ?? '').localeCompare(a.s.signedAt ?? ''))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persetujuan Saya"
        description={`Daftar pengajuan pembayaran yang menunggu tanda tangan Anda sebagai ${me.role}.`}
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Persetujuan Saya' }]}
      />
      <Card title={`Menunggu Tanda Tangan (${waiting.length})`} icon={ShieldCheck} bodyClass="!px-0 !pb-0">
        {waiting.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Tidak ada antrean persetujuan" description="Semua pengajuan untuk peran Anda sudah diproses. Ganti pengguna melalui menu profil untuk mensimulasikan PIC lain." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {waiting.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50/70">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-brand-700">{p.number} • {formatDate(p.date)}</p>
                  <p className="font-medium text-slate-800">{lk.vendor.get(p.vendorId)?.name}</p>
                  <p className="truncate text-xs text-slate-500">{p.purpose}</p>
                </div>
                <ApprovalDots steps={p.steps} />
                <div className="w-40 text-right">
                  <p className="font-semibold tabular-nums">{formatIDR(p.netAmount)}</p>
                  <p className="text-xs text-slate-500">Bayar {formatDate(p.plannedPaymentDate)}</p>
                </div>
                <Button onClick={() => nav(`/payment-requests/${p.id}`)}>Tinjau & TTD</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Riwayat Tanda Tangan Saya" bodyClass="!px-0 !pb-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">No. Pengajuan</th><th className="th">Vendor</th><th className="th">Tahap</th><th className="th">Waktu</th><th className="th text-right">Netto</th><th className="th">Keputusan</th><th className="th">Status Akhir</th></tr></thead>
            <tbody>
              {done.map(({ p, s }) => (
                <tr key={p.id + s.level} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/payment-requests/${p.id}`)}>
                  <td className="td font-mono text-xs text-brand-700">{p.number}</td>
                  <td className="td">{lk.vendor.get(p.vendorId)?.name}</td>
                  <td className="td text-slate-600">{s.label}</td>
                  <td className="td whitespace-nowrap text-slate-600">{formatDateTime(s.signedAt)}</td>
                  <td className="td num">{formatIDR(p.netAmount)}</td>
                  <td className="td"><StatusBadge status={s.status} /></td>
                  <td className="td"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {done.length === 0 && <tr><td colSpan={7} className="td text-center text-slate-500">Belum ada riwayat.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
