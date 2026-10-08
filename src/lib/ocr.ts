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
  regions?: OcrRegions
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
async function readPdf(file: File): Promise<{ image: string; text: string; regions: OcrRegions }> {
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
  const h = page.getViewport({ scale: 1 }).height
  const join = (pred: (y: number) => boolean) =>
    [...lines.entries()]
      .filter(([y]) => pred(y))
      .sort((a, b) => b[0] - a[0])
      .map(([, l]) => l.sort((a, b) => a.x - b.x).map((p) => p.s).join(' '))
      .join('\n')
  const text = join(() => true)
  // koordinat PDF: y dihitung dari bawah halaman
  return { image: canvas.toDataURL('image/png'), text, regions: { header: join((y) => y > h * 0.75), footer: join((y) => y < h * 0.45) } }
}

export async function runOcr(input: File | string, onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  let source: string
  if (typeof input !== 'string' && input.type === 'application/pdf') {
    onProgress({ status: 'Membaca dokumen PDF', progress: 0.1 })
    const pdf = await readPdf(input)
    if (pdf.text.replace(/\s/g, '').length > 80) {
      onProgress({ status: 'Teks PDF digital terbaca', progress: 1 })
      return { text: pdf.text, confidence: 99, imageDataUrl: await compressImage(pdf.image), method: 'PDF Text', regions: pdf.regions }
    }
    source = pdf.image
  } else {
    source = typeof input === 'string' ? input : await readAsDataURL(input)
  }

  onProgress({ status: 'Memuat mesin OCR', progress: 0.02 })
  const { createWorker } = await import('tesseract.js')
  const base = `${import.meta.env.BASE_URL}tesseract`
  // fase: 0 = seluruh halaman, 1 = kop, 2 = tanda tangan & stempel
  let phase = 0
  const PHASES = [
    { from: 0.3, span: 0.5, label: 'Membaca teks dokumen' },
    { from: 0.8, span: 0.08, label: 'Membaca kop invoice' },
    { from: 0.88, span: 0.12, label: 'Membaca tanda tangan & stempel' },
  ]
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
      if (m.status === 'recognizing text') {
        const ph = PHASES[phase]
        onProgress({ status: ph.label, progress: ph.from + m.progress * ph.span })
      } else onProgress({ status: label[m.status] ?? m.status, progress: m.progress * 0.3 })
    },
  })
  try {
    // Pra-proses: grayscale + kontras agar hasil foto lebih terbaca
    const prepped = await preprocess(source)
    const { data } = await worker.recognize(prepped)
    // Baca ulang per area agar nama vendor di kop / tanda tangan / stempel lebih akurat
    const regions: OcrRegions = {}
    try {
      const img = await loadImage(prepped)
      const W = img.width
      const H = img.height
      phase = 1
      regions.header = (await worker.recognize(prepped, { rectangle: { left: 0, top: 0, width: W, height: Math.round(H * 0.25) } })).data.text
      phase = 2
      // mode 11 (sparse text): teks tersebar/miring seperti stempel & tanda tangan
      await worker.setParameters({ tessedit_pageseg_mode: '11' as never })
      const top = Math.round(H * 0.55)
      regions.footer = (await worker.recognize(prepped, { rectangle: { left: 0, top, width: W, height: H - top } })).data.text
    } catch (e) {
      console.warn('OCR per area gagal', e)
    }
    return { text: data.text, confidence: Math.round(data.confidence), imageDataUrl: await compressImage(source), method: 'OCR', regions }
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

export type VendorSource = 'Kop Invoice' | 'Tanda Tangan / Stempel' | 'Rekening (a.n.)' | 'Dekat NPWP' | 'Isi Dokumen'
export interface VendorCandidate {
  name: string
  /** bagian dokumen tempat nama ini terbaca — makin banyak, makin meyakinkan */
  sources: VendorSource[]
}

/** Teks OCR per area dokumen */
export interface OcrRegions {
  header?: string // ±25% bagian atas (kop)
  footer?: string // ±45% bagian bawah (tanda tangan & stempel)
}

const splitLines = (t: string) => t.replace(/\r/g, '').replace(/[|]/g, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

export interface ParsedInvoice {
  vendorName?: string
  vendorAddress?: string
  vendorCity?: string
  vendorPhone?: string
  vendorEmail?: string
  bankName?: string
  bankAccountName?: string
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
  /** kandidat nama vendor beserta asal bacaannya (urut prioritas) */
  vendorCandidates?: VendorCandidate[]
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

/** "PT MEGA DAYA TEKNIK" → "PT Mega Daya Teknik" (hanya bila seluruhnya kapital) */
function titleCase(v: string) {
  if (v !== v.toUpperCase()) return v
  return v
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Pt|Cv|Ud|Tbk)\b/g, (m) => m.toUpperCase())
}

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** Inti nama badan usaha untuk perbandingan: tanpa PT/CV/Tbk & tanda baca */
export function coreName(v: string) {
  return v
    .toLowerCase()
    .replace(/\b(pt|cv|ud|tbk|persero|koperasi)\b\.?/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
/** ≥ 2/3 kata sama — toleran terhadap salah baca OCR satu kata */
function similarWords(a: string, b: string) {
  const A = a.split(' ').filter((w) => w.length > 2)
  const B = new Set(b.split(' ').filter((w) => w.length > 2))
  if (A.length < 2 || B.size < 2) return false
  return A.filter((w) => B.has(w)).length / Math.max(A.length, B.size) >= 0.66
}

export function parseInvoiceText(raw: string, opts: { companyNpwp?: string; companyName?: string; regions?: OcrRegions } = {}): ParsedInvoice {
  const text = raw.replace(/\r/g, '').replace(/[|]/g, ' ')
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const p: ParsedInvoice = { found: [] }
  const mark = (k: string) => !p.found.includes(k) && p.found.push(k)

  // ---------------------------------------------------------------- Nama vendor
  // Tagihan memuat 2 badan usaha: VENDOR (penerbit, biasanya di kop / tanda tangan / rekening)
  // dan PERUSAHAAN KITA (penerima, di blok "Kepada Yth." / "Bill To"). Nama perusahaan sendiri
  // tidak boleh terbaca sebagai vendor.
  const companyCore = coreName(opts.companyName ?? '')
  const isCompany = (name: string) => {
    const c = coreName(name)
    return !!companyCore && !!c && (c.includes(companyCore) || companyCore.includes(c) || similarWords(c, companyCore))
  }
  const extractName = (l: string) =>
    titleCase(
      (l.match(/\b(?:PT|CV|UD|Koperasi)\.?\s+[A-Za-z0-9 &.,'-]+/i)?.[0] ?? '')
        // potong label kolom lain yang ikut terbaca dalam satu baris
        .replace(/\s+(INVOICE|FAKTUR|KWITANSI|TAGIHAN|NOTA|Tanggal|Tgl|Date|No\.?|Nomor|NPWP|Telp|Jl\.|Jalan|Jatuh)\b.*$/i, '')
        .replace(/[,.\s-]+$/, '')
        .trim(),
    )
  const RECIPIENT = /(kepada|yth\b|bill\s*to|ship\s*to|ditujukan|ditagihkan|customer|pelanggan|pembeli|buyer|sold\s*to|penerima)/i
  /** Indeks baris yang termasuk blok penerima ("Kepada Yth." dst.) */
  const recipientSet = (ls: string[]) => {
    const set = new Set<number>()
    ls.forEach((l, i) => {
      if (!RECIPIENT.test(l)) return
      // s.d. nama perusahaan kita (+1 baris alamat), maks. 3 baris; berhenti di judul INVOICE/FAKTUR
      let end = Math.min(i + 3, ls.length - 1)
      for (let k = i; k <= end; k++) {
        if (k > i && /^(tax\s+)?(invoice|faktur|kwitansi|nota)\b/i.test(ls[k])) {
          end = k - 1
          break
        }
        if (isCompany(extractName(ls[k]) || ls[k])) {
          end = Math.min(end, k + 1)
          break
        }
      }
      for (let k = i; k <= end; k++) set.add(k)
    })
    return set
  }
  const NOT_NAME = /\b(invoice|faktur|kwitansi|tagihan|nota|kepada|yth|tanggal|date|nomor|npwp|telp|phone|email|alamat|jl|jalan|total|jumlah|bank|rekening|hormat|kami|finance|direktur|director|manager|lampiran|terbilang|halaman|page)\b/i
  /** Nama tanpa bentuk badan usaha (mis. logo teks "MEGA DAYA TEKNIK") — hanya dipakai di kop */
  const upperName = (l: string) => {
    const t = l.replace(/[^A-Za-z&.' -]/g, ' ').replace(/\s+/g, ' ').trim()
    const words = t.split(' ').filter((w) => w.length > 1)
    if (words.length < 2 || words.length > 6 || NOT_NAME.test(t)) return ''
    // saring noise OCR dari logo/gambar: minimal 2 kata ≥ 4 huruf yang mengandung vokal & konsonan
    const real = words.filter((w) => w.length >= 4 && /[aiueo]/i.test(w) && /[^aiueo]/i.test(w) && !/(.)\1\1/i.test(w))
    if (real.length < 2) return ''
    return t === t.toUpperCase() ? titleCase(t) : ''
  }
  /** Rapikan nama: hapus pengulangan ("PT A B PT A B") & potongan huruf sisa di akhir */
  const cleanName = (n: string) => {
    let w = n.replace(/\s+/g, ' ').trim().split(' ')
    for (let k = Math.floor(w.length / 2); k >= 2; k--) {
      if (w.slice(0, k).join(' ').toLowerCase() === w.slice(k, 2 * k).join(' ').toLowerCase()) {
        w = w.slice(0, k)
        break
      }
    }
    while (w.length > 2 && w[w.length - 1].replace(/[^A-Za-z]/g, '').length <= 2 && !/^(&|dan)$/i.test(w[w.length - 1])) w.pop()
    return titleCase(w.join(' '))
  }

  const candidates: VendorCandidate[] = []
  const addCandidate = (raw: string | undefined, source: VendorSource) => {
    if (!raw) return
    const name = cleanName(raw)
    if (name.split(' ').length < 2 || isCompany(name)) return
    const key = coreName(name)
    if (key.replace(/\s/g, '').length < 4) return
    // gabungkan dengan kandidat yang sama / terpotong (mis. "PT Mega Da" ⊂ "PT Mega Daya Teknik")
    const same = candidates.find((c) => {
      const k = coreName(c.name)
      if (k === key || k.startsWith(key) || key.startsWith(k)) return true
      // salah baca 1–2 huruf: bandingkan dengan awalan sepanjang nama yang lebih pendek
      const [short, long] = k.length < key.length ? [k, key] : [key, k]
      return short.length >= 6 && levenshtein(short, long.slice(0, short.length)) <= Math.max(1, Math.floor(short.length * 0.25))
    })
    if (same) {
      if (key.length > coreName(same.name).length) same.name = name
      if (!same.sources.includes(source)) same.sources.push(source)
      return
    }
    candidates.push({ name, sources: [source] })
  }
  const recipientLines = recipientSet(lines)
  const named = lines.map((l, i) => ({ l, i, name: extractName(l) })).filter((c) => c.name)

  // 1) Kop invoice (bagian atas dokumen)
  const headerLines = opts.regions?.header ? splitLines(opts.regions.header) : lines.slice(0, 8)
  const headerRecipient = opts.regions?.header ? recipientSet(headerLines) : recipientLines
  headerLines.forEach((l, i) => !headerRecipient.has(i) && addCandidate(extractName(l), 'Kop Invoice'))
  if (!candidates.length) headerLines.forEach((l, i) => !headerRecipient.has(i) && addCandidate(upperName(l), 'Kop Invoice'))
  // 2) Area tanda tangan & stempel (bagian bawah dokumen)
  const signIdx = lines.findIndex((l) => /(hormat kami|regards|sincerely|tertanda)/i.test(l))
  if (opts.regions?.footer) {
    const fl = splitLines(opts.regions.footer)
    const fr = recipientSet(fl)
    fl.forEach((l, i) => !fr.has(i) && !/\ba\.?\s?n\.?\s/i.test(l) && addCandidate(extractName(l), 'Tanda Tangan / Stempel'))
  }
  if (signIdx >= 0) named.filter((c) => c.i > signIdx && !/\ba\.?\s?n\.?\s/i.test(c.l)).forEach((c) => addCandidate(c.name, 'Tanda Tangan / Stempel'))
  // 3) Nama pemilik rekening (a.n.)
  const an = text.match(/\ba\.?\s?n\.?\s+((?:PT|CV|UD)?\.?\s*[A-Za-z][A-Za-z0-9 &.,-]{2,60})/i)
  if (an && !isCompany(an[1])) {
    p.bankAccountName = titleCase(an[1].replace(/\s+(Bank|No\.?|Rek|Hormat|Jakarta|Bekasi|Tangerang|Bogor|Depok|Surabaya|Bandung).*$/i, '').trim())
    addCandidate(extractName(p.bankAccountName) || p.bankAccountName, 'Rekening (a.n.)')
  }
  // 4) Dekat NPWP vendor
  const vendorNpwpLine = lines.findIndex((l, i) => /npwp/i.test(l) && !recipientLines.has(i) && !(opts.companyNpwp && sameNPWP(l.replace(/\D/g, ''), opts.companyNpwp)))
  if (vendorNpwpLine >= 0) named.filter((c) => Math.abs(c.i - vendorNpwpLine) <= 3 && !recipientLines.has(c.i)).forEach((c) => addCandidate(c.name, 'Dekat NPWP'))
  // 5) Badan usaha lain di isi dokumen
  named.filter((c) => !recipientLines.has(c.i)).forEach((c) => addCandidate(c.name, 'Isi Dokumen'))

  // Urutkan: dikonfirmasi lebih banyak bagian dokumen → lebih dulu; sisanya sesuai prioritas sumber
  candidates.sort((a, b) => b.sources.length - a.sources.length)
  p.vendorCandidates = candidates
  if (candidates.length) {
    p.vendorName = candidates[0].name
    mark('vendorName')
    // Baris sesudah nama vendor di kop biasanya alamat
    const at = lines.findIndex((l, i) => i < 10 && !recipientLines.has(i) && coreName(l).includes(coreName(candidates[0].name)))
    const next = at >= 0 ? lines[at + 1] : undefined
    if (next && !recipientLines.has(at + 1) && !/(telp|tel\.|phone|npwp|@|kepada|invoice)/i.test(next) && /[a-z]/i.test(next)) {
      // OCR kerap membaca "Jl." sebagai "JI." / "J1."
      p.vendorAddress = next.replace(/^(alamat|address)\s*:?\s*/i, '').replace(/\bJ[I1l]\.\s*/g, 'Jl. ')
      const parts = p.vendorAddress.split(',').map((x) => x.trim()).filter(Boolean)
      if (parts.length > 1) p.vendorCity = parts[parts.length - 1]
    }
  }
  const phone = text.match(/(?:telp|tel|phone|hp|telepon)\.?\s*:?\s*(\+?[\d][\d\s\-()]{6,}\d)/i)
  if (phone) p.vendorPhone = phone[1].trim()
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
  if (email) p.vendorEmail = email[0].toLowerCase()
  const bank = text.match(/\bbank\s+(BCA|BNI|BRI|BSI|BTN|Mandiri|CIMB(?:\s+Niaga)?|Permata|Danamon|OCBC(?:\s+NISP)?|Maybank|Panin|Mega)\b/i)
  if (bank) p.bankName = bank[1].toUpperCase().length <= 4 ? bank[1].toUpperCase() : titleCase(bank[1])

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
