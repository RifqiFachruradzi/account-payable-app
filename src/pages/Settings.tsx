import { useState } from 'react'
import { Building, RotateCcw, Save, ShieldCheck, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { formatIDR } from '@/lib/format'
import { Button, Card, Field, PageHeader } from '@/components/ui'

export default function SettingsPage() {
  const { settings, users, updateSettings, resetData, notify } = useStore()
  const [s, setS] = useState(settings)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Profil perusahaan, matriks otorisasi pembayaran dan pengguna."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Pengaturan' }]}
        actions={
          <Button
            icon={Save}
            onClick={() => {
              updateSettings(s)
              notify({ type: 'success', title: 'Pengaturan disimpan' })
            }}
          >
            Simpan Perubahan
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Profil Perusahaan" icon={Building}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Perusahaan" className="sm:col-span-2"><input className="input" value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} /></Field>
            <Field label="NPWP Perusahaan" hint="Diabaikan saat OCR mencari NPWP vendor"><input className="input font-mono" value={s.companyNpwp} onChange={(e) => setS({ ...s, companyNpwp: e.target.value })} /></Field>
            <Field label="Tarif PPN Default (%)"><input type="number" className="input" value={s.defaultPpnRate} onChange={(e) => setS({ ...s, defaultPpnRate: +e.target.value })} /></Field>
            <Field label="Alamat" className="sm:col-span-2"><textarea rows={2} className="input" value={s.companyAddress} onChange={(e) => setS({ ...s, companyAddress: e.target.value })} /></Field>
            <Field label="Rekening Sumber Dana (satu per baris)" className="sm:col-span-2">
              <textarea rows={3} className="input" value={s.bankAccounts.join('\n')} onChange={(e) => setS({ ...s, bankAccounts: e.target.value.split('\n').filter(Boolean) })} />
            </Field>
          </div>
        </Card>
        <Card title="Matriks Otorisasi Pembayaran" icon={ShieldCheck} subtitle="Tahap wajib bila nilai bruto pengajuan ≥ batas minimum">
          <table className="w-full">
            <thead><tr><th className="th">Tahap</th><th className="th">Peran (PIC)</th><th className="th">Label TTD</th><th className="th text-right">Batas Minimum (Rp)</th></tr></thead>
            <tbody>
              {s.approvalMatrix.map((r, i) => (
                <tr key={r.role}>
                  <td className="td">{i + 1}</td>
                  <td className="td font-medium">{r.role}</td>
                  <td className="td"><input className="input" value={r.label} onChange={(e) => setS({ ...s, approvalMatrix: s.approvalMatrix.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></td>
                  <td className="td">
                    <input
                      type="number"
                      disabled={i === 0}
                      className="input text-right"
                      value={r.minAmount}
                      onChange={(e) => setS({ ...s, approvalMatrix: s.approvalMatrix.map((x, j) => (j === i ? { ...x, minAmount: +e.target.value } : x)) })}
                    />
                    <p className="mt-0.5 text-right text-[11px] text-slate-400">{r.minAmount ? `≥ ${formatIDR(r.minAmount)}` : 'Selalu'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Pengguna & Peran" icon={Users}>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{u.initials}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.title} • {u.email}</p>
                </div>
                <span className="text-xs text-slate-500">{u.role}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Data Demo" icon={RotateCcw} subtitle="Data tersimpan di browser (localStorage)">
          <p className="text-sm text-slate-600">Kembalikan seluruh data (vendor, SPK, PR/PO, tagihan, pengajuan & pembayaran) ke kondisi awal demo.</p>
          <Button
            className="mt-4"
            variant="danger"
            icon={RotateCcw}
            onClick={() => {
              if (!confirm('Reset seluruh data ke kondisi awal?')) return
              resetData()
              setS(useStore.getState().settings)
              notify({ type: 'success', title: 'Data direset' })
            }}
          >
            Reset Data Demo
          </Button>
        </Card>
      </div>
    </div>
  )
}
