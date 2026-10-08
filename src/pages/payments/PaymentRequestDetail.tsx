import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, CheckCircle2, Printer, ShieldCheck, XCircle } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { formatDate, formatDateTime, formatIDR, terbilangRupiah } from '@/lib/format'
import { Button, Card, EmptyState, Field, Modal, PageHeader, StatusBadge } from '@/components/ui'
import { SignaturePad } from '@/components/ui/SignaturePad'
import { ApprovalTimeline } from '@/components/ap/ApprovalChain'

export default function PaymentRequestDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useCurrentUser()
  const { paymentRequests, invoices, vendors, settings, payments, signPaymentRequest, rejectPaymentRequest, notify, spks, pos } = useStore()
  const prq = paymentRequests.find((p) => p.id === id)
  const [sig, setSig] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  if (!prq) return <EmptyState title="Pengajuan tidak ditemukan" />

  const vendor = vendors.find((v) => v.id === prq.vendorId)!
  const invs = invoices.filter((i) => prq.invoiceIds.includes(i.id))
  const pay = payments.find((p) => p.paymentRequestId === prq.id)
  const next = prq.steps.find((s) => s.status === 'Menunggu')
  const canSign = prq.status === 'Menunggu Persetujuan' && next?.role === me.role

  const sign = () => {
    if (!sig) return notify({ type: 'error', title: 'Bubuhkan tanda tangan terlebih dahulu' })
    signPaymentRequest(prq.id, sig, note || undefined)
    notify({ type: 'success', title: 'Pengajuan ditandatangani', message: `${prq.number} — ${me.role}` })
    setSig(null)
    setNote('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Pengajuan Pembayaran', to: '/payment-requests' }, { label: prq.number }]}
        title={<span className="flex flex-wrap items-center gap-3">{prq.number} <StatusBadge status={prq.status} /></span>}
        description={`${vendor.name} • ${prq.purpose}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Cetak Formulir</Button>
            {prq.status === 'Disetujui' && <Button icon={Banknote} variant="success" onClick={() => nav(`/payments?pay=${prq.id}`)}>Proses Pembayaran</Button>}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Formulir cetak */}
        <div className="card print-area p-6 sm:p-10 xl:col-span-2">
          <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="" className="size-12" />
              <div>
                <p className="text-base font-bold text-slate-900">{settings.companyName}</p>
                <p className="max-w-md text-xs text-slate-500">{settings.companyAddress}</p>
                <p className="font-mono text-xs text-slate-500">NPWP {settings.companyNpwp}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">Formulir Pengajuan Pembayaran</p>
              <p className="font-mono text-sm text-brand-700">{prq.number}</p>
              <p className="text-xs text-slate-500">Tanggal {formatDate(prq.date, true)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['Dibayarkan kepada', vendor.name],
              ['NPWP', vendor.npwp],
              ['Bank Tujuan', `${vendor.bankName} — ${vendor.bankAccountNo}`],
              ['Atas Nama', vendor.bankAccountName],
              ['Metode Pembayaran', prq.paymentMethod],
              ['Rencana Tanggal Bayar', formatDate(prq.plannedPaymentDate, true)],
              ['Sumber Dana', prq.sourceAccount],
              ['Cost Center', prq.costCenter],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800">: {v}</span>
              </div>
            ))}
            <div className="grid grid-cols-[140px_1fr] gap-2 sm:col-span-2">
              <span className="text-slate-500">Keperluan</span>
              <span className="font-medium text-slate-800">: {prq.purpose}</span>
            </div>
          </div>

          <table className="mt-6 w-full border border-slate-300 text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-2 py-1.5 text-left text-xs">No</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left text-xs">No. Invoice / Rujukan</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left text-xs">Uraian</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right text-xs">DPP</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right text-xs">PPN</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right text-xs">PPh</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right text-xs">Netto</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i, idx) => (
                <tr key={i.id}>
                  <td className="border border-slate-300 px-2 py-1.5 align-top">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5 align-top whitespace-nowrap">
                    <Link to={`/invoices/${i.id}`} className="font-mono text-xs text-brand-700 hover:underline">{i.vendorInvoiceNo}</Link>
                    <p className="font-mono text-xs text-slate-500">{spks.find((s) => s.id === i.spkId)?.number ?? pos.find((p) => p.id === i.poId)?.number}</p>
                    {i.fakturPajakNo && <p className="font-mono text-xs text-slate-500">FP {i.fakturPajakNo}</p>}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 align-top text-xs">{i.description}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap">{formatIDR(i.dpp)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap">{formatIDR(i.ppn)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap">({formatIDR(i.pph)})</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right align-top font-medium tabular-nums whitespace-nowrap">{formatIDR(i.netPayable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="border border-slate-300 px-2 py-1.5 text-right" colSpan={6}>Total Dibayarkan</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{formatIDR(prq.netAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm italic text-slate-700">Terbilang: <b>{terbilangRupiah(prq.netAmount)}</b></p>
          {prq.notes && <p className="mt-2 text-xs text-slate-500">Catatan: {prq.notes}</p>}

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {prq.steps.map((s) => (
              <div key={s.level} className="flex flex-col rounded-lg border border-slate-200 p-2 text-center">
                <p className="text-xs font-semibold text-slate-600">{s.label}</p>
                <div className="my-1 grid h-20 place-items-center">
                  {s.signature ? (
                    <img src={s.signature} alt="ttd" className="max-h-20 max-w-full object-contain" />
                  ) : s.status === 'Ditolak' ? (
                    <span className="rounded border-2 border-rose-500 px-2 py-0.5 text-xs font-bold uppercase text-rose-600 -rotate-6">Ditolak</span>
                  ) : (
                    <span className="text-xs text-slate-300">(belum ditandatangani)</span>
                  )}
                </div>
                <p className="border-t border-slate-300 pt-1 text-xs font-medium text-slate-800">{s.userName ?? '..................'}</p>
                <p className="text-xs text-slate-500">{s.role}</p>
                <p className="text-xs text-slate-400">{s.signedAt ? formatDate(s.signedAt) : ''}</p>
              </div>
            ))}
          </div>
          {pay && (
            <div className="mt-6 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-800">
              <b>LUNAS</b> — dibayar {formatDate(pay.date, true)} melalui {pay.sourceAccount}, ref. bank <span className="font-mono">{pay.bankReference}</span> ({pay.number})
            </div>
          )}
        </div>

        {/* Panel otorisasi */}
        <div className="space-y-6 no-print">
          {canSign && (
            <Card title="Tanda Tangan Anda Dibutuhkan" icon={ShieldCheck} subtitle={`${me.name} — ${next!.label} (${me.role})`} className="border-amber-300 ring-4 ring-amber-50">
              <SignaturePad onChange={setSig} />
              <Field label="Catatan (opsional)" className="mt-3">
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={XCircle} className="!text-rose-600" onClick={() => setRejectOpen(true)}>Tolak</Button>
                <Button variant="success" icon={CheckCircle2} onClick={sign}>Setujui & TTD</Button>
              </div>
            </Card>
          )}
          {!canSign && prq.status === 'Menunggu Persetujuan' && next && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Menunggu tanda tangan <b>{next.role}</b> ({next.label}). Gunakan menu profil untuk berganti pengguna (simulasi PIC).
            </div>
          )}
          <Card title="Status Otorisasi" subtitle={`${prq.steps.filter((s) => s.status === 'Disetujui').length} dari ${prq.steps.length} tahap selesai`}>
            <ApprovalTimeline steps={prq.steps} />
          </Card>
          <Card title="Ringkasan Nilai">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Bruto (DPP + PPN)</dt><dd className="tabular-nums">{formatIDR(prq.amount)}</dd></div>
              <div className="flex justify-between text-rose-600"><dt>PPh dipotong</dt><dd className="tabular-nums">({formatIDR(prq.pphAmount)})</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold"><dt>Netto</dt><dd className="tabular-nums">{formatIDR(prq.netAmount)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Dibuat oleh {prq.createdBy} • {formatDateTime(prq.steps[0]?.signedAt ?? prq.date)}</p>
          </Card>
        </div>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Tolak Pengajuan"
        description="Tagihan akan dikembalikan ke status Terverifikasi."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              onClick={() => {
                rejectPaymentRequest(prq.id, note)
                setRejectOpen(false)
                notify({ type: 'info', title: 'Pengajuan ditolak' })
              }}
            >
              Tolak
            </Button>
          </>
        }
      >
        <Field label="Alasan penolakan" required>
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
