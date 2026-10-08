import type { CompanySettings, PurchaseOrder, SPK, Vendor } from '@/types'
import { addDays, today, toISODate } from './dates'
import { formatDate, terbilangRupiah } from './format'

export interface SampleSpec {
  vendor: Vendor
  spk?: SPK
  po?: PurchaseOrder
  description: string
  dpp: number
}

const n = (v: number) => Math.round(v).toLocaleString('id-ID')

/** Membuat gambar tagihan vendor (seperti hasil scan) untuk uji coba OCR */
export function renderSampleInvoice(spec: SampleSpec, company: CompanySettings): string {
  const W = 1240
  const H = 1754
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fdfdfb'
  ctx.fillRect(0, 0, W, H)
  const font = (size: number, bold = false) => (ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`)
  const text = (s: string, x: number, y: number, size = 24, bold = false, color = '#111', align: CanvasTextAlign = 'left') => {
    font(size, bold)
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(s, x, y)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, w = 2, color = '#222') => {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const v = spec.vendor
  const invDate = toISODate(today())
  const due = addDays(invDate, v.paymentTermDays)
  const yy = String(today().getFullYear()).slice(2)
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  const invNo = `INV/${v.code.replace('VND-', 'V')}/${today().getFullYear()}/${seq}`
  const ppnRate = v.isPkp ? 11 : 0
  const ppn = Math.round((spec.dpp * ppnRate) / 100)
  const total = spec.dpp + ppn

  // Header
  ctx.fillStyle = '#123c7a'
  ctx.fillRect(80, 80, 90, 90)
  text(v.name.split(' ').slice(1, 3).map((w) => w[0]).join(''), 125, 140, 40, true, '#fff', 'center')
  text(v.name.toUpperCase(), 195, 115, 34, true)
  text(`${v.address}, ${v.city}`, 195, 152, 21, false, '#333')
  text(`Telp ${v.phone}  |  ${v.email}`, 195, 182, 21, false, '#333')
  text(`NPWP : ${v.npwp}`, 195, 212, 21, true, '#333')
  text('INVOICE', W - 80, 125, 54, true, '#123c7a', 'right')
  line(80, 245, W - 80, 245, 4, '#123c7a')

  // Kepada & info
  text('Kepada Yth:', 80, 300, 22, true)
  text(company.companyName, 80, 335, 24, true)
  const addr = company.companyAddress
  text(addr.slice(0, 52), 80, 368, 21, false, '#333')
  text(addr.slice(52), 80, 396, 21, false, '#333')
  text(`NPWP : ${company.companyNpwp}`, 80, 428, 21, false, '#333')

  const info: [string, string][] = [
    ['No. Invoice', invNo],
    ['Tanggal', formatDate(invDate, true)],
    ['Jatuh Tempo', formatDate(due, true)],
    ...(spec.spk ? ([['No. SPK', spec.spk.number]] as [string, string][]) : []),
    ...(spec.po ? ([['No. PO', spec.po.number]] as [string, string][]) : []),
    ...(v.isPkp ? ([['No. Faktur Pajak', `010.002-${yy}.${String(Math.floor(Math.random() * 9e7) + 1e7)}`]] as [string, string][]) : []),
  ]
  info.forEach(([k, val], i) => {
    text(k, 700, 300 + i * 36, 21, false, '#444')
    text(`: ${val}`, 880, 300 + i * 36, 21, true)
  })

  // Tabel
  const top = 560
  ctx.fillStyle = '#e8eef8'
  ctx.fillRect(80, top, W - 160, 52)
  text('No', 100, top + 34, 21, true)
  text('Uraian Pekerjaan', 160, top + 34, 21, true)
  text('Jumlah (Rp)', W - 100, top + 34, 21, true, '#111', 'right')
  line(80, top, W - 80, top, 2)
  line(80, top + 52, W - 80, top + 52, 2)
  text('1', 100, top + 100, 22)
  const desc = spec.description
  text(desc.length > 58 ? desc.slice(0, 58) : desc, 160, top + 100, 22)
  if (desc.length > 58) text(desc.slice(58), 160, top + 132, 22)
  text(spec.spk ? `Ref. ${spec.spk.title}` : spec.po ? `Ref. ${spec.po.number}` : '', 160, top + 168, 19, false, '#555')
  text(n(spec.dpp), W - 100, top + 100, 22, false, '#111', 'right')
  line(80, top + 220, W - 80, top + 220, 2)

  const rows: [string, number, boolean][] = [
    ['Sub Total / DPP', spec.dpp, false],
    [`PPN ${ppnRate}%`, ppn, false],
    ['TOTAL TAGIHAN', total, true],
  ]
  rows.forEach(([k, val, b], i) => {
    const y = top + 270 + i * 46
    text(k, 760, y, 23, b)
    text(`Rp ${n(val)}`, W - 100, y, 23, b, '#111', 'right')
  })
  line(740, top + 330, W - 80, top + 330, 2)

  text('Terbilang :', 80, top + 450, 21, true)
  const tb = `# ${terbilangRupiah(total)} #`
  text(tb.slice(0, 85), 80, top + 484, 20, false, '#333')
  if (tb.length > 85) text(tb.slice(85), 80, top + 512, 20, false, '#333')

  text('Pembayaran mohon ditransfer ke:', 80, top + 590, 21, true)
  text(`Bank ${v.bankName}  No. Rekening ${v.bankAccountNo}`, 80, top + 624, 21)
  text(`a.n. ${v.bankAccountName}`, 80, top + 656, 21)

  text(`${v.city}, ${formatDate(invDate, true)}`, W - 250, top + 590, 21, false, '#111', 'center')
  text('Hormat kami,', W - 250, top + 624, 21, false, '#111', 'center')
  ctx.strokeStyle = '#1f3c8a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W - 340, top + 730)
  ctx.bezierCurveTo(W - 300, top + 680, W - 260, top + 770, W - 220, top + 700)
  ctx.bezierCurveTo(W - 200, top + 680, W - 180, top + 740, W - 150, top + 715)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(30,64,175,0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(W - 300, top + 720, 58, 0, Math.PI * 2)
  ctx.stroke()
  text(v.contactPerson, W - 250, top + 800, 21, true, '#111', 'center')
  text('Finance', W - 250, top + 830, 19, false, '#444', 'center')

  line(80, H - 110, W - 80, H - 110, 1, '#999')
  text('Dokumen ini sah dan diterbitkan secara elektronik.', W / 2, H - 75, 18, false, '#777', 'center')

  // Efek hasil foto: sedikit noise
  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4 * 7) {
    const d = (Math.random() - 0.5) * 18
    img.data[i] += d
    img.data[i + 1] += d
    img.data[i + 2] += d
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/jpeg', 0.92)
}
