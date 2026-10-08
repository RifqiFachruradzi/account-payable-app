import type {
  ApprovalRule,
  ApprovalStep,
  AppUser,
  GoodsReceipt,
  Invoice,
  LineItem,
  PurchaseOrder,
  SPK,
  WithholdingTax,
} from '@/types'
import { daysOverdue } from './dates'

export const lineTotal = (i: LineItem) => i.qty * i.unitPrice
export const itemsTotal = (items: LineItem[]) => items.reduce((s, i) => s + lineTotal(i), 0)

export const pphRateFor = (t: WithholdingTax) =>
  t === 'PPh 23' ? 2 : t === 'PPh 4(2)' ? 2.65 : t === 'PPh 21' ? 2.5 : 0

export function computeInvoiceAmounts(dpp: number, ppnRate: number, pphRate: number) {
  const ppn = Math.round((dpp * ppnRate) / 100)
  const pph = Math.round((dpp * pphRate) / 100)
  const total = dpp + ppn
  return { ppn, pph, total, netPayable: total - pph }
}

export const isOutstanding = (inv: Invoice) => inv.status !== 'Dibayar' && inv.status !== 'Ditolak'
export const outstandingAmount = (inv: Invoice) => (isOutstanding(inv) ? inv.netPayable - inv.paidAmount : 0)

export type AgingBucket = 'Belum Jatuh Tempo' | '1-30 Hari' | '31-60 Hari' | '61-90 Hari' | '> 90 Hari'
export const AGING_BUCKETS: AgingBucket[] = ['Belum Jatuh Tempo', '1-30 Hari', '31-60 Hari', '61-90 Hari', '> 90 Hari']

export function agingBucket(dueDate: string): AgingBucket {
  const d = daysOverdue(dueDate)
  if (d <= 0) return 'Belum Jatuh Tempo'
  if (d <= 30) return '1-30 Hari'
  if (d <= 60) return '31-60 Hari'
  if (d <= 90) return '61-90 Hari'
  return '> 90 Hari'
}

/** Nilai SPK yang sudah ditagihkan (DPP) dari invoice non-ditolak */
export const spkBilled = (spk: SPK, invoices: Invoice[]) =>
  invoices.filter((i) => i.spkId === spk.id && i.status !== 'Ditolak').reduce((s, i) => s + i.dpp, 0)
export const spkPaid = (spk: SPK, invoices: Invoice[]) =>
  invoices.filter((i) => i.spkId === spk.id && i.status === 'Dibayar').reduce((s, i) => s + i.dpp, 0)

export const poValue = (po: PurchaseOrder) => itemsTotal(po.items)

export type MatchLevel = 'ok' | 'warn' | 'fail' | 'na'
export interface MatchCheck {
  key: string
  label: string
  level: MatchLevel
  detail: string
}

/** 3-way matching: Kontrak (PO/SPK) vs Penerimaan (GR/BAST) vs Tagihan */
export function matchInvoice(
  inv: Pick<Invoice, 'dpp' | 'vendorId' | 'spkId' | 'poId' | 'grId' | 'fakturPajakNo' | 'id'> & { ppn?: number },
  ctx: { spk?: SPK; po?: PurchaseOrder; gr?: GoodsReceipt; invoices: Invoice[]; vendorIsPkp?: boolean },
): MatchCheck[] {
  const checks: MatchCheck[] = []
  const { spk, po, gr, invoices } = ctx
  const otherBilled = (pred: (i: Invoice) => boolean) =>
    invoices.filter((i) => i.id !== inv.id && i.status !== 'Ditolak' && pred(i)).reduce((s, i) => s + i.dpp, 0)

  if (!spk && !po) {
    checks.push({ key: 'ref', label: 'Dokumen Rujukan (SPK/PO)', level: 'fail', detail: 'Tagihan belum terhubung ke SPK atau PO' })
  }
  if (spk) {
    const billed = otherBilled((i) => i.spkId === spk.id)
    const remaining = spk.contractValue - billed
    checks.push({
      key: 'vendor-spk',
      label: 'Vendor sesuai SPK',
      level: spk.vendorId === inv.vendorId ? 'ok' : 'fail',
      detail: spk.vendorId === inv.vendorId ? 'Vendor pada tagihan sama dengan vendor SPK' : 'Vendor pada tagihan berbeda dengan SPK',
    })
    checks.push({
      key: 'spk-value',
      label: 'Nilai ≤ Sisa Kontrak SPK',
      level: inv.dpp <= remaining + 1 ? 'ok' : 'fail',
      detail: `Sisa kontrak ${fmt(remaining)} • Tagihan ${fmt(inv.dpp)}`,
    })
    checks.push({
      key: 'spk-status',
      label: 'Status SPK',
      level: spk.status === 'Berjalan' || spk.status === 'Selesai' ? 'ok' : 'warn',
      detail: `SPK berstatus ${spk.status} • progres ${spk.progress}%`,
    })
  }
  if (po) {
    const value = poValue(po)
    const billed = otherBilled((i) => i.poId === po.id)
    checks.push({
      key: 'vendor-po',
      label: 'Vendor sesuai PO',
      level: po.vendorId === inv.vendorId ? 'ok' : 'fail',
      detail: po.vendorId === inv.vendorId ? 'Vendor sesuai dengan PO' : 'Vendor berbeda dengan PO',
    })
    if (!spk) {
      checks.push({
        key: 'po-value',
        label: 'Nilai ≤ Sisa PO',
        level: inv.dpp <= value - billed + 1 ? 'ok' : 'fail',
        detail: `Sisa PO ${fmt(value - billed)} • Tagihan ${fmt(inv.dpp)}`,
      })
    }
  }
  if (gr) {
    const diff = Math.abs(gr.amount - inv.dpp)
    const tol = gr.amount * 0.01
    checks.push({
      key: 'gr',
      label: `Penerimaan (${gr.type})`,
      level: diff <= tol ? 'ok' : inv.dpp < gr.amount ? 'warn' : 'fail',
      detail: `${gr.number} senilai ${fmt(gr.amount)}${diff <= tol ? ' — sesuai' : ` — selisih ${fmt(diff)}`}`,
    })
  } else if (spk || po) {
    checks.push({ key: 'gr', label: 'Penerimaan (GR/BAST)', level: 'warn', detail: 'Belum ada GR/BAST yang dirujuk' })
  }
  if (ctx.vendorIsPkp) {
    checks.push({
      key: 'faktur',
      label: 'Faktur Pajak',
      level: inv.fakturPajakNo ? 'ok' : 'warn',
      detail: inv.fakturPajakNo ? `No. ${inv.fakturPajakNo}` : 'Vendor PKP — nomor faktur pajak belum diisi',
    })
  }
  return checks
}

export const matchSummary = (checks: MatchCheck[]): MatchLevel =>
  checks.some((c) => c.level === 'fail') ? 'fail' : checks.some((c) => c.level === 'warn') ? 'warn' : checks.length ? 'ok' : 'na'

const fmt = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`

/** Bangun tahapan otorisasi berdasarkan matriks & nilai pengajuan */
export function buildApprovalSteps(amount: number, matrix: ApprovalRule[], creator: AppUser): ApprovalStep[] {
  return matrix
    .filter((r, idx) => idx === 0 || amount >= r.minAmount)
    .map((r, i) => ({
      level: i + 1,
      role: r.role,
      label: r.label,
      status: i === 0 ? 'Disetujui' : 'Menunggu',
      ...(i === 0 ? { userId: creator.id, userName: creator.name, signedAt: new Date().toISOString() } : {}),
    }))
}
