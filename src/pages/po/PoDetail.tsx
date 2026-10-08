import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, FileSignature, Handshake, Pencil, Stamp } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { poValue } from '@/lib/calc'
import { formatDate, formatIDR, terbilangRupiah } from '@/lib/format'
import { canApproveDocs, DOC_APPROVER_ROLES } from '@/lib/roles'
import { renderPoDocument } from '@/lib/documents'
import { Badge, Button, Card, DescList, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { SignatureBox, SignatureDialog } from '@/components/docs/Signature'
import { DocPreviewButton } from '@/components/docs/DocPreview'

export default function PoDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useCurrentUser()
  const { pos, prs, vendors, spks, grs, invoices, settings, updatePO, notify } = useStore()
  const po = pos.find((p) => p.id === id)
  const [dialog, setDialog] = useState<'approve' | 'vendor' | 'cancel' | null>(null)
  if (!po) return <EmptyState title="PO tidak ditemukan" />

  const vendor = vendors.find((v) => v.id === po.vendorId)!
  const pr = prs.find((p) => p.id === po.prId)
  const poSpks = spks.filter((s) => s.poId === po.id)
  const poGrs = grs.filter((g) => g.poId === po.id)
  const poInvs = invoices.filter((i) => i.poId === po.id)
  const sub = poValue(po)
  const ppn = Math.round((sub * po.ppnRate) / 100)
  const approver = canApproveDocs(me.role)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Purchase Order', to: '/po' }, { label: po.number }]}
        title={<span className="flex flex-wrap items-center gap-3">{po.number} <StatusBadge status={po.status} />{po.source === 'Import CSV' && <Badge>Import CSV</Badge>}</span>}
        description={`${vendor.name}${pr ? ` • ${pr.purpose}` : ''}`}
        actions={
          <>
            <DocPreviewButton render={() => renderPoDocument(po, vendor, settings, pr)} fileName={`${po.number.replace(/\//g, '-')}.jpg`} />
            {po.status === 'Draft' && <Button variant="secondary" icon={Pencil} onClick={() => nav(`/po/${po.id}/edit`)}>Ubah</Button>}
            {(po.status === 'Draft' || po.status === 'Menunggu Konfirmasi Vendor') && (
              <Button variant="secondary" icon={Ban} className="!text-rose-600" onClick={() => setDialog('cancel')}>Batalkan</Button>
            )}
            {po.status === 'Draft' && approver && <Button icon={Stamp} onClick={() => setDialog('approve')}>Setujui & Terbitkan</Button>}
            {po.status === 'Menunggu Konfirmasi Vendor' && <Button variant="success" icon={Handshake} onClick={() => setDialog('vendor')}>Konfirmasi Vendor</Button>}
            {po.status === 'Open' && poSpks.length === 0 && <Button variant="secondary" icon={FileSignature} onClick={() => nav(`/spk/new?po=${po.id}`)}>Buat SPK</Button>}
          </>
        }
      />

      {po.status === 'Draft' && !approver && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PO menunggu persetujuan perusahaan oleh {DOC_APPROVER_ROLES.join(' / ')}. Ganti pengguna melalui menu profil untuk menyetujui.
        </div>
      )}
      {po.status === 'Menunggu Konfirmasi Vendor' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          PO sudah disetujui perusahaan dan dikirim ke vendor. Catat konfirmasi (tanda tangan) vendor untuk mengaktifkan PO.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Informasi PO" className="xl:col-span-2">
          <DescList
            cols={3}
            items={[
              { label: 'Vendor', value: <Link className="text-brand-700 hover:underline" to={`/vendors/${vendor.id}`}>{vendor.name}</Link> },
              { label: 'NPWP Vendor', value: <span className="font-mono">{vendor.npwp}</span> },
              { label: 'Contact Person', value: vendor.contactPerson },
              { label: 'Tanggal PO', value: formatDate(po.date) },
              { label: 'Tanggal Pengiriman', value: formatDate(po.deliveryDate) },
              { label: 'Buyer', value: po.buyer },
              { label: 'Rujukan PR', value: pr ? <Link className="font-mono text-brand-700 hover:underline" to={`/pr/${pr.id}`}>{pr.number}</Link> : '-' },
              { label: 'Termin Pembayaran', value: po.paymentTerms },
              { label: 'PPN', value: `${po.ppnRate}%` },
              { label: 'Alamat Pengiriman', value: po.deliveryAddress, full: true },
              ...(po.notes ? [{ label: 'Catatan', value: po.notes, full: true }] : []),
            ]}
          />
        </Card>
        <Card title="Dokumen Terkait">
          <ul className="space-y-3 text-sm">
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SPK</p>
              {poSpks.length ? poSpks.map((s) => <Link key={s.id} to={`/spk/${s.id}`} className="block font-mono text-xs text-brand-700 hover:underline">{s.number}</Link>) : <p className="text-xs text-slate-500">—</p>}
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Penerimaan (GR/BAST)</p>
              {poGrs.length ? poGrs.map((g) => <p key={g.id} className="font-mono text-xs text-slate-600">{g.number} • {formatIDR(g.amount)}</p>) : <p className="text-xs text-slate-500">—</p>}
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tagihan</p>
              {poInvs.length ? poInvs.map((i) => <Link key={i.id} to={`/invoices/${i.id}`} className="flex items-center gap-2 font-mono text-xs text-brand-700 hover:underline">{i.vendorInvoiceNo} <StatusBadge status={i.status} /></Link>) : <p className="text-xs text-slate-500">—</p>}
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Item Pesanan" bodyClass="!px-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Uraian</th><th className="th text-right">Qty</th><th className="th text-right">Harga Satuan</th><th className="th text-right">Jumlah</th></tr></thead>
            <tbody>
              {po.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td">{it.description}</td>
                  <td className="td num">{it.qty.toLocaleString('id-ID')} {it.unit}</td>
                  <td className="td num">{formatIDR(it.unitPrice)}</td>
                  <td className="td num">{formatIDR(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto mt-4 max-w-sm space-y-1.5 px-5 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal (DPP)</span><span className="tabular-nums">{formatIDR(sub)}</span></div>
          <div className="flex justify-between text-slate-600"><span>PPN {po.ppnRate}%</span><span className="tabular-nums">{formatIDR(ppn)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><span>Total PO</span><span className="tabular-nums">{formatIDR(sub + ppn)}</span></div>
          <p className="text-right text-xs italic text-slate-500">{terbilangRupiah(sub + ppn)}</p>
        </div>
      </Card>

      <Card title="Persetujuan Perusahaan & Vendor">
        <div className="grid gap-3 sm:grid-cols-3">
          <SignatureBox label="Dibuat oleh (Procurement)" sig={{ name: po.buyer, title: 'Procurement', at: po.date }} />
          <SignatureBox label="Disetujui Perusahaan" sig={po.companyApproval} pending={po.status === 'Draft' ? 'Menunggu persetujuan' : undefined} />
          <SignatureBox label="Dikonfirmasi Vendor" sig={po.vendorAcceptance} pending={po.status === 'Menunggu Konfirmasi Vendor' ? 'Menunggu konfirmasi vendor' : undefined} />
        </div>
      </Card>

      <SignatureDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title="Setujui & Terbitkan PO"
        description={`Total ${formatIDR(sub + ppn)} kepada ${vendor.name}`}
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Setujui & Terbitkan"
        onSign={(sig) => {
          updatePO(po.id, { status: 'Menunggu Konfirmasi Vendor', companyApproval: sig })
          setDialog(null)
          notify({ type: 'success', title: 'PO disetujui & diterbitkan', message: 'Menunggu konfirmasi vendor.' })
        }}
      />
      <SignatureDialog
        open={dialog === 'vendor'}
        onClose={() => setDialog(null)}
        title="Konfirmasi Vendor"
        description={`Tanda tangan perwakilan ${vendor.name} sebagai persetujuan atas PO ini.`}
        defaultName={vendor.contactPerson}
        defaultTitle={`Perwakilan ${vendor.name}`}
        confirmLabel="Simpan Konfirmasi"
        tone="success"
        onSign={(sig) => {
          updatePO(po.id, { status: 'Open', vendorAcceptance: sig })
          setDialog(null)
          notify({ type: 'success', title: 'PO dikonfirmasi vendor', message: 'Status PO: Open.' })
        }}
      />
      <SignatureDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Batalkan PO"
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Batalkan PO"
        tone="danger"
        onSign={(sig) => {
          updatePO(po.id, { status: 'Cancelled', notes: `${po.notes ? `${po.notes} • ` : ''}Dibatalkan oleh ${sig.name}: ${sig.note}` })
          setDialog(null)
          notify({ type: 'info', title: 'PO dibatalkan' })
        }}
      />
    </div>
  )
}
