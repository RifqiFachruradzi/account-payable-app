import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, CheckCircle2, ClipboardCheck, FileText, History, Link2, PlayCircle, Save, ScanLine } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { matchInvoice, matchSummary, poValue } from '@/lib/calc'
import { daysOverdue } from '@/lib/dates'
import { formatDate, formatDateTime, formatIDR, terbilangRupiah } from '@/lib/format'
import { Badge, Button, Card, DescList, EmptyState, Field, Modal, PageHeader, StatusBadge } from '@/components/ui'
import { DocumentTrail } from '@/components/ap/DocumentTrail'
import { MatchPanel } from '@/components/ap/MatchPanel'
import { AttachmentPanel } from '@/components/ap/AttachmentPanel'
import { DocNumberInput } from '@/components/docs/DocNumberInput'

export default function InvoiceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { invoices, vendors, spks, pos, grs, paymentRequests, setInvoiceStatus, updateInvoice, notify } = useStore()
  const inv = invoices.find((i) => i.id === id)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [refOpen, setRefOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState({ spkId: '', poId: '', grId: '', fakturPajakNo: '' })

  const vendor = vendors.find((v) => v.id === inv?.vendorId)
  const spk = spks.find((s) => s.id === inv?.spkId)
  const po = pos.find((p) => p.id === inv?.poId)
  const gr = grs.find((g) => g.id === inv?.grId)
  const checks = useMemo(() => (inv ? matchInvoice(inv, { spk, po, gr, invoices, vendorIsPkp: vendor?.isPkp }) : []), [inv, spk, po, gr, invoices, vendor])

  if (!inv || !vendor) return <EmptyState title="Tagihan tidak ditemukan" action={<Link to="/invoices"><Button>Kembali</Button></Link>} />

  const summary = matchSummary(checks)
  const prq = [...paymentRequests].reverse().find((p) => p.invoiceIds.includes(inv.id))
  const od = daysOverdue(inv.dueDate)
  const editable = inv.status === 'Diterima' || inv.status === 'Verifikasi'

  const verify = () => {
    if (summary === 'fail') {
      notify({ type: 'error', title: 'Matching tidak sesuai', message: 'Perbaiki rujukan dokumen atau tolak tagihan.' })
      return
    }
    setInvoiceStatus(inv.id, 'Terverifikasi', 'Tagihan terverifikasi (3-way matching)', summary === 'warn' ? 'Diverifikasi dengan catatan perhatian' : undefined)
    notify({ type: 'success', title: 'Tagihan terverifikasi', message: 'Siap dibuatkan pengajuan pembayaran.' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tagihan Masuk', to: '/invoices' }, { label: inv.number }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {inv.vendorInvoiceNo} <StatusBadge status={inv.status} />
            {inv.source === 'Scan OCR' && <Badge tone="violet"><ScanLine className="size-3" /> Scan OCR{inv.ocrConfidence ? ` ${inv.ocrConfidence}%` : ''}</Badge>}
          </span>
        }
        description={`${inv.number} • ${vendor.name} • ${inv.description}`}
        actions={
          <>
            {editable && (
              <Button
                variant="secondary"
                icon={Link2}
                onClick={() => {
                  setRef({ spkId: inv.spkId ?? '', poId: inv.poId ?? '', grId: inv.grId ?? '', fakturPajakNo: inv.fakturPajakNo ?? '' })
                  setRefOpen(true)
                }}
              >
                Ubah Rujukan
              </Button>
            )}
            {(editable || inv.status === 'Terverifikasi') && <Button variant="secondary" icon={Ban} onClick={() => setRejectOpen(true)} className="!text-rose-600">Tolak</Button>}
            {inv.status === 'Diterima' && <Button icon={PlayCircle} onClick={() => setInvoiceStatus(inv.id, 'Verifikasi', 'Proses verifikasi & 3-way matching dimulai')}>Mulai Verifikasi</Button>}
            {inv.status === 'Verifikasi' && <Button icon={CheckCircle2} variant="success" onClick={verify}>Tandai Terverifikasi</Button>}
            {inv.status === 'Terverifikasi' && <Button icon={FileText} onClick={() => nav(`/payment-requests/new?vendor=${inv.vendorId}&invoice=${inv.id}`)}>Buat Pengajuan Pembayaran</Button>}
            {prq && <Link to={`/payment-requests/${prq.id}`}><Button variant="outline" icon={ClipboardCheck}>{prq.number}</Button></Link>}
          </>
        }
      />

      <Card title="Alur Dokumen" subtitle="Ketertelusuran dari permintaan pembelian hingga pembayaran">
        <DocumentTrail invoice={inv} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Informasi Tagihan">
            <DescList
              cols={3}
              items={[
                { label: 'No. Registrasi AP', value: <span className="font-mono">{inv.number}</span> },
                { label: 'No. Invoice Vendor', value: <span className="font-mono">{inv.vendorInvoiceNo}</span> },
                { label: 'No. Faktur Pajak', value: inv.fakturPajakNo && <span className="font-mono">{inv.fakturPajakNo}</span> },
                { label: 'Tanggal Invoice', value: formatDate(inv.invoiceDate) },
                { label: 'Tanggal Diterima', value: formatDate(inv.receivedDate) },
                {
                  label: 'Jatuh Tempo',
                  value: (
                    <span>
                      {formatDate(inv.dueDate)}{' '}
                      {inv.status !== 'Dibayar' && inv.status !== 'Ditolak' && (od > 0 ? <Badge tone="rose">Terlambat {od} hari</Badge> : <Badge tone="emerald">{-od} hari lagi</Badge>)}
                    </span>
                  ),
                },
                { label: 'No. SPK', value: spk && <Link className="font-mono text-brand-700 hover:underline" to={`/spk/${spk.id}`}>{spk.number}</Link> },
                { label: 'No. PO', value: po && <span className="font-mono">{po.number}</span> },
                { label: 'BAST / GR', value: gr && <span className="font-mono">{gr.number}</span> },
                { label: 'Uraian', value: inv.description, full: true },
              ]}
            />
          </Card>

          <Card title="Rincian Nilai" bodyClass="!px-0">
            <table className="w-full">
              <thead>
                <tr><th className="th">Uraian</th><th className="th text-right">Qty</th><th className="th text-right">Harga</th><th className="th text-right">Jumlah</th></tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td className="td">{it.description}</td>
                    <td className="td num">{it.qty} {it.unit}</td>
                    <td className="td num">{formatIDR(it.unitPrice)}</td>
                    <td className="td num">{formatIDR(it.qty * it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-4 max-w-sm space-y-1.5 px-5 text-sm">
              <Row label="DPP" value={formatIDR(inv.dpp)} />
              <Row label={`PPN ${inv.ppnRate}%`} value={formatIDR(inv.ppn)} />
              <Row label="Total Tagihan" value={formatIDR(inv.total)} strong />
              <Row label={`PPh ${inv.pphRate}% (${vendor.withholdingTax})`} value={`(${formatIDR(inv.pph)})`} className="text-rose-600" />
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><span>Netto Dibayar</span><span className="tabular-nums">{formatIDR(inv.netPayable)}</span></div>
              <p className="text-right text-xs italic text-slate-500">{terbilangRupiah(inv.netPayable)}</p>
              {inv.paidAmount > 0 && <Row label="Sudah Dibayar" value={formatIDR(inv.paidAmount)} className="text-emerald-700" />}
            </div>
          </Card>

          <AttachmentPanel invoice={inv} />

          <Card title="Vendor" actions={<Link to={`/vendors/${vendor.id}`} className="text-xs font-medium text-brand-600 hover:underline">Lihat master</Link>}>
            <DescList
              cols={3}
              items={[
                { label: 'Nama', value: vendor.name },
                { label: 'NPWP', value: <span className="font-mono">{vendor.npwp}</span> },
                { label: 'Status Pajak', value: `${vendor.isPkp ? 'PKP' : 'Non-PKP'} • ${vendor.withholdingTax}` },
                { label: 'Bank', value: `${vendor.bankName} — ${vendor.bankAccountNo}` },
                { label: 'Atas Nama', value: vendor.bankAccountName },
                { label: 'Termin', value: `${vendor.paymentTermDays} hari` },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="3-Way Matching" subtitle="Kontrak (SPK/PO) • Penerimaan (BAST/GR) • Tagihan">
            <MatchPanel checks={checks} />
          </Card>
          <Card title="Riwayat Proses" icon={History}>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {[...inv.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-white ${i === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                  <p className="text-sm font-medium text-slate-800">{h.action}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.at)} • {h.by}</p>
                  {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Tolak Tagihan"
        description="Tagihan akan dikembalikan ke vendor. Alasan penolakan akan tercatat di riwayat."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                setInvoiceStatus(inv.id, 'Ditolak', 'Tagihan ditolak', reason)
                setRejectOpen(false)
                notify({ type: 'info', title: 'Tagihan ditolak' })
              }}
            >
              Tolak Tagihan
            </Button>
          </>
        }
      >
        <Field label="Alasan Penolakan" required>
          <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: nilai tidak sesuai BAST, faktur pajak belum dilampirkan…" />
        </Field>
      </Modal>

      <Modal
        open={refOpen}
        onClose={() => setRefOpen(false)}
        title="Ubah Dokumen Rujukan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefOpen(false)}>Batal</Button>
            <Button
              icon={Save}
              onClick={() => {
                const s = spks.find((x) => x.id === ref.spkId)
                const p = pos.find((x) => x.id === (ref.poId || s?.poId))
                updateInvoice(
                  inv.id,
                  { spkId: ref.spkId || undefined, poId: p?.id, prId: s?.prId ?? p?.prId, grId: ref.grId || undefined, fakturPajakNo: ref.fakturPajakNo || undefined },
                  'Dokumen rujukan diperbarui',
                )
                setRefOpen(false)
              }}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Ketik nomor dokumen — data akan terbaca otomatis.</p>
          <Field label="No. SPK">
            <DocNumberInput
              docs={spks.map((x) => ({ id: x.id, number: x.number, detail: `${x.title} • ${vendors.find((v) => v.id === x.vendorId)?.name ?? ''}` }))}
              value={ref.spkId}
              onResolve={(id) => setRef((r) => ({ ...r, spkId: id, poId: spks.find((x) => x.id === id)?.poId ?? r.poId }))}
              placeholder="Contoh: SPK/2026/NMS/001"
            />
          </Field>
          <Field label="No. PO">
            <DocNumberInput
              docs={pos.map((x) => ({ id: x.id, number: x.number, detail: `${vendors.find((v) => v.id === x.vendorId)?.name ?? ''} • ${formatIDR(poValue(x))}` }))}
              value={ref.poId}
              onResolve={(id) => setRef((r) => ({ ...r, poId: id }))}
              placeholder="Contoh: PO/2026/00001"
            />
          </Field>
          <Field label="No. BAST / GR">
            <DocNumberInput
              docs={grs.map((g) => ({ id: g.id, number: g.number, detail: `${g.description} • ${formatIDR(g.amount)}` }))}
              value={ref.grId}
              onResolve={(id) => setRef((r) => ({ ...r, grId: id }))}
              placeholder="Contoh: BAST/2026/0007"
            />
          </Field>
          <Field label="No. Faktur Pajak">
            <input className="input font-mono" value={ref.fakturPajakNo} onChange={(e) => setRef({ ...ref, fakturPajakNo: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-medium text-slate-900' : 'text-slate-600'} ${className ?? ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
