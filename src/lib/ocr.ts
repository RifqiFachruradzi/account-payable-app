import { npwpDigits, sameNPWP } from './npwp'
import { toISODate } from './dates'

export interface OcrProgress {
  status: string
  progress: number // 0-1
}

export interface OcrResult {
  text: string
  confidence: number
  imageDataUrl: string // preview (dikompres)
  method: 'OCR' | 'PDF Text'
}

/** Kompres gambar agar ringan disimpan sebagai lampiran */
export async function compressImage(src: string, maxSide = 1400, quality = 0.72): Promise<string> {
  const img = await loadImage(src)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

const readAsDataURL = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(f)
  })

/** Render halaman pertama PDF; jika PDF digital, ambil text layer langsung */
async function readPdf(file: File): Promise<{ image: string; text: string }> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
  const content = await page.getTextContent()
  // Susun ulang text per baris berdasarkan posisi Y
  const lines = new Map<number, { x: number; s: string }[]>()
  for (const it of content.items as { str: string; transform: number[] }[]) {
    if (!it.str?.trim()) continue
    const y = Math.round(it.transform[5] / 3) * 3
    if (!lines.has(y)) lines.set(y, [])
    lines.get(y)!.push({ x: it.transform[4], s: it.str })
  }
  const text = [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, l]) => l.sort((a, b) => a.x - b.x).map((p) => p.s).join(' '))
    .join('\n')
  return { image: canvas.toDataURL('image/png'), text }
}

export async function runOcr(input: File | string, onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  let source: string
  if (typeof input !== 'string' && input.type === 'application/pdf') {
    onProgress({ status: 'Membaca dokumen PDF', progress: 0.1 })
    const pdf = await readPdf(input)
    if (pdf.text.replace(/\s/g, '').length > 80) {
      onProgress({ status: 'Teks PDF digital terbaca', progress: 1 })
      return { text: pdf.text, confidence: 99, imageDataUrl: await compressImage(pdf.image), method: 'PDF Text' }
    }
    source = pdf.image
  } else {
    source = typeof input === 'string' ? input : await readAsDataURL(input)
  }

  onProgress({ status: 'Memuat mesin OCR', progress: 0.02 })
  const { createWorker } = await import('tesseract.js')
  const base = `${import.meta.env.BASE_URL}tesseract`
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    logger: (m: { status: string; progress: number }) => {
      const label: Record<string, string> = {
        'loading tesseract core': 'Memuat mesin OCR',
        'initializing tesseract': 'Inisialisasi OCR',
        'loading language traineddata': 'Memuat model bahasa',
        'initializing api': 'Menyiapkan pembaca',
        'recognizing text': 'Membaca teks dokumen',
      }
      onProgress({ status: label[m.status] ?? m.status, progress: m.status === 'recognizing text' ? 0.3 + m.progress * 0.7 : m.progress * 0.3 })
    },
  })
  try {
    // Pra-proses: grayscale + kontras agar hasil foto lebih terbaca
    const prepped = await preprocess(source)
    const { data } = await worker.recognize(prepped)
    return { text: data.text, confidence: Math.round(data.confidence), imageDataUrl: await compressImage(source), method: 'OCR' }
  } finally {
    await worker.terminate()
  }
}

async function preprocess(src: string) {
  const img = await loadImage(src)
  const scale = Math.min(2, 2200 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const d = ctx.getImageData(0, 0, c.width, c.height)
  for (let i = 0; i < d.data.length; i += 4) {
    const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]
    const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 140))
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v
  }
  ctx.putImageData(d, 0, 0)
  return c.toDataURL('image/png')
}

// ------------------------------------------------------------------
// Parser hasil OCR → field tagihan
// ------------------------------------------------------------------

export interface ParsedInvoice {
  vendorName?: string
  npwp?: string
  invoiceNo?: string
  invoiceDate?: string
  dueDate?: string
  fakturPajakNo?: string
  spkNo?: string
  poNo?: string
  prNo?: string
  dpp?: number
  ppn?: number
  pph?: number
  total?: number
  bankAccountNo?: string
  description?: string
  found: string[] // key field yang berhasil dibaca
}

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0, feb: 1, februari: 1, february: 1, mar: 2, maret: 2, march: 2, apr: 3, april: 3,
  mei: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6, agu: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, okt: 9, oktober: 9, oct: 9, october: 9, nov: 10, november: 10, des: 11, desember: 11, dec: 11, december: 11,
}

export function parseDate(s: string): string | undefined {
  let m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (mo !== undefined) return toISODate(new Date(+m[3], mo, +m[1]))
  }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return toISODate(new Date(+m[3], +m[2] - 1, +m[1]))
  return undefined
}

/** "Rp 735.000.000,00" | "735,000,000.00" | "735.000.000" → 735000000 */
export function parseAmount(s: string): number | undefined {
  const m = s.match(/(?:rp\.?|idr)?\s*([0-9][0-9.,\s]{2,})/i)
  if (!m) return undefined
  let v = m[1].replace(/\s/g, '').replace(/[.,]$/, '')
  const lastSep = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'))
  if (lastSep >= 0 && v.length - lastSep - 1 === 2) v = v.slice(0, lastSep) // buang 2 digit desimal
  v = v.replace(/[.,]/g, '')
  const n = parseInt(v, 10)
  return isNaN(n) ? undefined : n
}

const lastAmountInLine = (line: string) => {
  const all = [...line.matchAll(/(?:rp\.?\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,}/gi)].map((x) => x[0])
  for (let i = all.length - 1; i >= 0; i--) {
    const n = parseAmount(all[i])
    if (n && n >= 1000) return n
  }
  return undefined
}

export function parseInvoiceText(raw: string, opts: { companyNpwp?: string } = {}): ParsedInvoice {
  const text = raw.replace(/\r/g, '').replace(/[|]/g, ' ')
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const p: ParsedInvoice = { found: [] }
  const mark = (k: string) => !p.found.includes(k) && p.found.push(k)

  // Nama vendor: baris pertama yang mengandung bentuk badan usaha
  const vn = lines.find((l) => /\b(PT|CV|UD)\.?\s+[A-Z]/.test(l) && !/kepada|bill to|ditagihkan/i.test(l))
  if (vn) {
    p.vendorName = vn.match(/\b(?:PT|CV|UD)\.?\s+[A-Za-z0-9 &.-]+/)?.[0].trim()
    mark('vendorName')
  }

  // NPWP — abaikan NPWP perusahaan sendiri
  const npwps = [...text.matchAll(/\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d[-.\s]?\d{3}[.\s]?\d{3}|\d{4}\s?\d{4}\s?\d{4}\s?\d{4})\b/g)].map((m) => m[1])
  const vendorNpwp = npwps.find((n) => !opts.companyNpwp || !sameNPWP(n, opts.companyNpwp))
  if (vendorNpwp && [15, 16].includes(npwpDigits(vendorNpwp).length)) {
    p.npwp = vendorNpwp
    mark('npwp')
  }

  // Nomor invoice
  const invLabel = text.match(/(?:no(?:mor)?\.?\s*(?:invoice|tagihan|inv)|invoice\s*(?:no|number|#)\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9/.\-]{3,})/i)
  const invPattern = text.match(/\bINV[/\-.][A-Z0-9/\-.]{4,}/i)
  p.invoiceNo = (invLabel?.[1] ?? invPattern?.[0])?.replace(/[.,]$/, '')
  if (p.invoiceNo) mark('invoiceNo')

  // Faktur pajak 010.002-26.12345678
  const fp = text.match(/\b(0[1-9]\d[.\s]?\d{3}[-.\s]?\d{2}[.\s]?\d{8})\b/)
  if (fp) {
    p.fakturPajakNo = fp[1].replace(/\s/g, '')
    mark('fakturPajakNo')
  }

  // Referensi dokumen internal
  // OCR sering membaca "/" sebagai I, l, 1 atau | — toleransi pemisah
  const SEP = String.raw`\s*[/\-Il1|]\s*`
  const spk = text.match(new RegExp(String.raw`\bSPK${SEP}(\d{4})${SEP}([A-Z]{2,5})${SEP}(\d{3,4})`, 'i'))
  if (spk) (p.spkNo = `SPK/${spk[1]}/${spk[2].toUpperCase()}/${spk[3]}`), mark('spkNo')
  const po = text.match(new RegExp(String.raw`\bPO${SEP}(\d{4})${SEP}(\d{3,6})\b`, 'i'))
  if (po) (p.poNo = `PO/${po[1]}/${po[2]}`), mark('poNo')
  const pr = text.match(new RegExp(String.raw`\bPR${SEP}(\d{4})${SEP}([A-Z]{3})${SEP}(\d{3,5})`, 'i'))
  if (pr) (p.prNo = `PR/${pr[1]}/${pr[2].toUpperCase()}/${pr[3]}`), mark('prNo')

  // Tanggal
  for (const l of lines) {
    if (!p.dueDate && /(jatuh\s*tempo|due\s*date)/i.test(l)) {
      const d = parseDate(l)
      if (d) (p.dueDate = d), mark('dueDate')
    } else if (!p.invoiceDate && /(tanggal|tgl|date)/i.test(l) && !/(jatuh|due|spk|po\b|faktur)/i.test(l)) {
      const d = parseDate(l)
      if (d) (p.invoiceDate = d), mark('invoiceDate')
    }
  }
  if (!p.invoiceDate) {
    const d = parseDate(text)
    if (d) (p.invoiceDate = d), mark('invoiceDate')
  }

  // Nominal
  for (const l of lines) {
    const low = l.toLowerCase()
    if (/(dasar pengenaan|dpp|sub\s*total|jumlah sebelum pajak)/.test(low)) {
      const v = lastAmountInLine(l)
      if (v) (p.dpp = v), mark('dpp')
    } else if (/\bppn\b|pajak pertambahan|vat/.test(low)) {
      const v = lastAmountInLine(l.replace(/\d{1,2}([.,]\d+)?\s*%/g, ''))
      if (v) (p.ppn = v), mark('ppn')
    } else if (/\bpph\b/.test(low)) {
      const v = lastAmountInLine(l.replace(/\d{1,2}([.,]\d+)?\s*%/g, ''))
      if (v) (p.pph = v), mark('pph')
    } else if (/(grand\s*total|total\s*tagihan|jumlah\s*tagihan|total\s*amount|total\s*invoice|\btotal\b)/.test(low) && !/sub\s*total/.test(low)) {
      const v = lastAmountInLine(l)
      if (v && (!p.total || v > p.total)) (p.total = v), mark('total')
    }
  }
  if (!p.dpp && p.total && p.ppn) p.dpp = p.total - p.ppn
  if (!p.dpp && p.total) p.dpp = Math.round(p.total / 1.11)

  // Rekening
  const acc = text.match(/(?:rek(?:ening)?|a\/c|account)[^\d]{0,20}([\d\-\s]{8,20})/i)
  if (acc) (p.bankAccountNo = acc[1].replace(/\D/g, '')), mark('bankAccountNo')

  // Uraian: baris setelah "Uraian/Keterangan/Description" (lewati baris header tabel)
  const descIdx = lines.findIndex((l) => /(uraian|keterangan|deskripsi|description|perihal)/i.test(l))
  if (descIdx >= 0) {
    const sameLine = lines[descIdx].replace(/.*(uraian|keterangan|deskripsi|description|perihal)\s*(pekerjaan|barang|jasa)?\s*[:-]?\s*/i, '')
    const isHeader = /^(jumlah|amount|qty|harga|nilai|total)\b/i.test(sameLine) || sameLine.length <= 8
    const cand = isHeader ? lines[descIdx + 1] : sameLine
    if (cand) {
      const d = cand
        .replace(/^\d{1,2}[.)]?\s+/, '')
        .replace(/\s*(rp\.?\s*)?\d{1,3}([.,]\d{3})+([.,]\d{2})?\s*$/i, '')
        .trim()
      if (d.length > 3) (p.description = d), mark('description')
    }
  }
  return p
}
