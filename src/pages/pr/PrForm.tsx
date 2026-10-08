import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Send } from 'lucide-react'
import { nextDocNumber, useCurrentUser, useStore } from '@/store/useStore'
import { uid } from '@/lib/id'
import { addDays, toISODate } from '@/lib/dates'
import { DEPARTMENTS } from '@/lib/roles'
import { Button, Card, EmptyState, Field, PageHeader } from '@/components/ui'
import { ItemsEditor, newItem } from '@/components/docs/ItemsEditor'
import { SignatureDialog } from '@/components/docs/Signature'
import type { PurchaseRequisition } from '@/types'

export default function PrForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const { prs, savePR, notify } = useStore()
  const me = useCurrentUser()
  const existing = prs.find((p) => p.id === id)
  const today = toISODate(new Date())
  const [f, setF] = useState<PurchaseRequisition>(
    existing ?? {
      id: uid('pr'),
      number: '',
      date: today,
      department: 'General Affairs',
      requester: me.name,
      costCenter: '',
      purpose: '',
      neededDate: addDays(today, 14),
      items: [newItem()],
      status: 'Draft',
      source: 'Manual',
    },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [signOpen, setSignOpen] = useState(false)

  if (id && !existing) return <EmptyState title="PR tidak ditemukan" />
  if (existing && existing.status !== 'Draft') return <EmptyState title="PR tidak dapat diubah" description={`PR berstatus ${existing.status}. Hanya PR Draft yang dapat diubah.`} />

  const set = <K extends keyof PurchaseRequisition>(k: K, v: PurchaseRequisition[K]) => setF((x) => ({ ...x, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.department.trim()) e.department = 'Departemen wajib diisi'
    if (!f.requester.trim()) e.requester = 'Nama pemohon wajib diisi'
    if (!f.purpose.trim()) e.purpose = 'Keperluan wajib diisi'
    if (f.neededDate && f.neededDate < f.date) e.neededDate = 'Tanggal dibutuhkan tidak boleh sebelum tanggal PR'
    if (f.items.some((i) => !i.description.trim() || i.qty <= 0)) e.items = 'Setiap item harus memiliki uraian dan qty > 0'
    setErrors(e)
    return !Object.keys(e).length
  }

  const persist = (patch: Partial<PurchaseRequisition> = {}) => {
    const pr: PurchaseRequisition = {
      ...f,
      ...patch,
      number: f.number || nextDocNumber('PR', prs.map((p) => p.number), { dept: f.department }),
      costCenter: f.costCenter || '-',
    }
    savePR(pr)
    return pr
  }

  return (
    <div>
      <PageHeader
        title={existing ? `Ubah ${existing.number}` : 'Buat Purchase Request'}
        description="PR diajukan oleh User (departemen) kepada Procurement dan memerlukan persetujuan atasan / Finance sebelum diproses menjadi PO."
        breadcrumbs={[{ label: 'Purchase Request', to: '/pr' }, { label: existing ? existing.number : 'Buat Baru' }]}
      />
      <div className="space-y-6">
        <Card title="Informasi Permintaan">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Departemen Pemohon" required error={errors.department}>
              <input className="input" list="departments" value={f.department} onChange={(e) => set('department', e.target.value)} />
              <datalist id="departments">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
            </Field>
            <Field label="Nama Pemohon (User)" required error={errors.requester}><input className="input" value={f.requester} onChange={(e) => set('requester', e.target.value)} /></Field>
            <Field label="Cost Center"><input className="input font-mono" value={f.costCenter} onChange={(e) => set('costCenter', e.target.value)} placeholder="CC-XX-01" /></Field>
            <Field label="Ditujukan kepada"><input className="input" value="Bagian Procurement" disabled /></Field>
            <Field label="Tanggal PR"><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Tanggal Dibutuhkan" error={errors.neededDate}><input type="date" className="input" value={f.neededDate ?? ''} onChange={(e) => set('neededDate', e.target.value)} /></Field>
            <Field label="Keperluan / Judul Permintaan" required error={errors.purpose} className="sm:col-span-2"><input className="input" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Contoh: Pengadaan laptop karyawan baru" /></Field>
            <Field label="Catatan / Justifikasi" className="sm:col-span-2 lg:col-span-4"><textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
        </Card>
        <Card title="Barang / Jasa yang Diminta" subtitle="Harga merupakan estimasi pemohon — harga final ditetapkan Procurement pada PO">
          <ItemsEditor items={f.items} onChange={(items) => set('items', items)} priceLabel="Harga Estimasi" />
          {errors.items && <p className="mt-2 text-xs text-rose-600">{errors.items}</p>}
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => nav(-1)}>Batal</Button>
          <Button
            variant="secondary"
            icon={Save}
            onClick={() => {
              if (!validate()) return
              const pr = persist()
              notify({ type: 'success', title: 'Draft PR disimpan', message: pr.number })
              nav(`/pr/${pr.id}`)
            }}
          >
            Simpan Draft
          </Button>
          <Button icon={Send} onClick={() => validate() && setSignOpen(true)}>Simpan & Ajukan ke Procurement</Button>
        </div>
      </div>
      <SignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title="Ajukan Purchase Request"
        description="Tanda tangan pemohon sebagai bukti pengajuan kepada Procurement."
        defaultName={f.requester}
        defaultTitle={`User — ${f.department}`}
        confirmLabel="Ajukan"
        onSign={(sig) => {
          const pr = persist({ status: 'Diajukan', submitted: sig })
          setSignOpen(false)
          notify({ type: 'success', title: 'PR diajukan', message: `${pr.number} menunggu persetujuan` })
          nav(`/pr/${pr.id}`)
        }}
      />
    </div>
  )
}
