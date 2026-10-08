import type { CompanySettings, DocSignature, GoodsReceipt, LineItem, PurchaseOrder, PurchaseRequisition, SPK, Vendor } from '@/types'
import { formatDate, terbilangRupiah } from './format'

/** Generator dokumen (canvas → gambar A4) berdasarkan data internal sistem */

const W = 1240
const H = 1754
const n = (v: number) => Math.round(v).toLocaleString('id-ID')

class Page {
  c = document.createElement('canvas')
  ctx: CanvasRenderingContext2D
  constructor(bg = '#ffffff') {
    this.c.width = W
    this.c.height = H
    this.ctx = this.c.getContext('2d')!
    this.ctx.fillStyle = bg
    this.ctx.fillRect(0, 0, W, H)
  }
  text(s: string, x: number, y: number, size = 22, bold = false, color = '#111', align: CanvasTextAlign = 'left', maxWidth?: number) {
    const ctx = this.ctx
    ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(s, x, y, maxWidth)
  }
  /** Teks multi-baris dengan word wrap; mengembalikan y terakhir */
  para(s: string, x: number, y: number, width: number, size = 20, lh = 30, color = '#333') {
    this.ctx.font = `${size}px Arial, Helvetica, sans-serif`
    let lineStr = ''
    for (const w of s.split(' ')) {
      const t = lineStr ? `${lineStr} ${w}` : w
      if (this.ctx.measureText(t).width > width && lineStr) {
        this.text(lineStr, x, y, size, false, color)
        y += lh
        lineStr = w
      } else lineStr = t
    }
    if (lineStr) this.text(lineStr, x, y, size, false, color)
    return y
  }
  line(x1: number, y1: number, x2: number, y2: number, w = 2, color = '#222') {
    const ctx = this.ctx
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  rect(x: number, y: number, w: number, h: number, fill: string) {
    this.ctx.fillStyle = fill
    this.ctx.fillRect(x, y, w, h)
  }
  box(x: number, y: number, w: number, h: number, color = '#222', lw = 2) {
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lw
    this.ctx.strokeRect(x, y, w, h)
  }
  signature(cx: number, cy: number, color = '#1f3c8a') {
    const ctx = this.ctx
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - 90, cy + 10)
    ctx.bezierCurveTo(cx - 50, cy - 40, cx - 10, cy + 50, cx + 30, cy - 20)
    ctx.bezierCurveTo(cx + 50, cy - 40, cx + 70, cy + 20, cx + 100, cy - 5)
    ctx.stroke()
  }
  stamp(cx: number, cy: number, r = 58, color = 'rgba(30,64,175,0.55)') {
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = 4
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2)
    this.ctx.stroke()
  }
  watermark(s: string) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-Math.PI / 6)
    this.text(s, 0, 0, 90, true, 'rgba(15,42,107,0.06)', 'center')
    ctx.restore()
  }
  noise() {
    const img = this.ctx.getImageData(0, 0, W, H)
    for (let i = 0; i < img.data.length; i += 4 * 7) {
      const d = (Math.random() - 0.5) * 18
      img.data[i] += d
      img.data[i + 1] += d
      img.data[i + 2] += d
    }
    this.ctx.putImageData(img, 0, 0)
  }
  footer(s: string) {
    this.line(80, H - 110, W - 80, H - 110, 1, '#999')
    this.text(s, W / 2, H - 75, 18, false, '#777', 'center')
  }
  toDataUrl() {
    return this.c.toDataURL('image/jpeg', 0.9)
  }
}

/** Kop dokumen perusahaan sendiri (PT Nusantara Makmur Sejahtera) */
function companyHeader(p: Page, company: CompanySettings, title: string, number: string) {
  p.rect(80, 80, 90, 90, '#1d43d8')
  p.text('NMS', 125, 138, 30, true, '#fff', 'center')
  p.text(company.companyName.toUpperCase(), 195, 112, 30, true)
  p.para(company.companyAddress, 195, 146, W - 280, 19, 26)
  p.text(`NPWP : ${company.companyNpwp}`, 195, 200, 19, true, '#333')
  p.line(80, 230, W - 80, 230, 4, '#1d43d8')
  p.text(title, W / 2, 290, 34, true, '#111', 'center')
  p.text(`No. ${number}`, W / 2, 328, 22, false, '#333', 'center')
}

function itemsTable(p: Page, top: number, items: LineItem[], ppnRate?: number) {
  const cols = [100, 160, 700, 850, W - 100]
  p.rect(80, top, W - 160, 50, '#e8eef8')
  p.line(80, top, W - 80, top)
  p.text('No', cols[0], top + 33, 19, true)
  p.text('Uraian', cols[1], top + 33, 19, true)
  p.text('Qty', cols[2] + 100, top + 33, 19, true, '#111', 'right')
  p.text('Harga Satuan', cols[3] + 150, top + 33, 19, true, '#111', 'right')
  p.text('Jumlah (Rp)', cols[4], top + 33, 19, true, '#111', 'right')
  p.line(80, top + 50, W - 80, top + 50)
  let y = top + 90
  items.forEach((it, i) => {
    p.text(String(i + 1), cols[0], y, 19)
    p.text(it.description, cols[1], y, 19, false, '#111', 'left', 520)
    p.text(`${n(it.qty)} ${it.unit}`, cols[2] + 100, y, 19, false, '#111', 'right')
    p.text(n(it.unitPrice), cols[3] + 150, y, 19, false, '#111', 'right')
    p.text(n(it.qty * it.unitPrice), cols[4], y, 19, false, '#111', 'right')
    y += 40
  })
  p.line(80, y - 15, W - 80, y - 15)
  const sub = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const rows: [string, number, boolean][] = [['Sub Total', sub, false]]
  if (ppnRate !== undefined) rows.push([`PPN ${ppnRate}%`, (sub * ppnRate) / 100, false], ['TOTAL', sub * (1 + ppnRate / 100), true])
  rows.forEach(([k, v], i) => {
    p.text(k, 780, y + 30 + i * 40, 21, rows[i][2])
    p.text(`Rp ${n(v)}`, W - 100, y + 30 + i * 40, 21, rows[i][2], '#111', 'right')
  })
  return y + 30 + rows.length * 40
}

interface SignCol {
  label: string
  name: string
  role: string
  sig?: DocSignature
  img?: HTMLImageElement
  /** tampilkan coretan contoh bila tidak ada data tanda tangan (dokumen pihak ketiga) */
  fake?: boolean
}

const loadImg = (src?: string) =>
  new Promise<HTMLImageElement | undefined>((res) => {
    if (!src) return res(undefined)
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(undefined)
    img.src = src
  })

/** Muat gambar tanda tangan untuk tiap kolom */
async function withImages(cols: SignCol[]) {
  return Promise.all(cols.map(async (c) => ({ ...c, img: await loadImg(c.sig?.signature) })))
}

function signBlock(p: Page, y: number, cols: (SignCol | [string, string, string])[]) {
  const w = (W - 160) / cols.length
  cols.forEach((col, i) => {
    const c: SignCol = Array.isArray(col) ? { label: col[0], name: col[1], role: col[2], fake: true } : col
    const cx = 80 + w * i + w / 2
    p.text(c.label, cx, y, 19, false, '#333', 'center')
    if (c.img) {
      const h = 100
      const iw = Math.min(240, (c.img.width / c.img.height) * h)
      p.ctx.drawImage(c.img, cx - iw / 2, y + 20, iw, h)
    } else if (c.sig || c.fake) p.signature(cx, y + 70)
    else p.text('(belum ditandatangani)', cx, y + 80, 16, false, '#aaa', 'center')
    p.text(c.sig?.name ?? c.name, cx, y + 150, 19, true, '#111', 'center')
    p.line(cx - 120, y + 158, cx + 120, y + 158, 1, '#555')
    p.text(c.sig?.title || c.role, cx, y + 182, 16, false, '#555', 'center', w - 20)
    if (c.sig) p.text(formatDate(c.sig.at), cx, y + 204, 15, false, '#777', 'center')
  })
}

// ---------------------------------------------------------------------------

export interface InvoiceDocSpec {
  vendor: Vendor
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  fakturPajakNo?: string
  spkNo?: string
  poNo?: string
  spkTitle?: string
  description: string
  dpp: number
  ppnRate: number
}

/** Dokumen tagihan dari vendor */
export function renderInvoiceDocument(s: InvoiceDocSpec, company: CompanySettings, opts: { scanned?: boolean; watermark?: string } = {}) {
  const p = new Page(opts.scanned ? '#fdfdfb' : '#ffffff')
  const v = s.vendor
  const ppn = Math.round((s.dpp * s.ppnRate) / 100)
  const total = s.dpp + ppn

  p.rect(80, 80, 90, 90, '#123c7a')
  p.text(v.name.split(' ').slice(1, 3).map((w) => w[0]).join(''), 125, 140, 40, true, '#fff', 'center')
  p.text(v.name.toUpperCase(), 195, 115, 34, true)
  p.text(`${v.address}, ${v.city}`, 195, 152, 21, false, '#333')
  p.text(`Telp ${v.phone}  |  ${v.email}`, 195, 182, 21, false, '#333')
  p.text(`NPWP : ${v.npwp}`, 195, 212, 21, true, '#333')
  p.text('INVOICE', W - 80, 125, 54, true, '#123c7a', 'right')
  p.line(80, 245, W - 80, 245, 4, '#123c7a')

  p.text('Kepada Yth:', 80, 300, 22, true)
  p.text(company.companyName, 80, 335, 24, true)
  p.para(company.companyAddress, 80, 368, 560, 21, 28)
  p.text(`NPWP : ${company.companyNpwp}`, 80, 428, 21, false, '#333')

  const info: [string, string][] = [
    ['No. Invoice', s.invoiceNo],
    ['Tanggal', formatDate(s.invoiceDate, true)],
    ['Jatuh Tempo', formatDate(s.dueDate, true)],
    ...(s.spkNo ? ([['No. SPK', s.spkNo]] as [string, string][]) : []),
    ...(s.poNo ? ([['No. PO', s.poNo]] as [string, string][]) : []),
    ...(s.fakturPajakNo ? ([['No. Faktur Pajak', s.fakturPajakNo]] as [string, string][]) : []),
  ]
  info.forEach(([k, val], i) => {
    p.text(k, 700, 300 + i * 36, 21, false, '#444')
    p.text(`: ${val}`, 880, 300 + i * 36, 21, true)
  })

  const top = 560
  p.rect(80, top, W - 160, 52, '#e8eef8')
  p.text('No', 100, top + 34, 21, true)
  p.text('Uraian Pekerjaan', 160, top + 34, 21, true)
  p.text('Jumlah (Rp)', W - 100, top + 34, 21, true, '#111', 'right')
  p.line(80, top, W - 80, top, 2)
  p.line(80, top + 52, W - 80, top + 52, 2)
  p.text('1', 100, top + 100, 22)
  const desc = s.description
  p.text(desc.length > 58 ? desc.slice(0, 58) : desc, 160, top + 100, 22)
  if (desc.length > 58) p.text(desc.slice(58), 160, top + 132, 22)
  p.text(s.spkTitle ? `Ref. ${s.spkTitle}` : s.poNo ? `Ref. ${s.poNo}` : '', 160, top + 168, 19, false, '#555')
  p.text(n(s.dpp), W - 100, top + 100, 22, false, '#111', 'right')
  p.line(80, top + 220, W - 80, top + 220, 2)

  const rows: [string, number, boolean][] = [
    ['Sub Total / DPP', s.dpp, false],
    [`PPN ${s.ppnRate}%`, ppn, false],
    ['TOTAL TAGIHAN', total, true],
  ]
  rows.forEach(([k, val, b], i) => {
    const y = top + 270 + i * 46
    p.text(k, 760, y, 23, b)
    p.text(`Rp ${n(val)}`, W - 100, y, 23, b, '#111', 'right')
  })
  p.line(740, top + 330, W - 80, top + 330, 2)

  p.text('Terbilang :', 80, top + 450, 21, true)
  const tb = `# ${terbilangRupiah(total)} #`
  p.text(tb.slice(0, 85), 80, top + 484, 20, false, '#333')
  if (tb.length > 85) p.text(tb.slice(85), 80, top + 512, 20, false, '#333')

  p.text('Pembayaran mohon ditransfer ke:', 80, top + 590, 21, true)
  p.text(`Bank ${v.bankName}  No. Rekening ${v.bankAccountNo}`, 80, top + 624, 21)
  p.text(`a.n. ${v.bankAccountName}`, 80, top + 656, 21)

  p.text(`${v.city}, ${formatDate(s.invoiceDate, true)}`, W - 250, top + 590, 21, false, '#111', 'center')
  p.text('Hormat kami,', W - 250, top + 624, 21, false, '#111', 'center')
  p.signature(W - 250, top + 715)
  p.stamp(W - 300, top + 720)
  p.text(v.contactPerson, W - 250, top + 800, 21, true, '#111', 'center')
  p.text('Finance', W - 250, top + 830, 19, false, '#444', 'center')
  p.footer('Dokumen ini sah dan diterbitkan secara elektronik.')
  if (opts.watermark) p.watermark(opts.watermark)
  if (opts.scanned) p.noise()
  return p.toDataUrl()
}

/** Faktur Pajak (format ringkas e-Faktur) */
export function renderFakturPajak(
  s: { fakturNo: string; vendor: Vendor; invoiceDate: string; description: string; dpp: number; ppnRate: number; invoiceNo: string },
  company: CompanySettings,
) {
  const p = new Page()
  const ppn = Math.round((s.dpp * s.ppnRate) / 100)
  p.text('Faktur Pajak', W / 2, 120, 38, true, '#111', 'center')
  p.box(80, 150, W - 160, 1420, '#222', 2)
  const row = (y: number, label: string, value: string, bold = false) => {
    p.text(label, 110, y, 20, false, '#333')
    p.text(`: ${value}`, 420, y, 20, bold, "#111", "left", 720)
  }
  p.text(`Kode dan Nomor Seri Faktur Pajak : ${s.fakturNo}`, 110, 200, 21, true)
  p.line(80, 225, W - 80, 225, 1)
  p.text('Pengusaha Kena Pajak', 110, 265, 21, true)
  row(305, 'Nama', s.vendor.name)
  row(340, 'Alamat', `${s.vendor.address}, ${s.vendor.city}`)
  row(375, 'NPWP', s.vendor.npwp)
  p.line(80, 400, W - 80, 400, 1)
  p.text('Pembeli Barang Kena Pajak / Penerima Jasa Kena Pajak', 110, 440, 21, true)
  row(480, 'Nama', company.companyName)
  row(515, 'Alamat', company.companyAddress)
  row(550, 'NPWP', company.companyNpwp)
  p.line(80, 580, W - 80, 580, 1)
  p.text('No.', 110, 620, 20, true)
  p.text('Nama Barang Kena Pajak / Jasa Kena Pajak', 180, 620, 20, true)
  p.text('Harga Jual / Penggantian (Rp)', W - 110, 620, 20, true, '#111', 'right')
  p.line(80, 640, W - 80, 640, 1)
  p.text('1', 110, 690, 20)
  p.para(`${s.description} (Ref. ${s.invoiceNo})`, 180, 690, 620, 20, 30, '#111')
  p.text(n(s.dpp), W - 110, 690, 20, false, '#111', 'right')
  p.line(80, 800, W - 80, 800, 1)
  const sums: [string, number][] = [
    ['Harga Jual / Penggantian', s.dpp],
    ['Dikurangi Potongan Harga', 0],
    ['Dikurangi Uang Muka yang telah diterima', 0],
    ['Dasar Pengenaan Pajak', s.dpp],
    [`Total PPN (${s.ppnRate}%)`, ppn],
    ['Total PPnBM', 0],
  ]
  sums.forEach(([k, v], i) => {
    p.text(k, 110, 845 + i * 40, 20, i === 3 || i === 4)
    p.text(n(v), W - 110, 845 + i * 40, 20, i === 3 || i === 4, '#111', 'right')
  })
  p.line(80, 1100, W - 80, 1100, 1)
  p.text(`${s.vendor.city}, ${formatDate(s.invoiceDate, true)}`, W - 300, 1160, 20, false, '#111', 'center')
  p.signature(W - 300, 1250)
  p.text(s.vendor.contactPerson, W - 300, 1340, 20, true, '#111', 'center')
  // Pola QR ilustratif (deterministik dari nomor faktur)
  const N = 25
  const cell = 8
  const qx = 140
  const qy = 1150
  let seed = [...s.fakturNo].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) & 1
  p.rect(qx - 8, qy - 8, N * cell + 16, N * cell + 16, '#fff')
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const finder = (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7)
      if (!finder && rnd()) p.rect(qx + c * cell, qy + r * cell, cell, cell, '#111')
    }
  for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
    p.rect(qx + fx * cell, qy + fy * cell, 7 * cell, 7 * cell, '#111')
    p.rect(qx + (fx + 1) * cell, qy + (fy + 1) * cell, 5 * cell, 5 * cell, '#fff')
    p.rect(qx + (fx + 2) * cell, qy + (fy + 2) * cell, 3 * cell, 3 * cell, '#111')
  }
  p.text('Pemberitahuan: Faktur Pajak ini telah dilaporkan ke Direktorat Jenderal Pajak.', W / 2, 1530, 17, false, '#555', 'center')
  return p.toDataUrl()
}

/** Dokumen Surat Perintah Kerja */
export async function renderSpkDocument(spk: SPK, vendor: Vendor, company: CompanySettings, po?: PurchaseOrder, pr?: PurchaseRequisition) {
  const p = new Page()
  companyHeader(p, company, 'SURAT PERINTAH KERJA (SPK)', spk.number)
  p.text('Yang bertanda tangan di bawah ini memberikan perintah kerja kepada:', 80, 400, 21)
  const kv: [string, string][] = [
    ['Nama Perusahaan', vendor.name],
    ['Alamat', `${vendor.address}, ${vendor.city}`],
    ['NPWP', vendor.npwp],
    ['Penanggung Jawab', vendor.contactPerson],
  ]
  kv.forEach(([k, v], i) => {
    p.text(k, 110, 445 + i * 34, 20, false, '#444')
    p.text(`: ${v}`, 360, 445 + i * 34, 20, true)
  })
  p.text('Untuk melaksanakan pekerjaan sebagai berikut:', 80, 610, 21)
  const kv2: [string, string][] = [
    ['Nama Pekerjaan', spk.title],
    ['Lokasi', spk.location],
    ['Jangka Waktu', `${formatDate(spk.startDate, true)} s.d. ${formatDate(spk.endDate, true)}`],
    ['Nilai Kontrak (DPP)', `Rp ${n(spk.contractValue)} (belum termasuk PPN ${spk.ppnRate}%)`],
    ['Rujukan', [pr?.number, po?.number].filter(Boolean).join(' / ') || '-'],
  ]
  kv2.forEach(([k, v], i) => {
    p.text(k, 110, 655 + i * 34, 20, false, '#444')
    p.text(`: ${v}`, 360, 655 + i * 34, 20, true, '#111', 'left', 780)
  })
  p.text('Ruang Lingkup Pekerjaan:', 80, 860, 21, true)
  let y = p.para(spk.scope, 80, 895, W - 160, 20, 30)
  y += 60
  p.text('Cara Pembayaran:', 80, y, 21, true)
  y += 36
  spk.termins.forEach((t, i) => {
    p.text(`${i + 1}. ${t.name} — ${t.percent}% — ${t.milestone}`, 110, y, 20)
    y += 32
  })
  p.text(`Terbilang nilai kontrak: ${terbilangRupiah(spk.contractValue)}`, 80, y + 30, 18, false, '#555', 'left', W - 160)
  p.text(`Jakarta, ${formatDate(spk.date ?? spk.startDate, true)}`, W / 2, 1360, 20, false, '#111', 'center')
  signBlock(
    p,
    1400,
    await withImages([
      { label: 'Pemberi Kerja', name: '……………………', role: company.companyName, sig: spk.companyApproval },
      { label: 'Penerima Kerja', name: vendor.contactPerson, role: vendor.name, sig: spk.vendorAcceptance },
    ]),
  )
  if (spk.status === 'Draft') p.watermark('DRAFT')
  p.footer(`Dokumen internal ${company.companyName} — PIC ${spk.pic} (${spk.department})`)
  return p.toDataUrl()
}

/** Dokumen Purchase Order */
export async function renderPoDocument(po: PurchaseOrder, vendor: Vendor, company: CompanySettings, pr?: PurchaseRequisition) {
  const p = new Page()
  companyHeader(p, company, 'PURCHASE ORDER', po.number)
  const left: [string, string][] = [
    ['Kepada', vendor.name],
    ['Alamat', `${vendor.address}, ${vendor.city}`],
    ['NPWP', vendor.npwp],
    ['Up.', vendor.contactPerson],
  ]
  const right: [string, string][] = [
    ['Tanggal PO', formatDate(po.date, true)],
    ['Tgl Pengiriman', formatDate(po.deliveryDate, true)],
    ['No. PR', pr?.number ?? '-'],
    ['Buyer', po.buyer],
  ]
  left.forEach(([k, v], i) => {
    p.text(k, 80, 400 + i * 34, 19, false, '#444')
    p.text(`: ${v}`, 200, 400 + i * 34, 19, true, '#111', 'left', 470)
  })
  right.forEach(([k, v], i) => {
    p.text(k, 720, 400 + i * 34, 19, false, '#444')
    p.text(`: ${v}`, 880, 400 + i * 34, 19, true, '#111', 'left', 280)
  })
  p.text('Alamat Kirim', 80, 552, 19, false, '#444')
  p.text(`: ${po.deliveryAddress ?? '-'}`, 200, 552, 19, true, '#111', 'left', W - 280)
  const y = itemsTable(p, 590, po.items, po.ppnRate)
  p.text('Syarat & Ketentuan:', 80, y + 50, 20, true)
  p.para(
    `Pembayaran: ${po.paymentTerms ?? `${vendor.paymentTermDays} hari`} setelah tagihan lengkap diterima (invoice, faktur pajak, BAST/GR). Tagihan wajib mencantumkan nomor PO ini. Harga sudah termasuk biaya pengiriman ke lokasi.${po.notes ? ` Catatan: ${po.notes}` : ''}`,
    80,
    y + 85,
    W - 160,
    19,
    28,
  )
  signBlock(
    p,
    1400,
    await withImages([
      { label: 'Dibuat oleh', name: po.buyer, role: 'Procurement', fake: true },
      { label: 'Disetujui Perusahaan', name: '……………………', role: company.companyName, sig: po.companyApproval },
      { label: 'Dikonfirmasi Vendor', name: vendor.contactPerson, role: vendor.name, sig: po.vendorAcceptance },
    ]),
  )
  if (po.status === 'Draft') p.watermark('DRAFT')
  p.footer(`Dokumen internal ${company.companyName}`)
  return p.toDataUrl()
}

/** Berita Acara Serah Terima / Goods Receipt */
export function renderReceiptDocument(gr: GoodsReceipt, vendor: Vendor, company: CompanySettings, ref?: string) {
  const p = new Page()
  const title = gr.type === 'BAST' ? 'BERITA ACARA SERAH TERIMA PEKERJAAN' : 'GOODS RECEIPT / BUKTI PENERIMAAN BARANG'
  companyHeader(p, company, title, gr.number)
  p.para(
    `Pada hari ini, ${formatDate(gr.date, true)}, telah dilakukan serah terima ${gr.type === 'BAST' ? 'hasil pekerjaan' : 'barang'} dari ${vendor.name} kepada ${company.companyName} dengan rincian sebagai berikut:`,
    80,
    410,
    W - 160,
    21,
    32,
    '#111',
  )
  const kv: [string, string][] = [
    ['Rujukan', ref ?? '-'],
    ['Uraian', gr.description],
    ['Nilai Diterima (DPP)', `Rp ${n(gr.amount)}`],
    ['Terbilang', terbilangRupiah(gr.amount)],
    ['Diterima oleh', gr.receivedBy],
    ['Kondisi', 'Baik, lengkap dan sesuai spesifikasi'],
  ]
  kv.forEach(([k, v], i) => {
    p.text(k, 110, 540 + i * 40, 20, false, '#444')
    p.text(`: ${v}`, 380, 540 + i * 40, 20, true, '#111', 'left', 760)
  })
  p.para(
    'Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagai dasar penagihan sesuai ketentuan kontrak.',
    80,
    860,
    W - 160,
    20,
    30,
  )
  signBlock(p, 1000, [
    ['Yang Menyerahkan', vendor.contactPerson, vendor.name],
    ['Yang Menerima', gr.receivedBy, company.companyName],
  ])
  p.footer(`Dokumen internal ${company.companyName}`)
  return p.toDataUrl()
}

/** Dokumen Purchase Request (User → Procurement) */
export async function renderPrDocument(pr: PurchaseRequisition, company: CompanySettings) {
  const p = new Page()
  companyHeader(p, company, 'PURCHASE REQUEST (PERMINTAAN PEMBELIAN)', pr.number)
  const kv: [string, string][] = [
    ['Kepada', 'Bagian Procurement'],
    ['Dari (Departemen)', pr.department],
    ['Pemohon', pr.requester],
    ['Cost Center', pr.costCenter],
    ['Tanggal', formatDate(pr.date, true)],
    ['Dibutuhkan', pr.neededDate ? formatDate(pr.neededDate, true) : '-'],
    ['Keperluan', pr.purpose],
  ]
  kv.forEach(([k, v], i) => {
    p.text(k, 80, 400 + i * 34, 19, false, '#444')
    p.text(`: ${v}`, 300, 400 + i * 34, 19, true, '#111', 'left', 840)
  })
  const y = itemsTable(p, 660, pr.items)
  p.text('* Harga merupakan estimasi pemohon; harga final ditetapkan Procurement pada PO.', 80, y + 30, 17, false, '#666')
  if (pr.notes) p.para(`Catatan: ${pr.notes}`, 80, y + 70, W - 160, 18, 26)
  signBlock(
    p,
    1400,
    await withImages([
      { label: 'Diajukan oleh', name: pr.requester, role: `User — ${pr.department}`, sig: pr.submitted },
      { label: pr.rejection ? 'Ditolak oleh' : 'Disetujui oleh', name: '……………………', role: 'Atasan / Finance', sig: pr.rejection ?? pr.approval },
      { label: 'Diterima Procurement', name: '……………………', role: 'Procurement', sig: pr.status === 'Diproses PO' || pr.status === 'Selesai' ? pr.approval && { name: 'Yohanes Prasetyo', title: 'Procurement', at: pr.approval.at } : undefined },
    ]),
  )
  if (pr.status === 'Draft') p.watermark('DRAFT')
  if (pr.status === 'Ditolak') p.watermark('DITOLAK')
  p.footer(`Dokumen internal ${company.companyName}`)
  return p.toDataUrl()
}
