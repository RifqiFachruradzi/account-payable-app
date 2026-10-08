import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Pencil, Send, ShoppingCart, XCircle } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { itemsTotal, poValue } from '@/lib/calc'
import { formatDate, formatIDR, terbilangRupiah } from '@/lib/format'
import { canApproveDocs, DOC_APPROVER_ROLES } from '@/lib/roles'
import { renderPrDocument } from '@/lib/documents'
import { Badge, Button, Card, DescList, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { SignatureBox, SignatureDialog } from '@/components/docs/Signature'
import { DocPreviewButton } from '@/components/docs/DocPreview'

export default function PrDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useCurrentUser()
  const { prs, pos, vendors, settings, updatePR, notify } = useStore()
  const pr = prs.find((p) => p.id === id)
  const [dialog, setDialog] = useState<'submit' | 'approve' | 'reject' | null>(null)
  if (!pr) return <EmptyState title="PR tidak ditemukan" />

  const prPos = pos.filter((p) => p.prId === pr.id)
  const total = itemsTotal(pr.items)
  const approver = canApproveDocs(me.role)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Purchase Request', to: '/pr' }, { label: pr.number }]}
        title={<span className="flex flex-wrap items-center gap-3">{pr.number} <StatusBadge status={pr.status} />{pr.source === 'Import CSV' && <Badge>Import CSV</Badge>}</span>}
        description={`${pr.purpose} • ${pr.department}`}
        actions={
          <>
            <DocPreviewButton render={() => renderPrDocument(pr, settings)} fileName={`${pr.number.replace(/\//g, '-')}.jpg`} />
            {pr.status === 'Draft' && (
              <>
                <Button variant="secondary" icon={Pencil} onClick={() => nav(`/pr/${pr.id}/edit`)}>Ubah</Button>
                <Button icon={Send} onClick={() => setDialog('submit')}>Ajukan ke Procurement</Button>
              </>
            )}
            {pr.status === 'Diajukan' && approver && (
              <>
                <Button variant="secondary" icon={XCircle} className="!text-rose-600" onClick={() => setDialog('reject')}>Tolak</Button>
                <Button variant="success" icon={CheckCircle2} onClick={() => setDialog('approve')}>Setujui</Button>
              </>
            )}
            {pr.status === 'Disetujui' && <Button icon={ShoppingCart} onClick={() => nav(`/po/new?pr=${pr.id}`)}>Buat PO dari PR</Button>}
          </>
        }
      />

      {pr.status === 'Diajukan' && !approver && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PR menunggu persetujuan oleh {DOC_APPROVER_ROLES.join(' / ')}. Ganti pengguna melalui menu profil untuk menyetujui.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Informasi Permintaan" className="xl:col-span-2">
          <DescList
            cols={3}
            items={[
              { label: 'Dari (Departemen)', value: pr.department },
              { label: 'Pemohon', value: pr.requester },
              { label: 'Kepada', value: 'Bagian Procurement' },
              { label: 'Tanggal PR', value: formatDate(pr.date) },
              { label: 'Tanggal Dibutuhkan', value: formatDate(pr.neededDate) },
              { label: 'Cost Center', value: <span className="font-mono">{pr.costCenter}</span> },
              { label: 'Keperluan', value: pr.purpose, full: true },
              ...(pr.notes ? [{ label: 'Catatan', value: pr.notes, full: true }] : []),
            ]}
          />
        </Card>
        <Card title="Purchase Order Terkait" subtitle={`${prPos.length} PO`}>
          {prPos.length === 0 ? (
            <p className="text-sm text-slate-500">{pr.status === 'Disetujui' ? 'PR sudah disetujui dan siap diproses menjadi PO.' : 'Belum ada PO.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {prPos.map((o) => (
                <li key={o.id} className="py-2.5">
                  <Link to={`/po/${o.id}`} className="font-mono text-xs text-brand-700 hover:underline">{o.number}</Link>
                  <p className="text-sm text-slate-700">{vendors.find((v) => v.id === o.vendorId)?.name}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-500">{formatIDR(poValue(o))} <StatusBadge status={o.status} /></p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Barang / Jasa yang Diminta" bodyClass="!px-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Uraian</th><th className="th text-right">Qty</th><th className="th text-right">Harga Estimasi</th><th className="th text-right">Jumlah</th></tr></thead>
            <tbody>
              {pr.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td">{it.description}</td>
                  <td className="td num">{it.qty.toLocaleString('id-ID')} {it.unit}</td>
                  <td className="td num">{formatIDR(it.unitPrice)}</td>
                  <td className="td num">{formatIDR(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-slate-50 font-semibold"><td className="td" colSpan={4}>Total Estimasi</td><td className="td num">{formatIDR(total)}</td></tr></tfoot>
          </table>
        </div>
        <p className="px-5 pt-2 text-xs italic text-slate-500">{terbilangRupiah(total)}</p>
      </Card>

      <Card title="Persetujuan">
        <div className="grid gap-3 sm:grid-cols-3">
          <SignatureBox label="Diajukan oleh (User)" sig={pr.submitted} pending="Belum diajukan" />
          <SignatureBox label={pr.rejection ? 'Ditolak oleh' : 'Disetujui oleh (Atasan / Finance)'} sig={pr.rejection ?? pr.approval} pending={pr.status === 'Diajukan' ? 'Menunggu persetujuan' : undefined} />
          <SignatureBox label="Diproses Procurement" sig={prPos[0]?.companyApproval && { name: prPos[0].buyer, title: `Procurement — ${prPos[0].number}`, at: prPos[0].date }} pending="Belum diproses PO" />
        </div>
      </Card>

      <SignatureDialog
        open={dialog === 'submit'}
        onClose={() => setDialog(null)}
        title="Ajukan Purchase Request"
        description="Tanda tangan pemohon sebagai bukti pengajuan kepada Procurement."
        defaultName={pr.requester}
        defaultTitle={`User — ${pr.department}`}
        confirmLabel="Ajukan"
        onSign={(sig) => {
          updatePR(pr.id, { status: 'Diajukan', submitted: sig })
          setDialog(null)
          notify({ type: 'success', title: 'PR diajukan ke Procurement' })
        }}
      />
      <SignatureDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title="Setujui Purchase Request"
        description={`Total estimasi ${formatIDR(total)}`}
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Setujui"
        tone="success"
        onSign={(sig) => {
          updatePR(pr.id, { status: 'Disetujui', approval: sig, approvedBy: sig.name, rejection: undefined })
          setDialog(null)
          notify({ type: 'success', title: 'PR disetujui', message: 'Procurement dapat menerbitkan PO.' })
        }}
      />
      <SignatureDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Tolak Purchase Request"
        defaultName={me.name}
        defaultTitle={me.title}
        confirmLabel="Tolak PR"
        tone="danger"
        onSign={(sig) => {
          updatePR(pr.id, { status: 'Ditolak', rejection: sig })
          setDialog(null)
          notify({ type: 'info', title: 'PR ditolak' })
        }}
      />
    </div>
  )
}
