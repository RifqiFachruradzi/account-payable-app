import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Download, Plus, ShieldCheck, Wallet } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { outstandingAmount } from '@/lib/calc'
import { formatCompact, formatIDR } from '@/lib/format'
import { exportCSV } from '@/lib/export'
import { Badge, Button, KpiCard, PageHeader, SearchInput, Select, StatusBadge } from '@/components/ui'
import { VendorFormModal } from './VendorForm'
import type { VendorCategory } from '@/types'

export default function VendorList() {
  const { vendors, invoices } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<VendorCategory | ''>('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(false)

  const outByVendor = useMemo(() => {
    const m = new Map<string, number>()
    invoices.forEach((i) => m.set(i.vendorId, (m.get(i.vendorId) ?? 0) + outstandingAmount(i)))
    return m
  }, [invoices])

  const list = vendors
    .filter((v) => !cat || v.category === cat)
    .filter((v) => !status || v.status === status)
    .filter((v) => !q || `${v.code} ${v.name} ${v.npwp} ${v.city} ${v.contactPerson}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.code.localeCompare(b.code))

  const cats = [...new Set(vendors.map((v) => v.category))]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Master Data"
        description="Data induk vendor: identitas, NPWP & status perpajakan, rekening bank serta termin pembayaran."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Vendor' }]}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() =>
                exportCSV(
                  'vendor-master.csv',
                  list.map((v) => ({
                    Kode: v.code, Nama: v.name, NPWP: v.npwp, NIB: v.nib, PKP: v.isPkp ? 'Ya' : 'Tidak', PPh: v.withholdingTax, Kategori: v.category,
                    Alamat: v.address, Kota: v.city, Provinsi: v.province, CP: v.contactPerson, Telepon: v.phone, Email: v.email,
                    Bank: v.bankName, Rekening: v.bankAccountNo, 'Atas Nama': v.bankAccountName, Termin: v.paymentTermDays, Status: v.status,
                  })),
                )
              }
            >
              Export
            </Button>
            <Button icon={Plus} onClick={() => setOpen(true)}>Tambah Vendor</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Vendor" value={vendors.length} hint={`${vendors.filter((v) => v.status === 'Aktif').length} aktif`} icon={Building2} />
        <KpiCard label="Vendor PKP" value={vendors.filter((v) => v.isPkp).length} hint="Wajib faktur pajak" icon={ShieldCheck} tone="violet" />
        <KpiCard label="Total Hutang Vendor" value={formatCompact([...outByVendor.values()].reduce((a, b) => a + b, 0))} hint="Outstanding seluruh vendor" icon={Wallet} tone="amber" />
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={q} onChange={setQ} className="w-full sm:w-80" placeholder="Cari nama, kode, NPWP, kota…" />
          <Select value={cat} onChange={setCat} placeholder="Semua kategori" options={cats.map((c) => ({ value: c, label: c }))} className="w-full sm:w-52" />
          <Select value={status} onChange={setStatus} placeholder="Semua status" options={['Aktif', 'Non-Aktif', 'Blacklist'].map((c) => ({ value: c, label: c }))} className="w-full sm:w-40" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Kode</th>
                <th className="th">Nama Vendor</th>
                <th className="th">NPWP</th>
                <th className="th">Pajak</th>
                <th className="th">Kategori</th>
                <th className="th">Rekening Bank</th>
                <th className="th text-right">Termin</th>
                <th className="th text-right">Outstanding</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/vendors/${v.id}`)}>
                  <td className="td font-mono text-xs text-slate-500">{v.code}</td>
                  <td className="td">
                    <p className="font-medium text-slate-800">{v.name}</p>
                    <p className="text-xs text-slate-500">{v.city} • {v.contactPerson}</p>
                  </td>
                  <td className="td whitespace-nowrap font-mono text-xs">{v.npwp}</td>
                  <td className="td">
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={v.isPkp ? 'violet' : 'slate'}>{v.isPkp ? 'PKP' : 'Non-PKP'}</Badge>
                      <span className="text-xs text-slate-500">{v.withholdingTax}</span>
                    </div>
                  </td>
                  <td className="td text-slate-600">{v.category}</td>
                  <td className="td whitespace-nowrap">
                    <p className="text-slate-700">{v.bankName}</p>
                    <p className="font-mono text-xs text-slate-500">{v.bankAccountNo}</p>
                  </td>
                  <td className="td num">{v.paymentTermDays} hr</td>
                  <td className="td num font-medium">{outByVendor.get(v.id) ? formatIDR(outByVendor.get(v.id)!) : <span className="text-slate-300">—</span>}</td>
                  <td className="td"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <VendorFormModal open={open} onClose={() => setOpen(false)} onSaved={(v) => nav(`/vendors/${v.id}`)} />
    </div>
  )
}
