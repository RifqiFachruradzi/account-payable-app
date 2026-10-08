import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Banknote, CalendarClock, CheckCircle2, Download, Wallet } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { daysOverdue, toISODate } from '@/lib/dates'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { exportCSV } from '@/lib/export'
import { Badge, Button, EmptyState, Field, KpiCard, Modal, PageHeader, Tabs } from '@/components/ui'
import type { PaymentRequest } from '@/types'

export default function Payments() {
  const { paymentRequests, payments, recordPayment, notify } = useStore()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'ready' | 'history'>('ready')
  const [target, setTarget] = useState<PaymentRequest | null>(null)
  const [form, setForm] = useState({ date: toISODate(new Date()), sourceAccount: '', bankReference: '' })

  const ready = paymentRequests.filter((p) => p.status === 'Disetujui').sort((a, b) => a.plannedPaymentDate.localeCompare(b.plannedPaymentDate))
  const history = [...payments].sort((a, b) => b.date.localeCompare(a.date))
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const openPay = (p: PaymentRequest) => {
    setTarget(p)
    setForm({ date: toISODate(new Date()), sourceAccount: p.sourceAccount, bankReference: '' })
  }

  useEffect(() => {
    const id = params.get('pay')
    const p = id && paymentRequests.find((x) => x.id === id && x.status === 'Disetujui')
    if (p) openPay(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = () => {
    if (!target) return
    if (!form.bankReference.trim()) return notify({ type: 'error', title: 'Nomor referensi bank wajib diisi' })
    const pay = recordPayment(target.id, form)
    if (pay) notify({ type: 'success', title: 'Pembayaran tercatat', message: `${pay.number} • ${formatIDR(pay.amount)}` })
    setTarget(null)
    params.delete('pay')
    setParams(params, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Realisasi Pembayaran"
        description="Eksekusi pembayaran atas pengajuan yang telah disetujui penuh dan riwayat bukti kas keluar."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Pembayaran' }]}
        actions={
          <Button
            variant="secondary"
            icon={Download}
            onClick={() =>
              exportCSV(
                'pembayaran.csv',
                history.map((p) => ({ 'No. BKK': p.number, Tanggal: p.date, Vendor: lk.vendor.get(p.vendorId)?.name, Pengajuan: lk.prq.get(p.paymentRequestId)?.number, 'Sumber Dana': p.sourceAccount, 'Ref Bank': p.bankReference, Jumlah: p.amount })),
              )
            }
          >
            Export
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Siap Dibayar" value={formatCompact(ready.reduce((s, p) => s + p.netAmount, 0))} hint={`${ready.length} pengajuan disetujui`} icon={CalendarClock} tone="violet" />
        <KpiCard label="Dibayar Bulan Ini" value={formatCompact(payments.filter((p) => new Date(p.date) >= monthStart).reduce((s, p) => s + p.amount, 0))} hint={`${payments.filter((p) => new Date(p.date) >= monthStart).length} transaksi`} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Total Pembayaran" value={formatCompact(payments.reduce((s, p) => s + p.amount, 0))} hint={`${payments.length} transaksi`} icon={Wallet} />
      </div>
      <div className="card">
        <div className="px-4 pt-2">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ready', label: 'Siap Dibayar', count: ready.length }, { value: 'history', label: 'Riwayat Pembayaran', count: history.length }]} />
        </div>
        <div className="overflow-x-auto">
          {tab === 'ready' ? (
            ready.length === 0 ? (
              <EmptyState icon={Banknote} title="Tidak ada pengajuan yang siap dibayar" />
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">No. Pengajuan</th><th className="th">Vendor</th><th className="th">Rekening Tujuan</th><th className="th">Rencana Bayar</th><th className="th text-right">Netto</th><th className="th" /></tr></thead>
                <tbody>
                  {ready.map((p) => {
                    const v = lk.vendor.get(p.vendorId)!
                    const od = daysOverdue(p.plannedPaymentDate)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="td"><Link className="font-mono text-xs text-brand-700 hover:underline" to={`/payment-requests/${p.id}`}>{p.number}</Link><p className="text-xs text-slate-500">{p.invoiceIds.length} tagihan</p></td>
                        <td className="td font-medium">{v.name}</td>
                        <td className="td whitespace-nowrap"><p>{v.bankName}</p><p className="font-mono text-xs text-slate-500">{v.bankAccountNo}</p></td>
                        <td className="td whitespace-nowrap">{formatDate(p.plannedPaymentDate)} {od > 0 && <Badge tone="rose">Lewat {od} hr</Badge>}</td>
                        <td className="td num font-semibold">{formatIDR(p.netAmount)}</td>
                        <td className="td text-right"><Button size="sm" variant="success" icon={Banknote} onClick={() => openPay(p)}>Bayar</Button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">No. Bukti Kas Keluar</th><th className="th">Tanggal</th><th className="th">Vendor</th><th className="th">Pengajuan</th><th className="th">Sumber Dana</th><th className="th">Ref. Bank</th><th className="th text-right">Jumlah</th></tr></thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="td font-mono text-xs">{p.number}</td>
                    <td className="td whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="td font-medium">{lk.vendor.get(p.vendorId)?.name}</td>
                    <td className="td"><Link className="font-mono text-xs text-brand-700 hover:underline" to={`/payment-requests/${p.paymentRequestId}`}>{lk.prq.get(p.paymentRequestId)?.number}</Link></td>
                    <td className="td text-xs text-slate-600">{p.sourceAccount}</td>
                    <td className="td font-mono text-xs">{p.bankReference}</td>
                    <td className="td num font-semibold text-emerald-700">{formatIDR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Catat Realisasi Pembayaran"
        description={target ? `${target.number} • ${lk.vendor.get(target.vendorId)?.name}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Batal</Button>
            <Button variant="success" icon={CheckCircle2} onClick={submit}>Konfirmasi Pembayaran</Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <p className="text-xs text-emerald-700">Jumlah ditransfer</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-800">{formatIDR(target.netAmount)}</p>
              <p className="mt-1 text-xs text-emerald-700">ke {lk.vendor.get(target.vendorId)?.bankName} {lk.vendor.get(target.vendorId)?.bankAccountNo}</p>
            </div>
            <Field label="Tanggal Pembayaran" required><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Rekening Sumber"><input className="input" value={form.sourceAccount} onChange={(e) => setForm({ ...form, sourceAccount: e.target.value })} /></Field>
            <Field label="No. Referensi Bank / Bukti Transfer" required><input className="input font-mono" value={form.bankReference} onChange={(e) => setForm({ ...form, bankReference: e.target.value })} placeholder="TRF…" /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
