import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Landmark, Send } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { daysOverdue, toISODate } from '@/lib/dates'
import { formatDate, formatIDR, terbilangRupiah } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Field, PageHeader } from '@/components/ui'
import { SignaturePad } from '@/components/ui/SignaturePad'
import type { PaymentRequest } from '@/types'
import { cn } from '@/lib/cn'

export default function PaymentRequestForm() {
  const { vendors, invoices, settings, createPaymentRequest, notify } = useStore()
  const me = useCurrentUser()
  const lk = useLookups()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const eligible = invoices.filter((i) => i.status === 'Terverifikasi')
  const vendorsWithEligible = vendors.filter((v) => eligible.some((i) => i.vendorId === v.id))

  const [vendorId, setVendorId] = useState(params.get('vendor') ?? vendorsWithEligible[0]?.id ?? '')
  const [selected, setSelected] = useState<string[]>(params.get('invoice') ? [params.get('invoice')!] : [])
  const vendorInvoices = eligible.filter((i) => i.vendorId === vendorId)
  const vendor = vendors.find((v) => v.id === vendorId)
  const sel = vendorInvoices.filter((i) => selected.includes(i.id))
  const earliestDue = sel.map((i) => i.dueDate).sort()[0]

  const [f, setF] = useState({
    purpose: '',
    paymentMethod: 'Transfer Bank' as PaymentRequest['paymentMethod'],
    plannedPaymentDate: '',
    sourceAccount: settings.bankAccounts[0],
    notes: '',
  })
  const [signature, setSignature] = useState<string | null>(null)

  const amount = sel.reduce((s, i) => s + i.total, 0)
  const pph = sel.reduce((s, i) => s + i.pph, 0)
  const net = amount - pph
  const chain = useMemo(() => settings.approvalMatrix.filter((r, i) => i === 0 || amount >= r.minAmount), [settings, amount])
  const costCenter = sel.map((i) => lk.pr.get(i.prId ?? '')?.costCenter).find(Boolean) ?? '-'

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = () => {
    if (me.role !== settings.approvalMatrix[0].role)
      return notify({ type: 'error', title: 'Tidak berwenang', message: `Pengajuan dibuat oleh ${settings.approvalMatrix[0].role}. Ganti pengguna melalui menu profil.` })
    if (!sel.length) return notify({ type: 'error', title: 'Pilih minimal satu tagihan' })
    if (!signature) return notify({ type: 'error', title: 'Tanda tangan pembuat diperlukan' })
    const prq = createPaymentRequest(
      {
        date: toISODate(new Date()),
        vendorId,
        invoiceIds: sel.map((i) => i.id),
        purpose: f.purpose || `Pembayaran ${sel.map((i) => i.description).join('; ')}`,
        paymentMethod: f.paymentMethod,
        plannedPaymentDate: f.plannedPaymentDate || earliestDue,
        sourceAccount: f.sourceAccount,
        costCenter,
        notes: f.notes,
      },
      signature,
    )
    notify({ type: 'success', title: 'Pengajuan dibuat', message: `${prq.number} dikirim ke ${prq.steps[1]?.role ?? 'approver'}` })
    nav(`/payment-requests/${prq.id}`)
  }

  return (
    <div>
      <PageHeader
        title="Form Pengajuan Pembayaran"
        description="Pilih tagihan terverifikasi, lengkapi data pembayaran, lalu tanda tangani untuk diteruskan ke PIC otorisasi."
        breadcrumbs={[{ label: 'Pengajuan Pembayaran', to: '/payment-requests' }, { label: 'Buat Baru' }]}
      />
      {vendorsWithEligible.length === 0 ? (
        <div className="card">
          <EmptyState title="Belum ada tagihan terverifikasi" description="Tagihan harus melalui verifikasi & 3-way matching sebelum dapat diajukan." action={<Link to="/invoices?status=Verifikasi"><Button>Lihat tagihan dalam verifikasi</Button></Link>} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="1. Vendor & Tagihan" subtitle="Hanya tagihan berstatus Terverifikasi yang dapat diajukan">
              <Field label="Vendor" required>
                <select className="input" value={vendorId} onChange={(e) => { setVendorId(e.target.value); setSelected([]) }}>
                  {vendorsWithEligible.map((v) => <option key={v.id} value={v.id}>{v.name} ({eligible.filter((i) => i.vendorId === v.id).length} tagihan)</option>)}
                </select>
              </Field>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr><th className="th w-10" /><th className="th">No. Tagihan</th><th className="th">Jatuh Tempo</th><th className="th text-right">Total</th><th className="th text-right">PPh</th><th className="th text-right">Netto</th></tr>
                  </thead>
                  <tbody>
                    {vendorInvoices.map((i) => {
                      const od = daysOverdue(i.dueDate)
                      return (
                        <tr key={i.id} onClick={() => toggle(i.id)} className={cn('cursor-pointer', selected.includes(i.id) ? 'bg-brand-50/60' : 'hover:bg-slate-50')}>
                          <td className="td"><input type="checkbox" readOnly checked={selected.includes(i.id)} className="size-4 accent-brand-600" /></td>
                          <td className="td">
                            <p className="font-medium">{i.vendorInvoiceNo}</p>
                            <p className="text-xs text-slate-500">{i.description}</p>
                          </td>
                          <td className="td whitespace-nowrap">{formatDate(i.dueDate)} {od > 0 && <Badge tone="rose">+{od} hr</Badge>}</td>
                          <td className="td num">{formatIDR(i.total)}</td>
                          <td className="td num text-rose-600">({formatIDR(i.pph)})</td>
                          <td className="td num font-medium">{formatIDR(i.netPayable)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="2. Data Pembayaran">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Keperluan Pembayaran" className="sm:col-span-2">
                  <input className="input" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder={sel.length ? `Pembayaran ${sel[0].description}` : 'Uraian keperluan pembayaran'} />
                </Field>
                <Field label="Metode Pembayaran">
                  <select className="input" value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value as PaymentRequest['paymentMethod'] })}>
                    {['Transfer Bank', 'Giro', 'Cek', 'Virtual Account'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Rencana Tanggal Bayar" hint={earliestDue ? `Jatuh tempo terdekat: ${formatDate(earliestDue)}` : undefined}>
                  <input type="date" className="input" value={f.plannedPaymentDate || earliestDue || ''} onChange={(e) => setF({ ...f, plannedPaymentDate: e.target.value })} />
                </Field>
                <Field label="Rekening Sumber Dana">
                  <select className="input" value={f.sourceAccount} onChange={(e) => setF({ ...f, sourceAccount: e.target.value })}>
                    {settings.bankAccounts.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Cost Center"><input className="input font-mono" value={costCenter} disabled /></Field>
                <Field label="Catatan" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
              </div>
              {vendor && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Landmark className="mt-0.5 size-5 text-brand-600" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-800">Rekening Tujuan (Vendor Master)</p>
                    <p className="text-slate-600">{vendor.bankName} • <span className="font-mono">{vendor.bankAccountNo}</span> • a.n. {vendor.bankAccountName}</p>
                    <p className="text-xs text-slate-500">NPWP {vendor.npwp}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Ringkasan">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Jumlah tagihan</dt><dd>{sel.length}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Total bruto</dt><dd className="tabular-nums">{formatIDR(amount)}</dd></div>
                <div className="flex justify-between text-rose-600"><dt>Potongan PPh</dt><dd className="tabular-nums">({formatIDR(pph)})</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold"><dt>Netto</dt><dd className="tabular-nums">{formatIDR(net)}</dd></div>
              </dl>
              {net > 0 && <p className="mt-2 text-xs italic text-slate-500">{terbilangRupiah(net)}</p>}
            </Card>
            <Card title="3. Jalur Otorisasi" subtitle="Ditentukan otomatis oleh matriks otorisasi berdasarkan nilai">
              <ol className="space-y-2">
                {chain.map((r, i) => (
                  <li key={r.role} className="flex items-center gap-3 text-sm">
                    <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold', i === 0 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
                    <span className="flex-1"><span className="font-medium text-slate-800">{r.label}</span> <span className="text-slate-500">— {r.role}</span></span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card title="Tanda Tangan Pembuat" subtitle={`${me.name} — ${me.role}`}>
              {me.role !== settings.approvalMatrix[0].role && (
                <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Pengajuan hanya dapat dibuat oleh {settings.approvalMatrix[0].role}. Ganti pengguna di pojok kanan atas.</p>
              )}
              <SignaturePad onChange={setSignature} />
              <Button className="mt-4 w-full" size="lg" icon={Send} onClick={submit} disabled={!sel.length}>Ajukan untuk Otorisasi</Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
