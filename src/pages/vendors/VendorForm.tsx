import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import type { Vendor, VendorCategory, WithholdingTax } from '@/types'
import { useStore } from '@/store/useStore'
import { formatNPWP, npwpDigits, validateNPWP } from '@/lib/npwp'
import { uid } from '@/lib/id'
import { toISODate } from '@/lib/dates'
import { Button, Field, Modal } from '@/components/ui'

const CATEGORIES: VendorCategory[] = ['Konstruksi', 'Material & Barang', 'Jasa Profesional', 'IT & Telekomunikasi', 'Logistik', 'Facility Management']
const TAXES: WithholdingTax[] = ['PPh 23', 'PPh 4(2)', 'PPh 21', 'Tidak Ada']
const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'OCBC', 'Maybank', 'BTN']

const empty = (code: string): Vendor => ({
  id: '', code, name: '', legalForm: 'PT', npwp: '', nib: '', isPkp: true, category: 'Jasa Profesional', address: '', city: '', province: '',
  postalCode: '', contactPerson: '', phone: '', email: '', bankName: 'BCA', bankAccountNo: '', bankAccountName: '', paymentTermDays: 30,
  withholdingTax: 'PPh 23', status: 'Aktif', createdAt: toISODate(new Date()), notes: '',
})

export function VendorFormModal({ open, onClose, vendor, initial, onSaved }: {
  open: boolean
  onClose: () => void
  vendor?: Vendor
  initial?: Partial<Vendor>
  onSaved?: (v: Vendor) => void
}) {
  const vendors = useStore((s) => s.vendors)
  const saveVendor = useStore((s) => s.saveVendor)
  const notify = useStore((s) => s.notify)
  const nextCode = `VND-${String(vendors.length + 1).padStart(4, '0')}`
  const [f, setF] = useState<Vendor>(vendor ?? { ...empty(nextCode), ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setF(vendor ?? { ...empty(nextCode), ...initial })
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendor])

  const set = <K extends keyof Vendor>(k: K, v: Vendor[K]) => setF((x) => ({ ...x, [k]: v }))

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Nama vendor wajib diisi'
    const ne = validateNPWP(f.npwp)
    if (ne) e.npwp = ne
    else if (vendors.some((v) => v.id !== f.id && npwpDigits(v.npwp) === npwpDigits(f.npwp))) e.npwp = 'NPWP sudah terdaftar pada vendor lain'
    if (!f.address.trim()) e.address = 'Alamat wajib diisi'
    if (!f.city.trim()) e.city = 'Kota wajib diisi'
    if (!f.bankAccountNo.trim()) e.bankAccountNo = 'No. rekening wajib diisi'
    if (!f.bankAccountName.trim()) e.bankAccountName = 'Nama pemilik rekening wajib diisi'
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Format email tidak valid'
    setErrors(e)
    if (Object.keys(e).length) return
    const v: Vendor = { ...f, id: f.id || uid('v'), npwp: formatNPWP(f.npwp) }
    saveVendor(v)
    notify({ type: 'success', title: vendor ? 'Vendor diperbarui' : 'Vendor ditambahkan', message: v.name })
    onSaved?.(v)
    onClose()
  }

  const section = (t: string) => <p className="col-span-full mt-2 border-b border-slate-100 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t}</p>

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={vendor ? `Ubah Vendor — ${vendor.code}` : 'Tambah Vendor Baru'}
      description="Data master vendor digunakan untuk validasi tagihan, perpajakan dan pembayaran."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button icon={Save} onClick={submit}>Simpan Vendor</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        {section('Identitas & Legalitas')}
        <Field label="Kode Vendor" className="sm:col-span-2"><input className="input font-mono" value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Bentuk Usaha" className="sm:col-span-1">
          <select className="input" value={f.legalForm} onChange={(e) => set('legalForm', e.target.value as Vendor['legalForm'])}>
            {['PT', 'CV', 'UD', 'Perorangan', 'Koperasi'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Nama Vendor" required error={errors.name} className="sm:col-span-3"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="PT Contoh Abadi" /></Field>
        <Field label="NPWP" required error={errors.npwp} hint="15 digit (lama) atau 16 digit (NIK/NPWP baru)" className="sm:col-span-3">
          <input className="input font-mono" value={f.npwp} onChange={(e) => set('npwp', e.target.value)} onBlur={() => set('npwp', formatNPWP(f.npwp))} placeholder="00.000.000.0-000.000" />
        </Field>
        <Field label="NIB" className="sm:col-span-3"><input className="input font-mono" value={f.nib ?? ''} onChange={(e) => set('nib', e.target.value)} /></Field>
        <Field label="Status PKP" className="sm:col-span-2">
          <select className="input" value={f.isPkp ? '1' : '0'} onChange={(e) => set('isPkp', e.target.value === '1')}>
            <option value="1">PKP (memungut PPN)</option>
            <option value="0">Non-PKP</option>
          </select>
        </Field>
        <Field label="Potongan PPh" className="sm:col-span-2">
          <select className="input" value={f.withholdingTax} onChange={(e) => set('withholdingTax', e.target.value as WithholdingTax)}>
            {TAXES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Kategori" className="sm:col-span-2">
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as VendorCategory)}>
            {CATEGORIES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>

        {section('Alamat & Kontak')}
        <Field label="Alamat" required error={errors.address} className="sm:col-span-6"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Kota" required error={errors.city} className="sm:col-span-2"><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Provinsi" className="sm:col-span-2"><input className="input" value={f.province} onChange={(e) => set('province', e.target.value)} /></Field>
        <Field label="Kode Pos" className="sm:col-span-2"><input className="input" value={f.postalCode ?? ''} onChange={(e) => set('postalCode', e.target.value)} /></Field>
        <Field label="Contact Person" className="sm:col-span-2"><input className="input" value={f.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} /></Field>
        <Field label="Telepon" className="sm:col-span-2"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email Penagihan" error={errors.email} className="sm:col-span-2"><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>

        {section('Rekening Bank & Termin')}
        <Field label="Bank" className="sm:col-span-2">
          <select className="input" value={f.bankName} onChange={(e) => set('bankName', e.target.value)}>
            {[...new Set([f.bankName, ...BANKS])].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="No. Rekening" required error={errors.bankAccountNo} className="sm:col-span-2"><input className="input font-mono" value={f.bankAccountNo} onChange={(e) => set('bankAccountNo', e.target.value)} /></Field>
        <Field label="Termin Pembayaran (hari)" className="sm:col-span-2"><input type="number" min={0} className="input" value={f.paymentTermDays} onChange={(e) => set('paymentTermDays', +e.target.value)} /></Field>
        <Field label="Nama Pemilik Rekening" required error={errors.bankAccountName} className="sm:col-span-4"><input className="input" value={f.bankAccountName} onChange={(e) => set('bankAccountName', e.target.value)} /></Field>
        <Field label="Status Vendor" className="sm:col-span-2">
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value as Vendor['status'])}>
            {['Aktif', 'Non-Aktif', 'Blacklist'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Catatan" className="sm:col-span-6"><textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
