import type { GoodsReceipt, Invoice, PurchaseOrder, SPK, Vendor } from '@/types'
import type { ParsedInvoice } from './ocr'
import { sameNPWP } from './npwp'
import { spkBilled } from './calc'

export interface ResolvedRefs {
  vendorId?: string
  vendorBy?: 'NPWP' | 'Nama' | 'Rekening'
  spkId?: string
  poId?: string
  prId?: string
  grId?: string
  notes: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/\b(pt|cv|ud|tbk)\b\.?/g, '').replace(/[^a-z0-9]/g, '')
const normDoc = (s: string) => s.toUpperCase().replace(/\s/g, '')

/** Tarik dokumen internal (Vendor, SPK, PO, PR, GR/BAST) berdasarkan hasil baca tagihan */
export function resolveReferences(
  p: ParsedInvoice,
  db: { vendors: Vendor[]; spks: SPK[]; pos: PurchaseOrder[]; grs: GoodsReceipt[]; invoices: Invoice[] },
): ResolvedRefs {
  const r: ResolvedRefs = { notes: [] }

  // 1) Vendor: NPWP → rekening → nama
  let vendor = p.npwp ? db.vendors.find((v) => sameNPWP(v.npwp, p.npwp)) : undefined
  if (vendor) r.vendorBy = 'NPWP'
  if (!vendor && p.bankAccountNo) {
    vendor = db.vendors.find((v) => v.bankAccountNo.replace(/\D/g, '') === p.bankAccountNo)
    if (vendor) r.vendorBy = 'Rekening'
  }
  if (!vendor && p.vendorName) {
    const k = norm(p.vendorName)
    vendor = db.vendors.find((v) => norm(v.name) === k) ?? db.vendors.find((v) => k.length > 5 && (norm(v.name).includes(k) || k.includes(norm(v.name))))
    if (vendor) r.vendorBy = 'Nama'
  }

  // 2) SPK & PO dari nomor tercetak
  let spk = p.spkNo ? db.spks.find((s) => normDoc(s.number) === normDoc(p.spkNo!)) : undefined
  let po = p.poNo ? db.pos.find((x) => normDoc(x.number) === normDoc(p.poNo!)) : undefined
  if (p.spkNo && !spk) r.notes.push(`No. SPK ${p.spkNo} tidak ditemukan di sistem`)
  if (p.poNo && !po) r.notes.push(`No. PO ${p.poNo} tidak ditemukan di sistem`)

  if (!vendor && (spk || po)) {
    vendor = db.vendors.find((v) => v.id === (spk?.vendorId ?? po?.vendorId))
    if (vendor) r.vendorBy = 'Nama'
  }
  if (vendor) r.vendorId = vendor.id

  // 3) Jika nomor tidak tercetak → cari SPK aktif vendor yang sisa kontraknya cukup
  if (!spk && !po && vendor) {
    const cands = db.spks.filter((s) => s.vendorId === vendor!.id && s.status === 'Berjalan' && s.contractValue - spkBilled(s, db.invoices) >= (p.dpp ?? 0))
    if (cands.length === 1) {
      spk = cands[0]
      r.notes.push('SPK dipilih otomatis (satu-satunya SPK aktif vendor dengan sisa kontrak mencukupi)')
    } else if (cands.length > 1) r.notes.push(`${cands.length} SPK aktif ditemukan untuk vendor — pilih rujukan yang sesuai`)
  }
  if (spk && !po && spk.poId) po = db.pos.find((x) => x.id === spk!.poId)
  if (po && !spk) spk = db.spks.find((s) => s.poId === po!.id)

  r.spkId = spk?.id
  r.poId = po?.id
  r.prId = spk?.prId ?? po?.prId

  // 4) GR/BAST yang belum dipakai tagihan lain, nilai paling mendekati
  const used = new Set(db.invoices.filter((i) => i.status !== 'Ditolak').map((i) => i.grId))
  const grs = db.grs.filter((g) => !used.has(g.id) && ((spk && g.spkId === spk.id) || (po && g.poId === po.id)))
  if (grs.length) {
    const target = p.dpp ?? 0
    r.grId = grs.sort((a, b) => Math.abs(a.amount - target) - Math.abs(b.amount - target))[0].id
  }
  return r
}
