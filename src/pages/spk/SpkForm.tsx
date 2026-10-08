import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Save, Trash2 } from 'lucide-react'
import { nextDocNumber, useCurrentUser, useStore } from '@/store/useStore'
import { uid } from '@/lib/id'
import { addDays, toISODate } from '@/lib/dates'
import { poValue } from '@/lib/calc'
import { formatIDR, terbilangRupiah } from '@/lib/format'
import { DEPARTMENTS } from '@/lib/roles'
import { Button, Card, EmptyState, Field, PageHeader } from '@/components/ui'
import type { SPK } from '@/types'
import { cn } from '@/lib/cn'

export default function SpkForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { spks, pos, prs, vendors, settings, saveSpk, notify } = useStore()
  const me = useCurrentUser()
  const existing = spks.find((s) => s.id === id)
  const fromPo = pos.find((p) => p.id === params.get('po'))
  const fromPr = prs.find((p) => p.id === fromPo?.prId)
  const today = toISODate(new Date())
  const [f, setF] = useState<SPK>(
    existing ?? {
      id: uid('spk'),
      number: '',
      date: today,
      poId: fromPo?.id,
      prId: fromPo?.prId,
      vendorId: fromPo?.vendorId ?? '',
      title: fromPr?.purpose ?? '',
      scope: '',
      location: '',
      startDate: addDays(today, 7),
      endDate: addDays(today, 97),
      contractValue: fromPo ? poValue(fromPo) : 0,
      ppnRate: fromPo?.ppnRate ?? settings.defaultPpnRate,
      progress: 0,
      termins: [
        { id: uid('t'), name: 'Uang Muka', percent: 30, milestone: 'Penandatanganan SPK' },
        { id: uid('t'), name: 'Pelunasan', percent: 70, milestone: 'BAST pekerjaan 100%' },
      ],
      pic: fromPr?.requester ?? me.name,
      department: fromPr?.department ?? 'General Affairs',
      status: 'Draft',
      source: 'Manual',
    },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (id && !existing) return <EmptyState title="SPK tidak ditemukan" />
  if (existing && existing.status !== 'Draft') return <EmptyState title="SPK tidak dapat diubah" description={`SPK berstatus ${existing.status}. Hanya SPK Draft yang dapat diubah.`} />

  const set = <K extends keyof SPK>(k: K, v: SPK[K]) => setF((x) => ({ ...x, [k]: v }))
  const vendor = vendors.find((v) => v.id === f.vendorId)
  const vendorPos = pos.filter((p) => p.vendorId === f.vendorId && !['Cancelled', 'Draft'].includes(p.status))
  const terminTotal = f.termins.reduce((s, t) => s + (t.percent || 0), 0)

  const pickPo = (poId: string) => {
    const po = pos.find((p) => p.id === poId)
    const pr = prs.find((p) => p.id === po?.prId)
    setF((x) => ({
      ...x,
      poId: poId || undefined,
      prId: po?.prId,
      ...(po ? { contractValue: poValue(po), ppnRate: po.ppnRate, title: x.title || pr?.purpose || '', department: pr?.department ?? x.department, pic: pr?.requester ?? x.pic } : {}),
    }))
  }

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.vendorId) e.vendorId = 'Vendor wajib dipilih'
    if (!f.title.trim()) e.title = 'Nama pekerjaan wajib diisi'
    if (!f.scope.trim()) e.scope = 'Ruang lingkup wajib diisi'
    if (!f.startDate || !f.endDate || f.endDate < f.startDate) e.dates = 'Periode pekerjaan tidak valid'
    if (f.contractValue <= 0) e.contractValue = 'Nilai kontrak harus lebih dari 0'
    if (Math.abs(terminTotal - 100) > 0.01) e.termins = `Total persentase termin ${terminTotal}% — harus 100%`
    if (f.termins.some((t) => !t.name.trim())) e.termins = 'Nama termin wajib diisi'
    setErrors(e)
    if (Object.keys(e).length) return
    const spk: SPK = { ...f, number: f.number || nextDocNumber('SPK', spks.map((s) => s.number)) }
    saveSpk(spk)
    notify({ type: 'success', title: existing ? 'SPK diperbarui' : 'SPK dibuat (Draft)', message: `${spk.number} — perlu diterbitkan & dikonfirmasi vendor` })
    nav(`/spk/${spk.id}`)
  }

  return (
    <div>
      <PageHeader
        title={existing ? `Ubah ${existing.number}` : 'Buat Surat Perintah Kerja'}
        description="SPK diterbitkan Perusahaan kepada Vendor sebagai perintah pelaksanaan pekerjaan dan dasar penagihan termin."
        breadcrumbs={[{ label: 'SPK', to: '/spk' }, { label: existing ? existing.number : 'Buat Baru' }]}
      />
      <div className="space-y-6">
        <Card title="Penerima Kerja (Vendor) & Rujukan">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vendor" required error={errors.vendorId} className="sm:col-span-2">
              <select className="input" value={f.vendorId} onChange={(e) => setF((x) => ({ ...x, vendorId: e.target.value, poId: undefined, prId: undefined, ppnRate: vendors.find((v) => v.id === e.target.value)?.isPkp === false ? 0 : x.ppnRate }))}>
                <option value="">— Pilih vendor —</option>
                {vendors.filter((v) => v.status === 'Aktif').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {vendor && <p className="mt-1.5 text-xs text-slate-600">NPWP <span className="font-mono font-medium text-slate-800">{vendor.npwp}</span></p>}
              {vendor && <p className="mt-0.5 text-xs text-slate-500">{vendor.address}, {vendor.city} • CP {vendor.contactPerson}</p>}
            </Field>
            <Field label="Rujukan PO (opsional)" className="sm:col-span-2">
              <select className="input" value={f.poId ?? ''} onChange={(e) => pickPo(e.target.value)} disabled={!f.vendorId}>
                <option value="">— Tanpa PO —</option>
                {vendorPos.map((p) => <option key={p.id} value={p.id}>{p.number} • {formatIDR(poValue(p))}</option>)}
              </select>
            </Field>
            <Field label="Tanggal SPK"><input type="date" className="input" value={f.date ?? today} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Departemen"><input className="input" list="spk-dept" value={f.department} onChange={(e) => set('department', e.target.value)} /><datalist id="spk-dept">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist></Field>
            <Field label="PIC Perusahaan"><input className="input" value={f.pic} onChange={(e) => set('pic', e.target.value)} /></Field>
            <Field label="Lokasi Pekerjaan"><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          </div>
        </Card>
        <Card title="Pekerjaan & Nilai Kontrak">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama Pekerjaan" required error={errors.title} className="sm:col-span-2 lg:col-span-4"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Ruang Lingkup Pekerjaan" required error={errors.scope} className="sm:col-span-2 lg:col-span-4"><textarea className="input" rows={3} value={f.scope} onChange={(e) => set('scope', e.target.value)} /></Field>
            <Field label="Tanggal Mulai" error={errors.dates}><input type="date" className="input" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
            <Field label="Tanggal Selesai"><input type="date" className="input" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
            <Field label="Nilai Kontrak / DPP (Rp)" required error={errors.contractValue}><input type="number" min={0} className="input text-right font-semibold" value={f.contractValue || ''} onChange={(e) => set('contractValue', +e.target.value)} /></Field>
            <Field label="Tarif PPN (%)"><input type="number" className="input text-right" value={f.ppnRate} onChange={(e) => set('ppnRate', +e.target.value)} /></Field>
          </div>
          {f.contractValue > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Total kontrak termasuk PPN: <b className="text-slate-800">{formatIDR(f.contractValue * (1 + f.ppnRate / 100))}</b> — <i>{terbilangRupiah(f.contractValue * (1 + f.ppnRate / 100))}</i>
            </p>
          )}
        </Card>
        <Card title="Termin Pembayaran" subtitle="Total persentase harus 100%">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th">Nama Termin</th><th className="th">Milestone / Syarat</th><th className="th w-28 text-right">%</th><th className="th w-44 text-right">Nilai (DPP)</th><th className="th w-10" /></tr></thead>
              <tbody>
                {f.termins.map((t) => (
                  <tr key={t.id}>
                    <td className="td"><input className="input" value={t.name} onChange={(e) => set('termins', f.termins.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} /></td>
                    <td className="td"><input className="input" value={t.milestone} onChange={(e) => set('termins', f.termins.map((x) => (x.id === t.id ? { ...x, milestone: e.target.value } : x)))} /></td>
                    <td className="td"><input type="number" min={0} max={100} className="input text-right" value={t.percent} onChange={(e) => set('termins', f.termins.map((x) => (x.id === t.id ? { ...x, percent: +e.target.value } : x)))} /></td>
                    <td className="td num">{formatIDR((f.contractValue * t.percent) / 100)}</td>
                    <td className="td">
                      <button type="button" disabled={f.termins.length === 1} onClick={() => set('termins', f.termins.filter((x) => x.id !== t.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label="Hapus termin"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-slate-50 font-semibold"><td className="td" colSpan={2}>Total</td><td className={cn('td num', Math.abs(terminTotal - 100) > 0.01 && 'text-rose-600')}>{terminTotal}%</td><td className="td num">{formatIDR((f.contractValue * terminTotal) / 100)}</td><td className="td" /></tr></tfoot>
            </table>
          </div>
          <button type="button" onClick={() => set('termins', [...f.termins, { id: uid('t'), name: `Termin ${f.termins.length + 1}`, percent: 0, milestone: '' }])} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
            <Plus className="size-4" /> Tambah Termin
          </button>
          {errors.termins && <p className="mt-2 text-xs text-rose-600">{errors.termins}</p>}
          <Field label="Catatan" className="mt-4"><textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => nav(-1)}>Batal</Button>
          <Button icon={Save} onClick={submit}>Simpan SPK</Button>
        </div>
      </div>
    </div>
  )
}
