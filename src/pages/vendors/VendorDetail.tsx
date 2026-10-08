import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Landmark, Mail, MapPin, Pencil, Phone, Trash2, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { outstandingAmount, spkBilled } from '@/lib/calc'
import { formatDate, formatIDR } from '@/lib/format'
import { Badge, Button, Card, DescList, EmptyState, PageHeader, Progress, StatusBadge, Tabs } from '@/components/ui'
import { VendorFormModal } from './VendorForm'

export default function VendorDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { vendors, invoices, spks, payments, deleteVendor, notify } = useStore()
  const v = vendors.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [tab, setTab] = useState<'inv' | 'spk' | 'pay'>('inv')
  if (!v) return <EmptyState title="Vendor tidak ditemukan" />

  const invs = invoices.filter((i) => i.vendorId === v.id).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
  const vspk = spks.filter((s) => s.vendorId === v.id)
  const pays = payments.filter((p) => p.vendorId === v.id).sort((a, b) => b.date.localeCompare(a.date))
  const out = invs.reduce((s, i) => s + outstandingAmount(i), 0)
  const paid = pays.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Vendor', to: '/vendors' }, { label: v.code }]}
        title={<span className="flex flex-wrap items-center gap-3">{v.name} <StatusBadge status={v.status} /></span>}
        description={`${v.code} • ${v.category}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Trash2}
              className="!text-rose-600"
              onClick={() => {
                if (!confirm(`Hapus vendor ${v.name}?`)) return
                if (deleteVendor(v.id)) {
                  notify({ type: 'success', title: 'Vendor dihapus' })
                  nav('/vendors')
                } else notify({ type: 'error', title: 'Vendor tidak dapat dihapus', message: 'Vendor sudah memiliki transaksi. Ubah status menjadi Non-Aktif.' })
              }}
            >
              Hapus
            </Button>
            <Button icon={Pencil} onClick={() => setEdit(true)}>Ubah Data</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Identitas & Perpajakan" className="xl:col-span-2">
          <DescList
            cols={3}
            items={[
              { label: 'NPWP', value: <span className="font-mono">{v.npwp}</span> },
              { label: 'NIB', value: v.nib && <span className="font-mono">{v.nib}</span> },
              { label: 'Bentuk Usaha', value: v.legalForm },
              { label: 'Status PKP', value: <Badge tone={v.isPkp ? 'violet' : 'slate'}>{v.isPkp ? 'Pengusaha Kena Pajak' : 'Non-PKP'}</Badge> },
              { label: 'Potongan PPh', value: v.withholdingTax },
              { label: 'Termin Pembayaran', value: `${v.paymentTermDays} hari` },
              { label: 'Terdaftar Sejak', value: formatDate(v.createdAt) },
              { label: 'Catatan', value: v.notes, full: true },
            ]}
          />
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <p className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 size-4 text-slate-400" />{v.address}, {v.city}, {v.province} {v.postalCode}</p>
            <p className="flex items-center gap-2 text-sm text-slate-600"><User className="size-4 text-slate-400" />{v.contactPerson}</p>
            <p className="flex items-center gap-2 text-sm text-slate-600"><Phone className="size-4 text-slate-400" />{v.phone}</p>
            <p className="flex items-center gap-2 text-sm text-slate-600"><Mail className="size-4 text-slate-400" />{v.email}</p>
          </div>
        </Card>
        <div className="space-y-6">
          <div className="card bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white">
            <p className="flex items-center gap-2 text-xs text-brand-100"><Landmark className="size-4" /> Rekening Pembayaran</p>
            <p className="mt-3 text-lg font-semibold">{v.bankName}</p>
            <p className="font-mono text-xl tracking-wider">{v.bankAccountNo}</p>
            <p className="mt-1 text-sm text-brand-100">a.n. {v.bankAccountName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 font-semibold tabular-nums">{formatIDR(out)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Total Dibayar</p><p className="mt-1 font-semibold tabular-nums text-emerald-700">{formatIDR(paid)}</p></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-4 pt-2">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'inv', label: 'Tagihan', count: invs.length }, { value: 'spk', label: 'SPK', count: vspk.length }, { value: 'pay', label: 'Pembayaran', count: pays.length }]} />
        </div>
        <div className="overflow-x-auto">
          {tab === 'inv' && (
            <table className="w-full">
              <thead><tr><th className="th">No. Tagihan</th><th className="th">Uraian</th><th className="th">Jatuh Tempo</th><th className="th text-right">Netto</th><th className="th">Status</th></tr></thead>
              <tbody>
                {invs.map((i) => (
                  <tr key={i.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/invoices/${i.id}`)}>
                    <td className="td"><p className="font-mono text-xs text-brand-700">{i.number}</p><p className="font-medium">{i.vendorInvoiceNo}</p></td>
                    <td className="td text-slate-600">{i.description}</td>
                    <td className="td whitespace-nowrap">{formatDate(i.dueDate)}</td>
                    <td className="td num font-medium">{formatIDR(i.netPayable)}</td>
                    <td className="td"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'spk' && (
            <table className="w-full">
              <thead><tr><th className="th">No. SPK</th><th className="th">Pekerjaan</th><th className="th">Progres</th><th className="th text-right">Kontrak</th><th className="th text-right">Sisa</th><th className="th">Status</th></tr></thead>
              <tbody>
                {vspk.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/spk/${s.id}`)}>
                    <td className="td font-mono text-xs text-brand-700">{s.number}</td>
                    <td className="td">{s.title}</td>
                    <td className="td w-36"><Progress value={s.progress} tone="emerald" /></td>
                    <td className="td num">{formatIDR(s.contractValue)}</td>
                    <td className="td num font-medium">{formatIDR(s.contractValue - spkBilled(s, invoices))}</td>
                    <td className="td"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'pay' && (
            <table className="w-full">
              <thead><tr><th className="th">No. Bukti</th><th className="th">Tanggal</th><th className="th">Ref. Bank</th><th className="th">Pengajuan</th><th className="th text-right">Jumlah</th></tr></thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id}>
                    <td className="td font-mono text-xs">{p.number}</td>
                    <td className="td">{formatDate(p.date)}</td>
                    <td className="td font-mono text-xs">{p.bankReference}</td>
                    <td className="td"><Link className="text-brand-700 hover:underline" to={`/payment-requests/${p.paymentRequestId}`}>Lihat</Link></td>
                    <td className="td num font-medium">{formatIDR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <VendorFormModal open={edit} onClose={() => setEdit(false)} vendor={v} />
    </div>
  )
}
