import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlarmClock,
  ArrowRight,
  FileSignature,
  Hourglass,
  Inbox,
  ScanLine,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { AGING_BUCKETS, agingBucket, isOutstanding, outstandingAmount, spkBilled } from '@/lib/calc'
import { daysOverdue, today } from '@/lib/dates'
import { formatCompact, formatDate, formatIDR, monthLabel } from '@/lib/format'
import { Badge, Button, Card, KpiCard, PageHeader, Progress, StatusBadge } from '@/components/ui'
import { AGING_COLORS, ChartTooltip, Legend, SERIES, axisProps, yMoney } from '@/components/ap/charts'
import type { InvoiceStatus } from '@/types'
import { cn } from '@/lib/cn'

const PIPELINE: { status: InvoiceStatus; label: string; desc: string }[] = [
  { status: 'Diterima', label: 'Diterima', desc: 'Belum diverifikasi' },
  { status: 'Verifikasi', label: 'Verifikasi', desc: '3-way matching' },
  { status: 'Terverifikasi', label: 'Terverifikasi', desc: 'Siap diajukan' },
  { status: 'Pengajuan', label: 'Pengajuan', desc: 'Proses otorisasi' },
  { status: 'Disetujui', label: 'Disetujui', desc: 'Menunggu bayar' },
]

export default function Dashboard() {
  const { invoices, spks, paymentRequests, payments } = useStore()
  const lk = useLookups()
  const [months, setMonths] = useState(6)

  const stats = useMemo(() => {
    const out = invoices.filter(isOutstanding)
    const totalOut = out.reduce((s, i) => s + outstandingAmount(i), 0)
    const overdue = out.filter((i) => daysOverdue(i.dueDate) > 0)
    const due7 = out.filter((i) => {
      const d = daysOverdue(i.dueDate)
      return d <= 0 && d >= -7
    })
    const t = today()
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1)
    const thisMonth = invoices.filter((i) => new Date(i.receivedDate) >= monthStart)
    const pending = paymentRequests.filter((p) => p.status === 'Menunggu Persetujuan')
    const activeSpk = spks.filter((s) => s.status === 'Berjalan' || s.status === 'Selesai')
    const spkOutstanding = activeSpk.reduce((s, k) => s + Math.max(0, k.contractValue - spkBilled(k, invoices)), 0)
    const paidThisMonth = payments.filter((p) => new Date(p.date) >= monthStart).reduce((s, p) => s + p.amount, 0)
    return { out, totalOut, overdue, due7, thisMonth, pending, activeSpk, spkOutstanding, paidThisMonth }
  }, [invoices, spks, paymentRequests, payments])

  const trend = useMemo(() => {
    const t = today()
    return Array.from({ length: months }, (_, k) => {
      const start = new Date(t.getFullYear(), t.getMonth() - (months - 1 - k), 1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      const inRange = (d: string) => {
        const x = new Date(d)
        return x >= start && x < end
      }
      return {
        month: monthLabel(start),
        Diterima: invoices.filter((i) => inRange(i.receivedDate) && i.status !== 'Ditolak').reduce((s, i) => s + i.netPayable, 0),
        Dibayar: payments.filter((p) => inRange(p.date)).reduce((s, p) => s + p.amount, 0),
      }
    })
  }, [invoices, payments, months])

  const aging = useMemo(
    () =>
      AGING_BUCKETS.map((b, i) => {
        const list = stats.out.filter((inv) => agingBucket(inv.dueDate) === b)
        return { bucket: b, amount: list.reduce((s, x) => s + outstandingAmount(x), 0), count: list.length, color: AGING_COLORS[i] }
      }),
    [stats.out],
  )

  const topVendors = useMemo(() => {
    const m = new Map<string, number>()
    stats.out.forEach((i) => m.set(i.vendorId, (m.get(i.vendorId) ?? 0) + outstandingAmount(i)))
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, amount]) => ({ id, name: lk.vendor.get(id)?.name.replace(/^(PT|CV|UD) /, '') ?? id, amount }))
  }, [stats.out, lk.vendor])

  const pipeline = PIPELINE.map((p) => {
    const list = invoices.filter((i) => i.status === p.status)
    return { ...p, count: list.length, amount: list.reduce((s, i) => s + i.netPayable, 0) }
  })
  const pipelineMax = Math.max(...pipeline.map((p) => p.amount), 1)

  const recent = [...invoices].sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)).slice(0, 7)
  const dueSoon = [...stats.out].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 7)
  const spkOut = stats.activeSpk
    .map((s) => ({ s, billed: spkBilled(s, invoices) }))
    .filter((x) => x.s.contractValue - x.billed > 0)
    .sort((a, b) => b.s.contractValue - b.billed - (a.s.contractValue - a.billed))
    .slice(0, 6)

  const overdueAmt = stats.overdue.reduce((s, i) => s + outstandingAmount(i), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Account Payable"
        description="Ringkasan posisi hutang usaha, tagihan masuk, outstanding pembayaran dan SPK berjalan."
        actions={
          <>
            <Link to="/payment-requests/new"><Button variant="secondary">Buat Pengajuan</Button></Link>
            <Link to="/scan"><Button icon={ScanLine}>Scan Tagihan</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <KpiCard label="Total Outstanding AP" value={formatCompact(stats.totalOut)} hint={`${stats.out.length} tagihan belum dibayar`} icon={Wallet} to="/outstanding" />
        <KpiCard label="Lewat Jatuh Tempo" value={formatCompact(overdueAmt)} hint={`${stats.overdue.length} tagihan overdue`} icon={AlarmClock} tone="rose" to="/outstanding?filter=overdue" />
        <KpiCard
          label="Tagihan Masuk Bulan Ini"
          value={stats.thisMonth.length}
          hint={formatCompact(stats.thisMonth.reduce((s, i) => s + i.netPayable, 0))}
          icon={Inbox}
          tone="cyan"
          to="/invoices"
        />
        <KpiCard
          label="Menunggu Otorisasi"
          value={stats.pending.length}
          hint={formatCompact(stats.pending.reduce((s, p) => s + p.netAmount, 0))}
          icon={ShieldCheck}
          tone="amber"
          to="/payment-requests?status=Menunggu Persetujuan"
        />
        <KpiCard label="Sisa Nilai SPK Outstanding" value={formatCompact(stats.spkOutstanding)} hint={`${stats.activeSpk.length} SPK aktif`} icon={FileSignature} tone="violet" to="/spk" />
      </div>

      {stats.due7.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Hourglass className="size-4 text-amber-600" />
          <span>
            <b>{stats.due7.length} tagihan</b> akan jatuh tempo dalam 7 hari ke depan senilai{' '}
            <b>{formatIDR(stats.due7.reduce((s, i) => s + outstandingAmount(i), 0))}</b>.
          </span>
          <Link to="/outstanding?filter=due7" className="ml-auto font-medium text-amber-800 hover:underline">
            Lihat detail →
          </Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Tren Tagihan Diterima vs Dibayar"
          subtitle="Nilai netto (setelah PPh) per bulan"
          actions={
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
              {[3, 6, 12].map((m) => (
                <button key={m} onClick={() => setMonths(m)} className={cn('rounded-md px-2.5 py-1 font-medium', months === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                  {m} bln
                </button>
              ))}
            </div>
          }
        >
          <Legend items={[{ label: 'Tagihan diterima', color: SERIES[0] }, { label: 'Pembayaran', color: SERIES[2] }]} />
          <div className="mt-3 h-64">
            <ResponsiveContainer>
              <BarChart data={trend} barGap={2} margin={{ left: -8, right: 4 }}>
                <CartesianGrid vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={yMoney} width={64} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip />} />
                <Bar dataKey="Diterima" name="Tagihan diterima" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Dibayar" name="Pembayaran" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Aging Hutang Usaha" subtitle="Outstanding berdasarkan umur jatuh tempo" actions={<Link to="/outstanding" className="text-xs font-medium text-brand-600 hover:underline">Detail</Link>}>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={aging} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="bucket" {...axisProps} width={110} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<ChartTooltip extra={(p) => `${p.count as number} tagihan`} />} />
                <Bar dataKey="amount" name="Outstanding" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {aging.map((a) => <Cell key={a.bucket} fill={a.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
            {aging.map((a) => (
              <div key={a.bucket} className="rounded-lg bg-slate-50 px-1 py-2">
                <p className="text-xs text-slate-500 leading-tight">{a.bucket}</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">{formatCompact(a.amount).replace('Rp ', '')}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Pipeline Proses Tagihan" subtitle="Posisi tagihan dari diterima sampai siap dibayar">
          <div className="space-y-3">
            {pipeline.map((p, i) => (
              <Link key={p.status} to={`/invoices?status=${p.status}`} className="group grid grid-cols-[150px_1fr_auto] items-center gap-4 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-slate-800">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all group-hover:bg-brand-600" style={{ width: `${(p.amount / pipelineMax) * 100}%` }} />
                </div>
                <div className="w-36 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-800">{formatCompact(p.amount)}</p>
                  <p className="text-xs text-slate-500">{p.count} tagihan</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Top Vendor — Outstanding" subtitle="6 vendor dengan saldo hutang terbesar">
          <ul className="space-y-3">
            {topVendors.map((v) => (
              <li key={v.id}>
                <Link to={`/vendors/${v.id}`} className="block hover:opacity-80">
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium text-slate-700">{v.name}</span>
                    <span className="ml-3 shrink-0 tabular-nums text-slate-600">{formatCompact(v.amount)}</span>
                  </div>
                  <Progress value={(v.amount / (topVendors[0]?.amount || 1)) * 100} className="mt-1.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Tagihan Masuk Terbaru" bodyClass="!px-0 !pb-2" actions={<Link to="/invoices" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">Semua <ArrowRight className="size-3" /></Link>}>
          <div className="overflow-x-auto">
            <table className="w-full [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr><th className="th">Vendor / No. Tagihan</th><th className="th">Diterima</th><th className="th text-right">Netto</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/70">
                    <td className="td">
                      <Link to={`/invoices/${i.id}`} className="block">
                        <p className="font-medium text-slate-800">{lk.vendor.get(i.vendorId)?.name}</p>
                        <p className="font-mono text-xs text-slate-500">{i.vendorInvoiceNo}</p>
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDate(i.receivedDate)}</td>
                    <td className="td num font-medium">{formatIDR(i.netPayable)}</td>
                    <td className="td"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Outstanding — Jatuh Tempo Terdekat" bodyClass="!px-0 !pb-2" actions={<Link to="/outstanding" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">Semua <ArrowRight className="size-3" /></Link>}>
          <div className="overflow-x-auto">
            <table className="w-full [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr><th className="th">Vendor / No. Tagihan</th><th className="th">Jatuh Tempo</th><th className="th text-right">Outstanding</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {dueSoon.map((i) => {
                  const d = daysOverdue(i.dueDate)
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/70">
                      <td className="td">
                        <Link to={`/invoices/${i.id}`} className="block">
                          <p className="font-medium text-slate-800">{lk.vendor.get(i.vendorId)?.name}</p>
                          <p className="font-mono text-xs text-slate-500">{i.vendorInvoiceNo}</p>
                        </Link>
                      </td>
                      <td className="td whitespace-nowrap">
                        <p className="text-slate-700">{formatDate(i.dueDate)}</p>
                        <p className={cn('text-xs font-medium', d > 0 ? 'text-rose-600' : d >= -7 ? 'text-amber-600' : 'text-slate-500')}>
                          {d > 0 ? `Terlambat ${d} hari` : d === 0 ? 'Hari ini' : `${-d} hari lagi`}
                        </p>
                      </td>
                      <td className="td num font-medium">{formatIDR(outstandingAmount(i))}</td>
                      <td className="td"><StatusBadge status={i.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="SPK Outstanding" subtitle="Sisa nilai kontrak yang belum ditagihkan vendor" bodyClass="!px-0 !pb-2" actions={<Link to="/spk" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">Semua SPK <ArrowRight className="size-3" /></Link>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. SPK / Pekerjaan</th>
                <th className="th">Vendor</th>
                <th className="th">Progres Fisik</th>
                <th className="th">Tertagih</th>
                <th className="th text-right">Nilai Kontrak</th>
                <th className="th text-right">Sisa Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {spkOut.map(({ s, billed }) => {
                const billedPct = Math.round((billed / s.contractValue) * 100)
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="td">
                      <Link to={`/spk/${s.id}`}>
                        <p className="font-mono text-xs text-brand-700">{s.number}</p>
                        <p className="font-medium text-slate-800">{s.title}</p>
                      </Link>
                    </td>
                    <td className="td text-slate-600">{lk.vendor.get(s.vendorId)?.name}</td>
                    <td className="td w-40">
                      <div className="flex items-center gap-2"><Progress value={s.progress} tone="emerald" /><span className="w-9 text-xs tabular-nums text-slate-600">{s.progress}%</span></div>
                    </td>
                    <td className="td w-40">
                      <div className="flex items-center gap-2"><Progress value={billedPct} /><span className="w-9 text-xs tabular-nums text-slate-600">{billedPct}%</span></div>
                      {s.progress - billedPct > 15 && <Badge tone="amber" className="mt-1">Tagihan tertinggal</Badge>}
                    </td>
                    <td className="td num">{formatIDR(s.contractValue)}</td>
                    <td className="td num font-semibold text-slate-900">{formatIDR(s.contractValue - billed)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
