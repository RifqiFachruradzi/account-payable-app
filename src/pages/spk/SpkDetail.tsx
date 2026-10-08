import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, Gauge, Handshake, Pencil, ScanLine, Stamp } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { canApproveDocs, DOC_APPROVER_ROLES } from '@/lib/roles'
import { renderSpkDocument } from '@/lib/documents'
import { SignatureBox, SignatureDialog } from '@/components/docs/Signature'
import { DocPreviewButton } from '@/components/docs/DocPreview'
import { poValue, spkBilled, spkPaid } from '@/lib/calc'
import { formatDate, formatIDR } from '@/lib/format'
import { Badge, Button, Card, DescList, EmptyState, Field, Modal, PageHeader, Progress, StatusBadge } from '@/components/ui'
import type { SPKStatus } from '@/types'

export default function SpkDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { spks, vendors, pos, prs, grs, invoices, settings, updateSpk, notify } = useStore()
  const me = useCurrentUser()
  const [dialog, setDialog] = useState<'approve' | 'vendor' | 'cancel' | null>(null)
  const spk = spks.find((s) => s.id === id)
  const [open, setOpen] = useState(false)
  const [prog, setProg] = useState(0)
  const [status, setStatus] = useState<SPKStatus>('Berjalan')
  if (!spk) return <EmptyState title="SPK tidak ditemukan" />

  const vendor = vendors.find((v) => v.id === spk.vendorId)!
  const po = pos.find((p) => p.id === spk.poId)
  const pr = prs.find((p) => p.id === spk.prId)
  const invs = invoices.filter((i) => i.spkId === spk.id).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
  const bast = grs.filter((g) => g.spkId === spk.id)
  const billed = spkBilled(spk, invoices)
  const paid = spkPaid(spk, invoices)
  const remaining = spk.contractValue - billed
  const ppn = Math.round((spk.contractValue * spk.ppnRate) / 100)
  const approver = canApproveDocs(me.role)

  // Alokasikan invoice ke termin secara berurutan
  const valid = invs.filter((i) => i.status !== 'Ditolak')
  const isMonthly = spk.termins.length === 1
  const terminRows = isMonthly
    ? []
    : spk.termins.map((t, idx) => ({ t, amount: Math.round((spk.contractValue * t.percent) / 100), inv: valid[idx] }))

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'SPK', to: '/spk' }, { label: spk.number }]}
        title={<span className="flex flex-wrap items-center gap-3">{spk.title} <StatusBadge status={spk.status} /></span>}
        description={`${spk.number} • ${vendor.name}`}
        actions={
          <>
            <DocPreviewButton render={() => renderSpkDocument(spk, vendor, settings, po, pr)} fileName={`${spk.number.replace(/\//g, '-')}.jpg`} />
            {spk.status === 'Draft' && <Button variant="secondary" icon={Pencil} onClick={() => nav(`/spk/${spk.id}/edit`)}>Ubah</Button>}
            {(spk.status === 'Draft' || spk.status === 'Menunggu Konfirmasi Vendor') && (
              <Button variant="secondary" icon={Ban} className="!text-rose-600" onClick={() => setDialog('cancel')}>Batalkan</Button>
            )}
            {spk.status === 'Draft' && approver && <Button icon={Stamp} onClick={() => setDialog('approve')}>Setujui & Terbitkan</Button>}
            {spk.status === 'Menunggu Konfirmasi Vendor' && <Button variant="success" icon={Handshake} onClick={() => setDialog('vendor')}>Konfirmasi Vendor</Button>}
            {(spk.status === 'Berjalan' || spk.status === 'Selesai') && (
              <>
                <Button variant="secondary" icon={Gauge} onClick={() => { setProg(spk.progress); setStatus(spk.status); setOpen(true) }}>Update Progres</Button>
                <Button icon={ScanLine} onClick={() => nav('/scan')}>Scan Tagihan SPK</Button>
              </>
            )}
          </>
        }
      />

      {spk.status === 'Draft' && !approver && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SPK menunggu persetujuan & penerbitan oleh {DOC_APPROVER_ROLES.join(' / ')}. Ganti pengguna melalui menu profil untuk menyetujui.
        </div>
      )}
      {spk.status === 'Menunggu Konfirmasi Vendor' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          SPK sudah diterbitkan perusahaan. Catat konfirmasi (tanda tangan) vendor untuk memulai pekerjaan.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: 'Nilai Kontrak (DPP)', v: formatIDR(spk.contractValue), s: `+ PPN ${spk.ppnRate}% ${formatIDR(ppn)}` },
          { l: 'Sudah Ditagih', v: formatIDR(billed), s: `${Math.round((billed / spk.contractValue) * 100)}% dari kontrak`, p: (billed / spk.contractValue) * 100 },
          { l: 'Sudah Dibayar', v: formatIDR(paid), s: `${Math.round((paid / spk.contractValue) * 100)}% dari kontrak`, p: (paid / spk.contractValue) * 100 },
          { l: 'Sisa Outstanding SPK', v: formatIDR(remaining), s: `Progres fisik ${spk.progress}%`, p: spk.progress },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <p className="text-xs font-medium text-slate-500">{k.l}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{k.v}</p>
            {k.p !== undefined && <Progress value={k.p} className="mt-2" tone={k.l.startsWith('Sisa') ? 'emerald' : 'blue'} />}
            <p className="mt-1.5 text-xs text-slate-500">{k.s}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Detail SPK" className="xl:col-span-2">
          <DescList
            cols={3}
            items={[
              { label: 'Vendor', value: <Link className="text-brand-700 hover:underline" to={`/vendors/${vendor.id}`}>{vendor.name}</Link> },
              { label: 'NPWP Vendor', value: <span className="font-mono">{vendor.npwp}</span> },
              { label: 'Lokasi', value: spk.location },
              { label: 'Tanggal Mulai', value: formatDate(spk.startDate) },
              { label: 'Tanggal Selesai', value: formatDate(spk.endDate) },
              { label: 'PIC / Departemen', value: `${spk.pic} — ${spk.department}` },
              { label: 'Purchase Requisition', value: pr && <span className="font-mono">{pr.number}</span> },
              { label: 'Purchase Order', value: po && <span className="font-mono">{po.number} ({formatIDR(poValue(po))})</span> },
              { label: 'Skema Pembayaran', value: isMonthly ? 'Tagihan bulanan' : `${spk.termins.length} termin` },
              { label: 'Ruang Lingkup Pekerjaan', value: spk.scope, full: true },
            ]}
          />
        </Card>
        <Card title="BAST / Penerimaan" subtitle={`${bast.length} dokumen`}>
          {bast.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada BAST.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bast.map((g) => (
                <li key={g.id} className="py-2.5">
                  <p className="font-mono text-xs text-brand-700">{g.number}</p>
                  <p className="text-sm text-slate-700">{g.description}</p>
                  <p className="text-xs text-slate-500">{formatDate(g.date)} • {formatIDR(g.amount)} • {g.receivedBy}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!isMonthly && (
        <Card title="Jadwal Termin Pembayaran" bodyClass="!px-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th className="th">Termin</th><th className="th">Milestone</th><th className="th text-right">%</th><th className="th text-right">Nilai (DPP)</th><th className="th">Tagihan</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {terminRows.map(({ t, amount, inv }) => (
                  <tr key={t.id}>
                    <td className="td font-medium">{t.name}</td>
                    <td className="td text-slate-600">{t.milestone}</td>
                    <td className="td num">{t.percent}%</td>
                    <td className="td num">{formatIDR(amount)}</td>
                    <td className="td">{inv ? <Link className="font-mono text-xs text-brand-700 hover:underline" to={`/invoices/${inv.id}`}>{inv.vendorInvoiceNo}</Link> : <span className="text-xs text-slate-400">Belum ditagih</span>}</td>
                    <td className="td">{inv ? <StatusBadge status={inv.status} /> : <Badge>Outstanding</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Tagihan atas SPK ini" subtitle={`${invs.length} tagihan`} bodyClass="!px-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><th className="th">No. Tagihan</th><th className="th">Uraian</th><th className="th">Tgl Invoice</th><th className="th text-right">DPP</th><th className="th text-right">Netto</th><th className="th">Status</th></tr>
            </thead>
            <tbody>
              {invs.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/invoices/${i.id}`)}>
                  <td className="td"><p className="font-mono text-xs text-brand-700">{i.number}</p><p className="font-medium">{i.vendorInvoiceNo}</p></td>
                  <td className="td text-slate-600">{i.description}</td>
                  <td className="td whitespace-nowrap">{formatDate(i.invoiceDate)}</td>
                  <td className="td num">{formatIDR(i.dpp)}</td>
                  <td className="td num font-medium">{formatIDR(i.netPayable)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
              {invs.length === 0 && <tr><td className="td text-center text-slate-500" colSpan={6}>Belum ada tagihan.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Penerbitan & Persetujuan">
        <div className="grid gap-3 sm:grid-cols-2">
          <SignatureBox label="Pemberi Kerja (Perusahaan)" sig={spk.companyApproval} pending={spk.status === 'Draft' ? 'Menunggu penerbitan' : undefined} />
          <SignatureBox label="Penerima Kerja (Vendor)" sig={spk.vendorAcceptance} pending={spk.status === 'Menunggu Konfirmasi Vendor' ? 'Menunggu konfirmasi vendor' : undefined} />
        </div>
      </Card>

      <SignatureDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title="Setujui & Terbitkan SPK"
        description={`Nilai kontrak ${formatIDR(spk.contractValue + ppn)} (termasuk PPN) kepada ${vendor.name}`}
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Terbitkan SPK"
        onSign={(sig) => {
          updateSpk(spk.id, { status: 'Menunggu Konfirmasi Vendor', companyApproval: sig })
          setDialog(null)
          notify({ type: 'success', title: 'SPK diterbitkan', message: 'Menunggu konfirmasi vendor.' })
        }}
      />
      <SignatureDialog
        open={dialog === 'vendor'}
        onClose={() => setDialog(null)}
        title="Konfirmasi Vendor"
        description={`Tanda tangan perwakilan ${vendor.name} sebagai penerimaan perintah kerja.`}
        defaultName={vendor.contactPerson}
        defaultTitle={`Perwakilan ${vendor.name}`}
        confirmLabel="Simpan Konfirmasi"
        tone="success"
        onSign={(sig) => {
          updateSpk(spk.id, { status: 'Berjalan', vendorAcceptance: sig })
          setDialog(null)
          notify({ type: 'success', title: 'SPK dikonfirmasi vendor', message: 'Status SPK: Berjalan.' })
        }}
      />
      <SignatureDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Batalkan SPK"
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Batalkan SPK"
        tone="danger"
        onSign={(sig) => {
          updateSpk(spk.id, { status: 'Dibatalkan', notes: `Dibatalkan oleh ${sig.name}: ${sig.note}` })
          setDialog(null)
          notify({ type: 'info', title: 'SPK dibatalkan' })
        }}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Update Progres SPK"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={() => { updateSpk(spk.id, { progress: prog, status }); setOpen(false); notify({ type: 'success', title: 'Progres SPK diperbarui' }) }}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={`Progres Fisik: ${prog}%`}>
            <input type="range" min={0} max={100} value={prog} onChange={(e) => setProg(+e.target.value)} className="w-full accent-brand-600" />
          </Field>
          <Field label="Status SPK">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as SPKStatus)}>
              {['Draft', 'Berjalan', 'Selesai', 'Ditutup', 'Dibatalkan'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
