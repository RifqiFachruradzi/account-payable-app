import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { nextDocNumber, useCurrentUser, useStore } from '@/store/useStore'
import { uid } from '@/lib/id'
import { addDays, toISODate } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { Button, Card, EmptyState, Field, PageHeader } from '@/components/ui'
import { ItemsEditor, newItem } from '@/components/docs/ItemsEditor'
import type { PurchaseOrder } from '@/types'

export default function PoForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { pos, prs, vendors, settings, savePO, notify } = useStore()
  const me = useCurrentUser()
  const existing = pos.find((p) => p.id === id)
  const fromPr = prs.find((p) => p.id === params.get('pr'))
  const today = toISODate(new Date())
  const [f, setF] = useState<PurchaseOrder>(
    existing ?? {
      id: uid('po'),
      number: '',
      prId: fromPr?.id,
      vendorId: '',
      date: today,
      deliveryDate: fromPr?.neededDate ?? addDays(today, 14),
      deliveryAddress: settings.companyAddress,
      paymentTerms: '',
      items: fromPr ? fromPr.items.map((i) => ({ ...i, id: uid('li') })) : [newItem()],
      ppnRate: settings.defaultPpnRate,
      status: 'Draft',
      buyer: me.name,
      source: 'Manual',
    },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (id && !existing) return <EmptyState title="PO tidak ditemukan" />
  if (existing && existing.status !== 'Draft') return <EmptyState title="PO tidak dapat diubah" description={`PO berstatus ${existing.status}. Hanya PO Draft yang dapat diubah.`} />

  const set = <K extends keyof PurchaseOrder>(k: K, v: PurchaseOrder[K]) => setF((x) => ({ ...x, [k]: v }))
  const vendor = vendors.find((v) => v.id === f.vendorId)
  const approvedPrs = prs.filter((p) => p.status === 'Disetujui' || p.id === f.prId)

  const pickPr = (prId: string) => {
    const pr = prs.find((p) => p.id === prId)
    setF((x) => ({ ...x, prId: prId || undefined, ...(pr ? { items: pr.items.map((i) => ({ ...i, id: uid('li') })), deliveryDate: pr.neededDate ?? x.deliveryDate } : {}) }))
  }
  const pickVendor = (vid: string) => {
    const v = vendors.find((x) => x.id === vid)
    setF((x) => ({ ...x, vendorId: vid, ppnRate: v ? (v.isPkp ? settings.defaultPpnRate : 0) : x.ppnRate, paymentTerms: x.paymentTerms || (v ? `${v.paymentTermDays} hari` : '') }))
  }

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.vendorId) e.vendorId = 'Vendor wajib dipilih'
    if (!f.deliveryDate) e.deliveryDate = 'Tanggal pengiriman wajib diisi'
    else if (f.deliveryDate < f.date) e.deliveryDate = 'Tanggal kirim tidak boleh sebelum tanggal PO'
    if (f.items.some((i) => !i.description.trim() || i.qty <= 0 || i.unitPrice <= 0)) e.items = 'Setiap item harus memiliki uraian, qty > 0 dan harga > 0'
    setErrors(e)
    if (Object.keys(e).length) return
    const po: PurchaseOrder = { ...f, number: f.number || nextDocNumber('PO', pos.map((p) => p.number)), paymentTerms: f.paymentTerms || `${vendor?.paymentTermDays ?? 30} hari` }
    savePO(po)
    notify({ type: 'success', title: existing ? 'PO diperbarui' : 'PO dibuat (Draft)', message: `${po.number} — menunggu persetujuan perusahaan` })
    nav(`/po/${po.id}`)
  }

  return (
    <div>
      <PageHeader
        title={existing ? `Ubah ${existing.number}` : 'Buat Purchase Order'}
        description="PO diterbitkan Perusahaan kepada Vendor. Setelah disimpan, PO perlu disetujui Perusahaan lalu dikonfirmasi Vendor."
        breadcrumbs={[{ label: 'Purchase Order', to: '/po' }, { label: existing ? existing.number : 'Buat Baru' }]}
      />
      <div className="space-y-6">
        <Card title="Rujukan & Vendor">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Rujukan Purchase Request" hint="PR berstatus Disetujui" className="sm:col-span-2">
              <select className="input" value={f.prId ?? ''} onChange={(e) => pickPr(e.target.value)}>
                <option value="">— Tanpa PR —</option>
                {approvedPrs.map((p) => <option key={p.id} value={p.id}>{p.number} — {p.purpose} ({p.department})</option>)}
              </select>
            </Field>
            <Field label="Vendor" required error={errors.vendorId} className="sm:col-span-2">
              <select className="input" value={f.vendorId} onChange={(e) => pickVendor(e.target.value)}>
                <option value="">— Pilih vendor —</option>
                {vendors.filter((v) => v.status === 'Aktif').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {vendor && <p className="mt-1.5 text-xs text-slate-600">NPWP <span className="font-mono font-medium text-slate-800">{vendor.npwp}</span></p>}
              {vendor && <p className="mt-0.5 text-xs text-slate-500">{vendor.isPkp ? 'PKP' : 'Non-PKP'} • {vendor.withholdingTax} • {vendor.bankName} {vendor.bankAccountNo} • CP {vendor.contactPerson}</p>}
            </Field>
            <Field label="Tanggal PO"><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Tanggal Pengiriman" required error={errors.deliveryDate}><input type="date" className="input" value={f.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} /></Field>
            <Field label="Termin Pembayaran"><input className="input" value={f.paymentTerms ?? ''} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="30 hari setelah tagihan lengkap" /></Field>
            <Field label="Buyer (Procurement)"><input className="input" value={f.buyer} onChange={(e) => set('buyer', e.target.value)} /></Field>
            <Field label="Alamat Pengiriman" className="sm:col-span-2"><input className="input" value={f.deliveryAddress ?? ''} onChange={(e) => set('deliveryAddress', e.target.value)} /></Field>
            <Field label="Tarif PPN (%)"><input type="number" className="input" value={f.ppnRate} onChange={(e) => set('ppnRate', +e.target.value)} /></Field>
            <Field label="Catatan"><input className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          {f.prId && (
            <p className="mt-3 text-xs text-slate-500">
              Item diambil dari PR {prs.find((p) => p.id === f.prId)?.number} (dibutuhkan {formatDate(prs.find((p) => p.id === f.prId)?.neededDate)}). Sesuaikan harga dengan penawaran vendor.
            </p>
          )}
        </Card>
        <Card title="Item Pesanan">
          <ItemsEditor items={f.items} onChange={(items) => set('items', items)} ppnRate={f.ppnRate} />
          {errors.items && <p className="mt-2 text-xs text-rose-600">{errors.items}</p>}
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => nav(-1)}>Batal</Button>
          <Button icon={Save} onClick={submit}>Simpan PO</Button>
        </div>
      </div>
    </div>
  )
}
