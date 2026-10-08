import type { LineItem, PurchaseOrder, PurchaseRequisition, SPK, SPKTermin, Vendor } from '@/types'
import { nextDocNumber } from '@/store/useStore'
import { parseCsvDate, parseNumber } from './csv'
import { npwpDigits } from './npwp'
import { uid } from './id'
import { toISODate } from './dates'

export interface ImportError {
  row: number
  message: string
}
export interface ImportResult<T> {
  docs: T[]
  errors: ImportError[]
  /** baris CSV sumber untuk tiap dokumen */
  rowsOf: Map<string, number[]>
}

export interface ImportDb {
  vendors: Vendor[]
  prs: PurchaseRequisition[]
  pos: PurchaseOrder[]
  spks: SPK[]
  userName: string
}

type Row = Record<string, string>

export const findVendor = (vendors: Vendor[], key: string) => {
  const k = key.trim().toLowerCase()
  if (!k) return undefined
  const d = npwpDigits(k)
  return (
    vendors.find((v) => v.code.toLowerCase() === k) ??
    (d.length >= 15 ? vendors.find((v) => npwpDigits(v.npwp) === d || npwpDigits(v.npwp) === `0${d}` || `0${npwpDigits(v.npwp)}` === d) : undefined) ??
    vendors.find((v) => v.name.toLowerCase() === k)
  )
}

/** Kelompokkan baris berdasarkan kolom no_ref (satu dokumen bisa beberapa baris item) */
function group(rows: Row[]) {
  const map = new Map<string, { first: Row; rows: { r: Row; line: number }[] }>()
  rows.forEach((r, i) => {
    const ref = r.no_ref || `#${i}`
    if (!map.has(ref)) map.set(ref, { first: r, rows: [] })
    map.get(ref)!.rows.push({ r, line: i + 2 })
  })
  return [...map.values()]
}

function items(rows: { r: Row; line: number }[], priceKey: string, errors: ImportError[]): LineItem[] {
  const out: LineItem[] = []
  for (const { r, line } of rows) {
    if (!r.item) {
      errors.push({ row: line, message: 'Kolom item kosong' })
      continue
    }
    const qty = parseNumber(r.qty)
    const price = parseNumber(r[priceKey])
    if (!qty || qty <= 0) errors.push({ row: line, message: `Qty tidak valid: "${r.qty ?? ''}"` })
    if (price === undefined || price < 0) errors.push({ row: line, message: `Harga tidak valid: "${r[priceKey] ?? ''}"` })
    out.push({ id: uid('li'), description: r.item, qty: qty ?? 0, unit: r.satuan || 'Unit', unitPrice: price ?? 0 })
  }
  return out
}

const req = (r: Row, key: string, label: string, line: number, errors: ImportError[]) => {
  if (!r[key]) errors.push({ row: line, message: `${label} wajib diisi (kolom ${key})` })
  return r[key] ?? ''
}

// ---------------------------------------------------------------- PR
export const PR_TEMPLATE = {
  file: 'template_purchase_request.csv',
  headers: ['no_ref', 'tanggal', 'departemen', 'pemohon', 'cost_center', 'keperluan', 'tanggal_dibutuhkan', 'item', 'qty', 'satuan', 'harga_estimasi', 'catatan'],
  rows: [
    ['PR-1', '2026-10-08', 'General Affairs', 'Agus Salim', 'CC-GA-01', 'Pengadaan ATK Kuartal IV', '2026-10-20', 'Kertas HVS A4 80gr', '50', 'Rim', '55000', ''],
    ['PR-1', '2026-10-08', 'General Affairs', 'Agus Salim', 'CC-GA-01', 'Pengadaan ATK Kuartal IV', '2026-10-20', 'Toner printer laser', '10', 'Pcs', '850000', ''],
    ['PR-2', '09/10/2026', 'Information Technology', 'Fajar Nugroho', 'CC-IT-01', 'Lisensi antivirus endpoint', '01/11/2026', 'Lisensi antivirus 1 tahun', '150', 'User', '210.000', 'Perpanjangan'],
  ],
  notes: [
    'Satu PR bisa terdiri dari beberapa baris item — gunakan no_ref yang sama.',
    'Tanggal: YYYY-MM-DD, DD/MM/YYYY, atau "08 Oktober 2026".',
    'Angka boleh memakai pemisah ribuan (1.500.000). Pemisah kolom ; atau ,.',
    'PR hasil import berstatus Diajukan dan menunggu persetujuan.',
  ],
}

export function importPR(rows: Row[], db: ImportDb): ImportResult<PurchaseRequisition> {
  const errors: ImportError[] = []
  const docs: PurchaseRequisition[] = []
  const rowsOf = new Map<string, number[]>()
  const existing = db.prs.map((p) => p.number)
  for (const g of group(rows)) {
    const f = g.first
    const line = g.rows[0].line
    const errCount = errors.length
    const date = parseCsvDate(f.tanggal) ?? (f.tanggal ? undefined : toISODate(new Date()))
    if (!date) errors.push({ row: line, message: `Tanggal tidak valid: "${f.tanggal}"` })
    const department = req(f, 'departemen', 'Departemen', line, errors)
    const requester = req(f, 'pemohon', 'Pemohon', line, errors)
    const purpose = req(f, 'keperluan', 'Keperluan', line, errors)
    const its = items(g.rows, 'harga_estimasi', errors)
    if (errors.length > errCount) continue
    const number = nextDocNumber('PR', [...existing, ...docs.map((d) => d.number)], { dept: department })
    const pr: PurchaseRequisition = {
      id: uid('pr'), number, date: date!, department, requester, costCenter: f.cost_center || '-', purpose,
      neededDate: parseCsvDate(f.tanggal_dibutuhkan), items: its, status: 'Diajukan', notes: f.catatan || undefined, source: 'Import CSV',
      submitted: { name: requester, title: `User — ${department}`, at: new Date().toISOString(), note: `Diimport oleh ${db.userName}` },
    }
    docs.push(pr)
    rowsOf.set(pr.id, g.rows.map((x) => x.line))
  }
  return { docs, errors, rowsOf }
}

// ---------------------------------------------------------------- PO
export const PO_TEMPLATE = {
  file: 'template_purchase_order.csv',
  headers: ['no_ref', 'tanggal', 'no_pr', 'vendor', 'tanggal_kirim', 'ppn_persen', 'termin_pembayaran', 'alamat_kirim', 'buyer', 'status', 'disetujui_oleh', 'dikonfirmasi_vendor_oleh', 'item', 'qty', 'satuan', 'harga'],
  rows: [
    ['PO-1', '2026-10-08', 'PR/2026/GEN/0012', 'VND-0004', '2026-10-22', '11', '45 hari setelah tagihan lengkap', 'Gudang Cakung', 'Yohanes Prasetyo', 'Draft', '', '', 'Kursi ergonomis mesh', '40', 'Unit', '2.750.000'],
    ['PO-2', '2026-10-08', '', '02.118.456.3-062.000', '2026-10-30', '11', '30 hari', 'Kantor Pusat', 'Yohanes Prasetyo', 'Open', 'Budi Santoso', 'Kevin Saputra', 'Switch 48 port PoE', '4', 'Unit', '18500000'],
    ['PO-2', '2026-10-08', '', '02.118.456.3-062.000', '2026-10-30', '11', '30 hari', 'Kantor Pusat', 'Yohanes Prasetyo', 'Open', 'Budi Santoso', 'Kevin Saputra', 'Jasa instalasi', '1', 'Ls', '6000000'],
  ],
  notes: [
    'Kolom vendor diisi kode vendor (VND-xxxx), NPWP, atau nama vendor persis seperti di Vendor Master.',
    'no_pr opsional; jika diisi harus nomor PR yang ada dan PR akan berstatus Diproses PO.',
    'status: Draft (default — perlu persetujuan perusahaan & konfirmasi vendor di aplikasi) atau Open (sudah disetujui; isi disetujui_oleh & dikonfirmasi_vendor_oleh).',
    'Satu PO bisa beberapa baris item dengan no_ref yang sama.',
  ],
}

export function importPO(rows: Row[], db: ImportDb): ImportResult<PurchaseOrder> {
  const errors: ImportError[] = []
  const docs: PurchaseOrder[] = []
  const rowsOf = new Map<string, number[]>()
  const existing = db.pos.map((p) => p.number)
  for (const g of group(rows)) {
    const f = g.first
    const line = g.rows[0].line
    const errCount = errors.length
    const date = parseCsvDate(f.tanggal) ?? (f.tanggal ? undefined : toISODate(new Date()))
    if (!date) errors.push({ row: line, message: `Tanggal tidak valid: "${f.tanggal}"` })
    const vendor = findVendor(db.vendors, f.vendor ?? '')
    if (!vendor) errors.push({ row: line, message: `Vendor "${f.vendor ?? ''}" tidak ditemukan di Vendor Master` })
    else if (vendor.status !== 'Aktif') errors.push({ row: line, message: `Vendor ${vendor.name} berstatus ${vendor.status}` })
    let prId: string | undefined
    if (f.no_pr) {
      const pr = db.prs.find((p) => p.number.toUpperCase() === f.no_pr.toUpperCase())
      if (!pr) errors.push({ row: line, message: `No. PR ${f.no_pr} tidak ditemukan` })
      else if (pr.status !== 'Disetujui' && pr.status !== 'Diproses PO') errors.push({ row: line, message: `PR ${pr.number} belum disetujui (status ${pr.status})` })
      else prId = pr.id
    }
    const delivery = parseCsvDate(f.tanggal_kirim)
    if (!delivery) errors.push({ row: line, message: `Tanggal kirim tidak valid: "${f.tanggal_kirim ?? ''}"` })
    const ppnRate = f.ppn_persen ? parseNumber(f.ppn_persen) : vendor?.isPkp ? 11 : 0
    if (ppnRate === undefined) errors.push({ row: line, message: `PPN tidak valid: "${f.ppn_persen}"` })
    const status = (f.status || 'Draft').toLowerCase() === 'open' ? 'Open' : 'Draft'
    if (status === 'Open' && (!f.disetujui_oleh || !f.dikonfirmasi_vendor_oleh))
      errors.push({ row: line, message: 'Status Open memerlukan kolom disetujui_oleh dan dikonfirmasi_vendor_oleh' })
    const its = items(g.rows, 'harga', errors)
    if (errors.length > errCount) continue
    const now = new Date().toISOString()
    const po: PurchaseOrder = {
      id: uid('po'), number: nextDocNumber('PO', [...existing, ...docs.map((d) => d.number)]), prId, vendorId: vendor!.id, date: date!,
      deliveryDate: delivery!, deliveryAddress: f.alamat_kirim || undefined, paymentTerms: f.termin_pembayaran || `${vendor!.paymentTermDays} hari`,
      items: its, ppnRate: ppnRate!, status, buyer: f.buyer || db.userName, source: 'Import CSV',
      ...(status === 'Open'
        ? {
            companyApproval: { name: f.disetujui_oleh, title: 'Perusahaan', at: now, note: 'Disetujui di luar aplikasi (import CSV)' },
            vendorAcceptance: { name: f.dikonfirmasi_vendor_oleh, title: vendor!.name, at: now, note: 'Dikonfirmasi di luar aplikasi (import CSV)' },
          }
        : {}),
    }
    docs.push(po)
    rowsOf.set(po.id, g.rows.map((x) => x.line))
  }
  return { docs, errors, rowsOf }
}

// ---------------------------------------------------------------- SPK
export const SPK_TEMPLATE = {
  file: 'template_spk.csv',
  headers: ['tanggal', 'vendor', 'no_po', 'judul', 'ruang_lingkup', 'lokasi', 'tanggal_mulai', 'tanggal_selesai', 'nilai_kontrak', 'ppn_persen', 'departemen', 'pic', 'termin', 'status', 'disetujui_oleh', 'dikonfirmasi_vendor_oleh'],
  rows: [
    ['2026-10-08', 'VND-0001', '', 'Perbaikan Atap Gudang Cakung', 'Penggantian atap spandek 600 m2 termasuk rangka baja ringan', 'Gudang Cakung', '2026-10-15', '2026-12-15', '385.000.000', '11', 'General Affairs', 'Agus Salim', 'Uang Muka:30:Penandatanganan SPK|Termin I:65:BAST 100%|Retensi:5:Masa pemeliharaan', 'Draft', '', ''],
    ['2026-10-08', 'VND-0006', '', 'Jasa Security 12 Bulan', 'Penyediaan 12 personel security 24 jam', 'Kantor Pusat', '2026-11-01', '2027-10-31', '720000000', '11', 'General Affairs', 'Agus Salim', 'Tagihan Bulanan:100:Berita acara kinerja bulanan', 'Berjalan', 'Budi Santoso', 'Yulia Permata'],
  ],
  notes: [
    'Satu baris = satu SPK.',
    'termin: Nama:Persen:Milestone dipisah tanda | (total persen harus 100).',
    'status: Draft (default — terbitkan & konfirmasi vendor di aplikasi) atau Berjalan (isi disetujui_oleh & dikonfirmasi_vendor_oleh).',
    'no_po opsional — harus PO milik vendor yang sama.',
  ],
}

export function importSPK(rows: Row[], db: ImportDb): ImportResult<SPK> {
  const errors: ImportError[] = []
  const docs: SPK[] = []
  const rowsOf = new Map<string, number[]>()
  const existing = db.spks.map((s) => s.number)
  rows.forEach((f, i) => {
    const line = i + 2
    const errCount = errors.length
    const vendor = findVendor(db.vendors, f.vendor ?? '')
    if (!vendor) errors.push({ row: line, message: `Vendor "${f.vendor ?? ''}" tidak ditemukan di Vendor Master` })
    else if (vendor.status !== 'Aktif') errors.push({ row: line, message: `Vendor ${vendor.name} berstatus ${vendor.status}` })
    let po: PurchaseOrder | undefined
    if (f.no_po) {
      po = db.pos.find((p) => p.number.toUpperCase() === f.no_po.toUpperCase())
      if (!po) errors.push({ row: line, message: `No. PO ${f.no_po} tidak ditemukan` })
      else if (vendor && po.vendorId !== vendor.id) errors.push({ row: line, message: `PO ${po.number} bukan milik vendor ${vendor.name}` })
    }
    const title = req(f, 'judul', 'Judul pekerjaan', line, errors)
    const start = parseCsvDate(f.tanggal_mulai)
    const end = parseCsvDate(f.tanggal_selesai)
    if (!start) errors.push({ row: line, message: `Tanggal mulai tidak valid: "${f.tanggal_mulai ?? ''}"` })
    if (!end) errors.push({ row: line, message: `Tanggal selesai tidak valid: "${f.tanggal_selesai ?? ''}"` })
    if (start && end && end < start) errors.push({ row: line, message: 'Tanggal selesai lebih awal dari tanggal mulai' })
    const value = parseNumber(f.nilai_kontrak)
    if (!value || value <= 0) errors.push({ row: line, message: `Nilai kontrak tidak valid: "${f.nilai_kontrak ?? ''}"` })
    const termins: SPKTermin[] = (f.termin || 'Pelunasan:100:BAST')
      .split('|')
      .map((t) => t.split(':').map((x) => x.trim()))
      .map(([name, pct, milestone]) => ({ id: uid('t'), name, percent: parseNumber(pct) ?? NaN, milestone: milestone || '-' }))
    const total = termins.reduce((s, t) => s + t.percent, 0)
    if (termins.some((t) => !t.name || !Number.isFinite(t.percent))) errors.push({ row: line, message: `Format termin tidak valid: "${f.termin}"` })
    else if (Math.abs(total - 100) > 0.01) errors.push({ row: line, message: `Total persen termin ${total}% (harus 100%)` })
    const status = (f.status || 'Draft').toLowerCase() === 'berjalan' ? 'Berjalan' : 'Draft'
    if (status === 'Berjalan' && (!f.disetujui_oleh || !f.dikonfirmasi_vendor_oleh))
      errors.push({ row: line, message: 'Status Berjalan memerlukan kolom disetujui_oleh dan dikonfirmasi_vendor_oleh' })
    if (errors.length > errCount) return
    const now = new Date().toISOString()
    const spk: SPK = {
      id: uid('spk'), number: nextDocNumber('SPK', [...existing, ...docs.map((d) => d.number)]), date: parseCsvDate(f.tanggal) ?? toISODate(new Date()),
      poId: po?.id, prId: po?.prId, vendorId: vendor!.id, title, scope: f.ruang_lingkup || title, location: f.lokasi || '-',
      startDate: start!, endDate: end!, contractValue: value!, ppnRate: f.ppn_persen ? (parseNumber(f.ppn_persen) ?? 11) : vendor!.isPkp ? 11 : 0,
      progress: 0, termins, pic: f.pic || db.userName, department: f.departemen || '-', status, source: 'Import CSV',
      ...(status === 'Berjalan'
        ? {
            companyApproval: { name: f.disetujui_oleh, title: 'Perusahaan', at: now, note: 'Diterbitkan di luar aplikasi (import CSV)' },
            vendorAcceptance: { name: f.dikonfirmasi_vendor_oleh, title: vendor!.name, at: now, note: 'Dikonfirmasi di luar aplikasi (import CSV)' },
          }
        : {}),
    }
    docs.push(spk)
    rowsOf.set(spk.id, [line])
  })
  return { docs, errors, rowsOf }
}
