import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileImage,
  FileSignature,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  PencilLine,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { dataUrlToBlob, formatBytes, putFile } from '@/lib/attachmentStore'
import { uid } from '@/lib/id'
import { parseInvoiceText, runOcr, type OcrProgress, type ParsedInvoice } from '@/lib/ocr'
import { resolveReferences, type ResolvedRefs } from '@/lib/resolve'
import { renderSampleInvoice, type SampleSpec } from '@/lib/sampleInvoice'
import { computeInvoiceAmounts, matchInvoice, matchSummary, poValue, pphRateFor, spkBilled } from '@/lib/calc'
import { addDays, toISODate } from '@/lib/dates'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { formatNPWP } from '@/lib/npwp'
import { Badge, Button, Card, Field, PageHeader, StatusBadge } from '@/components/ui'
import { MatchPanel } from '@/components/ap/MatchPanel'
import { VendorFormModal } from '@/pages/vendors/VendorForm'
import { cn } from '@/lib/cn'
import type { AttachmentCategory, Invoice, Vendor } from '@/types'

type Stage = 'upload' | 'processing' | 'review'

/** Vendor fiktif untuk contoh tagihan dari vendor yang belum terdaftar */
const UNREGISTERED_VENDOR: Vendor = {
  id: 'sample-new', code: 'VND-BARU', name: 'PT Mega Daya Teknik', legalForm: 'PT', npwp: '02.987.654.3-021.000', isPkp: true,
  category: 'Facility Management', address: 'Jl. Industri Raya Blok C No. 8', city: 'Bekasi', province: 'Jawa Barat', contactPerson: 'Hendro Wibowo',
  phone: '021-89901234', email: 'finance@megadayateknik.co.id', bankName: 'Mandiri', bankAccountNo: '1560077889900', bankAccountName: 'PT Mega Daya Teknik',
  paymentTermDays: 30, withholdingTax: 'PPh 23', status: 'Aktif', createdAt: '2026-01-01',
}

interface FormState {
  vendorId: string
  vendorInvoiceNo: string
  invoiceDate: string
  receivedDate: string
  dueDate: string
  fakturPajakNo: string
  spkId: string
  poId: string
  prId: string
  grId: string
  description: string
  dpp: number
  ppnRate: number
  pphRate: number
}

const emptyForm = (): FormState => {
  const t = toISODate(new Date())
  return { vendorId: '', vendorInvoiceNo: '', invoiceDate: t, receivedDate: t, dueDate: addDays(t, 30), fakturPajakNo: '', spkId: '', poId: '', prId: '', grId: '', description: '', dpp: 0, ppnRate: 11, pphRate: 0 }
}

const FIELD_LABEL: Record<string, string> = {
  vendorName: 'Nama Vendor', npwp: 'NPWP', invoiceNo: 'No. Invoice', invoiceDate: 'Tanggal', dueDate: 'Jatuh Tempo', fakturPajakNo: 'Faktur Pajak',
  spkNo: 'No. SPK', poNo: 'No. PO', prNo: 'No. PR', dpp: 'DPP', ppn: 'PPN', pph: 'PPh', total: 'Total', bankAccountNo: 'Rekening', description: 'Uraian',
}

export default function ScanInvoice() {
  const { vendors, spks, pos, prs, grs, invoices, settings, addInvoice, addAttachment, notify } = useStore()
  const me = useCurrentUser()
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [extraFiles, setExtraFiles] = useState<{ category: AttachmentCategory; file: File }[]>([])
  const extraRef = useRef<HTMLInputElement>(null)
  const [extraCat, setExtraCat] = useState<AttachmentCategory>('Faktur Pajak')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [stage, setStage] = useState<Stage>(params.get('mode') === 'manual' ? 'review' : 'upload')
  const [progress, setProgress] = useState<OcrProgress>({ status: '', progress: 0 })
  const [preview, setPreview] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [confidence, setConfidence] = useState<number>()
  const [method, setMethod] = useState<'OCR' | 'PDF Text' | 'Manual'>(params.get('mode') === 'manual' ? 'Manual' : 'OCR')
  const [parsed, setParsed] = useState<ParsedInvoice>({ found: [] })
  const [refs, setRefs] = useState<ResolvedRefs>({ notes: [] })
  const [form, setForm] = useState<FormState>(emptyForm())
  const [ocrFilled, setOcrFilled] = useState<Set<keyof FormState>>(new Set())
  const [showRaw, setShowRaw] = useState(false)
  const [vendorModal, setVendorModal] = useState(false)
  /** pengguna memilih untuk memilih vendor dari daftar meski OCR membaca vendor baru */
  const [pickFromList, setPickFromList] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setOcrFilled((s) => {
      const n = new Set(s)
      n.delete(k)
      return n
    })
  }

  const vendor = vendors.find((v) => v.id === form.vendorId)
  const spk = spks.find((s) => s.id === form.spkId)
  const po = pos.find((p) => p.id === form.poId)
  const pr = prs.find((p) => p.id === form.prId)
  const gr = grs.find((g) => g.id === form.grId)
  const amounts = computeInvoiceAmounts(form.dpp, form.ppnRate, form.pphRate)
  const unknownVendor = !form.vendorId && method !== 'Manual' && !pickFromList && !!(parsed.vendorName || parsed.npwp)

  // ---------------------------------------------------------------- samples
  const samples: (SampleSpec & { key: string })[] = useMemo(() => {
    const list: (SampleSpec & { key: string })[] = []
    for (const s of spks.filter((x) => x.status === 'Berjalan')) {
      const billed = spkBilled(s, invoices)
      const remaining = s.contractValue - billed
      if (remaining <= 0) continue
      const v = vendors.find((x) => x.id === s.vendorId)!
      const poS = pos.find((p) => p.id === s.poId)
      const nInv = invoices.filter((i) => i.spkId === s.id && i.status !== 'Ditolak').length
      let dpp: number
      let desc: string
      if (s.termins.length === 1) {
        const months = poS?.items[0]?.qty ?? 12
        dpp = Math.min(remaining, Math.round(s.contractValue / months))
        desc = `${s.title} periode bulan ke-${nInv + 1}`
      } else {
        const t = s.termins[Math.min(nInv, s.termins.length - 1)]
        dpp = Math.min(remaining, Math.round((s.contractValue * t.percent) / 100))
        desc = `${t.name} (${t.percent}%) ${s.title}`
      }
      list.push({ key: s.id, vendor: v, spk: s, po: poS, dpp, description: desc })
    }
    const out = list.slice(0, 4)
    // Contoh tagihan dari vendor yang BELUM terdaftar di Vendor Master
    if (!vendors.some((v) => v.npwp === UNREGISTERED_VENDOR.npwp)) {
      out.push({ key: 'new-vendor', vendor: UNREGISTERED_VENDOR, dpp: 18_500_000, description: 'Jasa servis & penggantian sparepart genset 500 kVA' })
    }
    return out
  }, [spks, pos, vendors, invoices])

  // ---------------------------------------------------------------- OCR
  const process = async (input: File | string, name: string) => {
    setError('')
    setStage('processing')
    setFileName(name)
    setSourceFile(typeof input === 'string' ? null : input)
    setMethod('OCR')
    if (typeof input === 'string') setPreview(input)
    else if (input.type.startsWith('image/')) setPreview(URL.createObjectURL(input))
    else setPreview('')
    try {
      const res = await runOcr(input, setProgress)
      setPreview(res.imageDataUrl)
      setRawText(res.text)
      setConfidence(res.confidence)
      setMethod(res.method)
      applyParsed(parseInvoiceText(res.text, { companyNpwp: settings.companyNpwp }))
      setStage('review')
    } catch (e) {
      console.error(e)
      setError('Gagal membaca dokumen. Pastikan koneksi internet aktif (model OCR diunduh saat pertama kali) dan file berupa gambar/PDF yang jelas.')
      setStage('upload')
    }
  }

  const applyParsed = (p: ParsedInvoice) => {
    setPickFromList(false)
    const r = resolveReferences(p, { vendors, spks, pos, grs, invoices })
    setParsed(p)
    setRefs(r)
    const v = vendors.find((x) => x.id === r.vendorId)
    const invDate = p.invoiceDate ?? toISODate(new Date())
    const ppnRate = p.ppn && p.dpp ? Math.round((p.ppn / p.dpp) * 100) : v ? (v.isPkp ? settings.defaultPpnRate : 0) : settings.defaultPpnRate
    const sp = spks.find((s) => s.id === r.spkId)
    const next: FormState = {
      ...emptyForm(),
      vendorId: r.vendorId ?? '',
      vendorInvoiceNo: p.invoiceNo ?? '',
      invoiceDate: invDate,
      dueDate: p.dueDate ?? addDays(invDate, v?.paymentTermDays ?? 30),
      fakturPajakNo: p.fakturPajakNo ?? '',
      spkId: r.spkId ?? '',
      poId: r.poId ?? '',
      prId: r.prId ?? '',
      grId: r.grId ?? '',
      description: p.description || (sp ? `Tagihan ${sp.title}` : ''),
      dpp: p.dpp ?? 0,
      ppnRate,
      pphRate: v ? pphRateFor(v.withholdingTax) : 0,
    }
    setForm(next)
    const filled = new Set<keyof FormState>()
    if (r.vendorId) filled.add('vendorId')
    if (p.invoiceNo) filled.add('vendorInvoiceNo')
    if (p.invoiceDate) filled.add('invoiceDate')
    if (p.dueDate) filled.add('dueDate')
    if (p.fakturPajakNo) filled.add('fakturPajakNo')
    if (r.spkId) filled.add('spkId')
    if (r.poId) filled.add('poId')
    if (r.prId) filled.add('prId')
    if (r.grId) filled.add('grId')
    if (p.description) filled.add('description')
    if (p.dpp) filled.add('dpp')
    setOcrFilled(filled)
  }

  const onFile = (f?: File | null) => {
    if (!f) return
    if (!/^image\/|application\/pdf/.test(f.type)) {
      setError('Format file tidak didukung. Gunakan JPG, PNG, WEBP atau PDF.')
      return
    }
    process(f, f.name)
  }

  const trySample = (s: SampleSpec) => {
    const img = renderSampleInvoice(s, settings)
    process(img, `contoh_tagihan_${s.vendor.code}.jpg`)
  }

  const reset = () => {
    setPickFromList(false)
    setStage('upload')
    setSourceFile(null)
    setExtraFiles([])
    setPreview('')
    setRawText('')
    setParsed({ found: [] })
    setRefs({ notes: [] })
    setForm(emptyForm())
    setOcrFilled(new Set())
    setConfidence(undefined)
  }

  // when user changes SPK → auto pull PO/PR/GR
  const pickSpk = (id: string) => {
    const s = spks.find((x) => x.id === id)
    const used = new Set(invoices.filter((i) => i.status !== 'Ditolak').map((i) => i.grId))
    const g = grs.find((x) => x.spkId === id && !used.has(x.id))
    setForm((f) => ({ ...f, spkId: id, poId: s?.poId ?? f.poId, prId: s?.prId ?? f.prId, grId: g?.id ?? '', vendorId: f.vendorId || s?.vendorId || '' }))
  }
  const pickPo = (id: string) => {
    const p = pos.find((x) => x.id === id)
    const s = spks.find((x) => x.poId === id)
    const used = new Set(invoices.filter((i) => i.status !== 'Ditolak').map((i) => i.grId))
    const g = grs.find((x) => x.poId === id && !used.has(x.id))
    setForm((f) => ({ ...f, poId: id, prId: p?.prId ?? '', spkId: s?.id ?? '', grId: g?.id ?? '', vendorId: f.vendorId || p?.vendorId || '' }))
  }
  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      vendorId: id,
      pphRate: v ? pphRateFor(v.withholdingTax) : f.pphRate,
      ppnRate: v ? (v.isPkp ? f.ppnRate || settings.defaultPpnRate : 0) : f.ppnRate,
      dueDate: v ? addDays(f.invoiceDate, v.paymentTermDays) : f.dueDate,
    }))
  }

  const checks = useMemo(
    () =>
      matchInvoice(
        { id: '', dpp: form.dpp, vendorId: form.vendorId, spkId: form.spkId || undefined, poId: form.poId || undefined, grId: form.grId || undefined, fakturPajakNo: form.fakturPajakNo },
        { spk, po, gr, invoices, vendorIsPkp: vendor?.isPkp },
      ),
    [form, spk, po, gr, invoices, vendor],
  )
  const summary = matchSummary(checks)
  const duplicate = form.vendorId && form.vendorInvoiceNo && invoices.find((i) => i.vendorId === form.vendorId && i.vendorInvoiceNo.trim().toUpperCase() === form.vendorInvoiceNo.trim().toUpperCase())
  const totalMismatch = parsed.total && Math.abs(parsed.total - amounts.total) > 2

  const save = async () => {
    if (!form.vendorId) return notify({ type: 'error', title: 'Vendor belum dipilih', message: 'Pilih vendor atau daftarkan vendor baru.' })
    if (!form.vendorInvoiceNo.trim()) return notify({ type: 'error', title: 'No. invoice vendor wajib diisi' })
    if (form.dpp <= 0) return notify({ type: 'error', title: 'Nilai DPP harus lebih dari 0' })
    if (duplicate) return notify({ type: 'error', title: 'Tagihan duplikat', message: `No. ${form.vendorInvoiceNo} sudah teregistrasi (${duplicate.number}).` })
    const data: Omit<Invoice, 'id' | 'number' | 'history' | 'paidAmount'> = {
      vendorInvoiceNo: form.vendorInvoiceNo.trim(),
      vendorId: form.vendorId,
      invoiceDate: form.invoiceDate,
      receivedDate: form.receivedDate,
      dueDate: form.dueDate,
      fakturPajakNo: form.fakturPajakNo || undefined,
      spkId: form.spkId || undefined,
      poId: form.poId || undefined,
      prId: form.prId || undefined,
      grId: form.grId || undefined,
      description: form.description || 'Tagihan vendor',
      items: [{ id: 'l1', description: form.description || 'Tagihan vendor', qty: 1, unit: 'Ls', unitPrice: form.dpp }],
      dpp: form.dpp,
      ppnRate: form.ppnRate,
      pphRate: form.pphRate,
      ...amounts,
      status: summary === 'fail' || summary === 'na' ? 'Diterima' : 'Verifikasi',
      source: method === 'Manual' ? 'Manual' : 'Scan OCR',
      ocrConfidence: method === 'Manual' ? undefined : confidence,
    }
    try {
      const inv = addInvoice(data, method !== 'Manual' ? `Dibaca otomatis (${method}) — ${parsed.found.length} field terbaca, matching: ${summary.toUpperCase()}` : undefined)
      // Simpan dokumen asli hasil scan + lampiran tambahan ke IndexedDB
      const files: { category: AttachmentCategory; name: string; blob: Blob }[] = []
      if (sourceFile) files.push({ category: 'Invoice', name: fileName, blob: sourceFile })
      else if (preview && method !== 'Manual') files.push({ category: 'Invoice', name: fileName, blob: await dataUrlToBlob(preview) })
      extraFiles.forEach((x) => files.push({ category: x.category, name: x.file.name, blob: x.file }))
      for (const f of files) {
        const id = uid('att')
        try {
          await putFile(id, f.blob)
          addAttachment(inv.id, { id, category: f.category, name: f.name, type: f.blob.type, size: f.blob.size, uploadedAt: new Date().toISOString(), uploadedBy: me.name })
        } catch {
          notify({ type: 'error', title: `Lampiran ${f.name} gagal disimpan` })
        }
      }
      notify({ type: 'success', title: 'Tagihan berhasil diregistrasi', message: `${inv.number} • ${formatIDR(inv.netPayable)}` })
      nav(`/invoices/${inv.id}`)
    } catch {
      notify({ type: 'error', title: 'Penyimpanan gagal', message: 'Kapasitas penyimpanan browser penuh. Hapus beberapa lampiran.' })
    }
  }

  const ocrCls = (k: keyof FormState) => (ocrFilled.has(k) ? 'border-emerald-300 bg-emerald-50/40' : '')
  const OcrTag = ({ k }: { k: keyof FormState }) =>
    ocrFilled.has(k) ? (
      <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 text-xs font-semibold text-emerald-700">
        <Sparkles className="size-2.5" /> {k === 'spkId' || k === 'poId' || k === 'prId' || k === 'grId' || k === 'vendorId' ? 'AUTO' : 'OCR'}
      </span>
    ) : null

  // ---------------------------------------------------------------- render
  return (
    <div>
      <PageHeader
        title={method === 'Manual' && stage === 'review' ? 'Input Tagihan Manual' : 'Scan Tagihan Vendor'}
        description="Foto atau scan tagihan — sistem membaca data secara otomatis lalu menarik dokumen internal (SPK, PO, PR, BAST/GR) sebagai rujukan pembayaran."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Tagihan Masuk', to: '/invoices' }, { label: 'Scan Tagihan' }]}
        actions={stage === 'review' && <Button variant="secondary" icon={RotateCcw} onClick={reset}>Scan Ulang</Button>}
      />

      {stage === 'upload' && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                onFile(e.dataTransfer.files?.[0])
              }}
              className={cn(
                'card flex flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition',
                drag ? 'border-brand-500 bg-brand-50/50' : 'border-slate-300',
              )}
            >
              <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <ScanLine className="size-8" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Unggah atau foto tagihan vendor</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">Seret & lepas file ke sini. Mendukung JPG, PNG, WEBP dan PDF. Untuk hasil terbaik, pastikan dokumen terang, tegak dan tidak buram.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button icon={Upload} size="lg" onClick={() => fileRef.current?.click()}>Pilih File</Button>
                <Button icon={Camera} size="lg" variant="secondary" onClick={() => camRef.current?.click()}>Ambil Foto</Button>
                <Button icon={PencilLine} size="lg" variant="ghost" onClick={() => { setMethod('Manual'); setStage('review') }}>Input Manual</Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              {error && (
                <p className="mt-5 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="size-4" />{error}</p>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ScanLine, t: '1. Baca Otomatis', d: 'OCR membaca vendor, NPWP, no. invoice, tanggal, faktur pajak, DPP, PPN & total.' },
                { icon: Link2, t: '2. Tarik Dokumen Internal', d: 'Vendor dicocokkan via NPWP; SPK, PO, PR & BAST/GR ditarik otomatis.' },
                { icon: CheckCircle2, t: '3. Validasi 3-Way Match', d: 'Nilai tagihan dibandingkan dengan kontrak & penerimaan sebelum diregistrasi.' },
              ].map((x) => (
                <div key={x.t} className="card p-4">
                  <x.icon className="size-5 text-brand-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">{x.t}</p>
                  <p className="mt-1 text-xs text-slate-500">{x.d}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="lg:col-span-2" icon={FileImage} title="Coba dengan Contoh Tagihan" subtitle="Dokumen simulasi berdasarkan SPK berjalan — akan dibaca dengan OCR sungguhan">
            <ul className="space-y-2">
              {samples.map((s) => (
                <li key={s.key}>
                  <button onClick={() => trySample(s)} className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-600 group-hover:text-white">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{s.vendor.name}</span>
                      <span className="block truncate text-xs text-slate-500">{s.description}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs">
                        {s.spk ? <span className="font-mono text-brand-700">{s.spk.number}</span> : <Badge tone="amber">Vendor belum terdaftar</Badge>}
                        <span className="font-semibold text-slate-700">{formatCompact(s.dpp)}</span>
                      </span>
                    </span>
                    <ScanLine className="size-4 shrink-0 text-slate-300 group-hover:text-brand-600" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Model OCR (Tesseract) berjalan di browser — dokumen tidak dikirim ke server. Saat pertama kali digunakan, model bahasa (~10 MB) diunduh otomatis.
            </p>
          </Card>
        </div>
      )}

      {stage === 'processing' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card relative overflow-hidden p-4">
            {preview ? (
              <div className="relative mx-auto max-h-[70vh] overflow-hidden rounded-lg">
                <img src={preview} alt="Dokumen" className="mx-auto max-h-[70vh] object-contain" />
                <div className="scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_24px_6px_rgba(59,116,246,0.45)]" />
              </div>
            ) : (
              <div className="grid h-80 place-items-center text-slate-400"><FileText className="size-16" /></div>
            )}
          </div>
          <div className="card flex flex-col justify-center p-8">
            <Loader2 className="size-10 animate-spin text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Membaca dokumen tagihan…</h3>
            <p className="mt-1 text-sm text-slate-500">{progress.status || 'Menyiapkan'}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
            </div>
            <p className="mt-2 text-right text-xs tabular-nums text-slate-500">{Math.round(progress.progress * 100)}%</p>
            <ul className="mt-6 space-y-2 text-sm">
              {['Pra-proses gambar (grayscale & kontras)', 'Pengenalan karakter (OCR)', 'Ekstraksi field tagihan', 'Pencocokan vendor & dokumen internal'].map((s, i) => {
                const done = progress.progress > (i + 1) * 0.24
                return (
                  <li key={s} className={cn('flex items-center gap-2', done ? 'text-slate-700' : 'text-slate-400')}>
                    {done ? <CheckCircle2 className="size-4 text-emerald-500" /> : <span className="size-4 rounded-full border-2 border-slate-200" />}
                    {s}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Kiri: dokumen */}
          {method !== 'Manual' && (
            <div className="space-y-4 xl:col-span-4">
              <Card
                title="Dokumen Tagihan"
                subtitle={fileName}
                actions={confidence !== undefined && <Badge tone={confidence >= 80 ? 'emerald' : confidence >= 60 ? 'amber' : 'rose'}>{method === 'PDF Text' ? 'Teks PDF' : `Akurasi OCR ${confidence}%`}</Badge>}
              >
                {preview && (
                  <a href={preview} target="_blank" rel="noreferrer">
                    <img src={preview} alt="Tagihan" className="w-full rounded-lg border border-slate-200" />
                  </a>
                )}
              </Card>
              <Card title="Field yang Terbaca" subtitle={`${parsed.found.length} field berhasil diekstrak`}>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(FIELD_LABEL).map(([k, l]) => (
                    <Badge key={k} tone={parsed.found.includes(k) ? 'emerald' : 'slate'}>
                      {parsed.found.includes(k) ? <CheckCircle2 className="size-3" /> : null}
                      {l}
                    </Badge>
                  ))}
                </div>
                <button onClick={() => setShowRaw((x) => !x)} className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-600">
                  <ChevronDown className={cn('size-3.5 transition', showRaw && 'rotate-180')} /> {showRaw ? 'Sembunyikan' : 'Lihat'} teks mentah hasil OCR
                </button>
                {showRaw && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 scrollbar-thin">{rawText}</pre>}
              </Card>
            </div>
          )}

          {/* Tengah: form */}
          <div className={cn('space-y-4', method === 'Manual' ? 'xl:col-span-7' : 'xl:col-span-5')}>
            <Card title="Data Tagihan" subtitle={method === 'Manual' ? 'Lengkapi data tagihan vendor' : 'Field hijau terisi otomatis — periksa & koreksi bila perlu'} icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vendor" required className="sm:col-span-2">
                  {unknownVendor ? (
                    <>
                      <div className="input flex h-auto min-h-9 items-center gap-2 border-amber-300 bg-amber-50/60 py-1.5">
                        <Sparkles className="size-4 shrink-0 text-amber-600" />
                        <span className="min-w-0 flex-1 font-medium text-slate-900">{parsed.vendorName || 'Nama vendor tidak terbaca'}</span>
                        <Badge tone="amber">Belum terdaftar</Badge>
                      </div>
                      {parsed.npwp && (
                        <p className="mt-1.5 text-xs text-slate-600">NPWP <span className="font-mono font-medium text-slate-800">{formatNPWP(parsed.npwp)}</span> <span className="text-slate-400">(hasil OCR)</span></p>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="relative">
                          <Button icon={UserPlus} onClick={() => setVendorModal(true)} className="ring-4 ring-brand-500/20">
                            Daftarkan Vendor Baru
                          </Button>
                          <span className="pointer-events-none absolute -right-1 -top-1 flex size-3">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                          </span>
                        </span>
                        <span className="text-xs text-slate-500">
                          Data vendor terisi otomatis dari OCR, atau{' '}
                          <button type="button" onClick={() => setPickFromList(true)} className="font-medium text-brand-600 hover:underline">pilih dari daftar vendor</button>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <select className={cn('input', ocrCls('vendorId'))} value={form.vendorId} onChange={(e) => pickVendor(e.target.value)}>
                          <option value="">— Pilih vendor —</option>
                          {vendors.filter((v) => v.status !== 'Blacklist').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <Button variant="secondary" icon={UserPlus} onClick={() => setVendorModal(true)} title="Daftarkan vendor baru" />
                      </div>
                      {vendor && <p className="mt-1.5 text-xs text-slate-600">NPWP <span className="font-mono font-medium text-slate-800">{vendor.npwp}</span></p>}
                      {refs.vendorBy && form.vendorId === refs.vendorId && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><Sparkles className="size-3" /> Vendor dikenali otomatis berdasarkan {refs.vendorBy}</p>
                      )}
                    </>
                  )}
                </Field>
                <Field label={`No. Invoice Vendor`} required>
                  <input className={cn('input font-mono', ocrCls('vendorInvoiceNo'))} value={form.vendorInvoiceNo} onChange={(e) => set('vendorInvoiceNo', e.target.value)} />
                  <OcrTag k="vendorInvoiceNo" />
                </Field>
                <Field label="No. Faktur Pajak">
                  <input className={cn('input font-mono', ocrCls('fakturPajakNo'))} value={form.fakturPajakNo} onChange={(e) => set('fakturPajakNo', e.target.value)} placeholder="010.002-26.00000000" />
                  <OcrTag k="fakturPajakNo" />
                </Field>
                <Field label="Tanggal Invoice">
                  <input type="date" className={cn('input', ocrCls('invoiceDate'))} value={form.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} />
                  <OcrTag k="invoiceDate" />
                </Field>
                <Field label="Tanggal Diterima">
                  <input type="date" className="input" value={form.receivedDate} onChange={(e) => set('receivedDate', e.target.value)} />
                </Field>
                <Field label="Jatuh Tempo" hint={vendor ? `Termin vendor ${vendor.paymentTermDays} hari` : undefined}>
                  <input type="date" className={cn('input', ocrCls('dueDate'))} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                  <OcrTag k="dueDate" />
                </Field>
                <Field label="Uraian" className="sm:col-span-2">
                  <input className={cn('input', ocrCls('description'))} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card title="Nilai Tagihan & Pajak" icon={Sparkles}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="DPP (Rp)" required className="sm:col-span-3">
                  <input type="number" min={0} className={cn('input text-right font-semibold tabular-nums', ocrCls('dpp'))} value={form.dpp || ''} onChange={(e) => set('dpp', +e.target.value)} />
                  <OcrTag k="dpp" />
                </Field>
                <Field label="Tarif PPN (%)">
                  <input type="number" step="0.01" className="input text-right" value={form.ppnRate} onChange={(e) => set('ppnRate', +e.target.value)} />
                </Field>
                <Field label="Tarif PPh (%)" hint={vendor?.withholdingTax}>
                  <input type="number" step="0.01" className="input text-right" value={form.pphRate} onChange={(e) => set('pphRate', +e.target.value)} />
                </Field>
                <div />
              </div>
              <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">DPP</dt><dd className="tabular-nums">{formatIDR(form.dpp)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">PPN {form.ppnRate}%</dt><dd className="tabular-nums">{formatIDR(amounts.ppn)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium"><dt>Total Tagihan</dt><dd className="tabular-nums">{formatIDR(amounts.total)}</dd></div>
                <div className="flex justify-between text-rose-600"><dt>Potongan PPh {form.pphRate}%</dt><dd className="tabular-nums">({formatIDR(amounts.pph)})</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900"><dt>Netto Dibayar</dt><dd className="tabular-nums">{formatIDR(amounts.netPayable)}</dd></div>
              </dl>
              {totalMismatch && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Total tercetak di dokumen {formatIDR(parsed.total!)} berbeda dengan hasil hitung {formatIDR(amounts.total)}. Periksa kembali DPP / tarif PPN.
                </p>
              )}
            </Card>
          </div>

          {/* Kanan: dokumen internal */}
          <div className={cn('space-y-4', method === 'Manual' ? 'xl:col-span-5' : 'xl:col-span-3')}>
            <Card title="Dokumen Internal (Rujukan)" subtitle="Ditarik otomatis dari sistem" icon={Link2}>
              <div className="space-y-3">
                <Field label="Surat Perintah Kerja (SPK)">
                  <select className={cn('input', ocrCls('spkId'))} value={form.spkId} onChange={(e) => pickSpk(e.target.value)}>
                    <option value="">— Tanpa SPK —</option>
                    {spks.filter((s) => !form.vendorId || s.vendorId === form.vendorId).map((s) => <option key={s.id} value={s.id}>{s.number} — {s.title}</option>)}
                  </select>
                </Field>
                <Field label="Purchase Order (PO)">
                  <select className={cn('input', ocrCls('poId'))} value={form.poId} onChange={(e) => pickPo(e.target.value)}>
                    <option value="">— Tanpa PO —</option>
                    {pos.filter((p) => !form.vendorId || p.vendorId === form.vendorId).map((p) => <option key={p.id} value={p.id}>{p.number}</option>)}
                  </select>
                </Field>
                <Field label="BAST / Goods Receipt">
                  <select className={cn('input', ocrCls('grId'))} value={form.grId} onChange={(e) => set('grId', e.target.value)}>
                    <option value="">— Belum ada —</option>
                    {grs.filter((g) => (form.spkId && g.spkId === form.spkId) || (form.poId && g.poId === form.poId)).map((g) => <option key={g.id} value={g.id}>{g.number} • {formatCompact(g.amount)}</option>)}
                  </select>
                </Field>
              </div>

              <div className="mt-4 space-y-2">
                {vendor && (
                  <RefBox icon={Building2} title={vendor.name} lines={[`NPWP ${vendor.npwp}`, `${vendor.bankName} ${vendor.bankAccountNo}`, `${vendor.isPkp ? 'PKP' : 'Non-PKP'} • ${vendor.withholdingTax} • Termin ${vendor.paymentTermDays} hari`]} badge={vendor.status} />
                )}
                {spk && (
                  <RefBox icon={FileSignature} title={spk.number} to={`/spk/${spk.id}`} lines={[spk.title, `Kontrak ${formatIDR(spk.contractValue)}`, `Sisa ${formatIDR(spk.contractValue - spkBilled(spk, invoices))} • Progres ${spk.progress}%`]} badge={spk.status} />
                )}
                {po && <RefBox icon={FileText} title={po.number} lines={[`Nilai PO ${formatIDR(poValue(po))}`, `Tgl ${formatDate(po.date)} • Buyer ${po.buyer}`]} badge={po.status} />}
                {pr && <RefBox icon={FileText} title={pr.number} lines={[pr.purpose, `${pr.department} • ${pr.requester}`]} badge={pr.status} />}
                {gr && <RefBox icon={CheckCircle2} title={gr.number} lines={[gr.description, `${formatIDR(gr.amount)} • ${formatDate(gr.date)}`]} />}
              </div>
              {refs.notes.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {refs.notes.map((n) => <li key={n} className="flex gap-1.5 text-xs text-slate-500"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />{n}</li>)}
                </ul>
              )}
            </Card>

            <Card title="Validasi" icon={CheckCircle2}>
              <MatchPanel checks={checks} />
              {duplicate && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Duplikat: invoice ini sudah teregistrasi sebagai <Link className="font-semibold underline" to={`/invoices/${duplicate.id}`}>{duplicate.number}</Link>
                </p>
              )}
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Status awal setelah disimpan: <StatusBadge status={summary === 'fail' || summary === 'na' ? 'Diterima' : 'Verifikasi'} />
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Paperclip className="size-3.5" /> Lampiran tambahan</p>
                <ul className="mt-2 space-y-1">
                  {(sourceFile || (preview && method !== 'Manual')) && (
                    <li className="flex items-center gap-2 text-xs text-slate-600"><Badge tone="blue">Invoice</Badge><span className="truncate">{fileName}</span></li>
                  )}
                  {extraFiles.map((x, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <Badge tone={x.category === 'Faktur Pajak' ? 'violet' : 'slate'}>{x.category}</Badge>
                      <span className="min-w-0 flex-1 truncate">{x.file.name} <span className="text-slate-400">({formatBytes(x.file.size)})</span></span>
                      <button onClick={() => setExtraFiles((f) => f.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" aria-label="Hapus"><X className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(['Invoice', 'Faktur Pajak', 'PO/SPK', 'Dokumen Pendukung'] as AttachmentCategory[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setExtraCat(c)
                        extraRef.current?.click()
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    >
                      <Plus className="size-3" /> {c}
                    </button>
                  ))}
                </div>
                <input
                  ref={extraRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files ?? []).filter((f) => /^image\/|application\/pdf/.test(f.type) && f.size <= 15 * 1024 * 1024)
                    setExtraFiles((x) => [...x, ...fs.map((file) => ({ category: extraCat, file }))])
                    e.target.value = ''
                  }}
                />
              </div>
              <Button className="mt-4 w-full" size="lg" icon={Save} onClick={save} disabled={!!duplicate}>
                Registrasi Tagihan
              </Button>
            </Card>
          </div>
        </div>
      )}

      <VendorFormModal
        open={vendorModal}
        onClose={() => setVendorModal(false)}
        initial={{
          name: parsed.vendorName ?? '',
          legalForm: (parsed.vendorName?.match(/^(PT|CV|UD)\b/)?.[1] as Vendor['legalForm']) ?? 'PT',
          npwp: parsed.npwp ? formatNPWP(parsed.npwp) : '',
          address: parsed.vendorAddress?.split(',').slice(0, -1).join(',').trim() || parsed.vendorAddress || '',
          city: parsed.vendorCity ?? '',
          phone: parsed.vendorPhone ?? '',
          email: parsed.vendorEmail ?? '',
          isPkp: !!parsed.ppn || !!parsed.fakturPajakNo,
          ...(parsed.bankName ? { bankName: parsed.bankName } : {}),
          bankAccountNo: parsed.bankAccountNo ?? '',
          bankAccountName: parsed.bankAccountName ?? parsed.vendorName ?? '',
          notes: 'Didaftarkan dari hasil scan OCR tagihan',
        }}
        onSaved={(v) => pickVendor(v.id)}
      />
    </div>
  )
}

function RefBox({ icon: Icon, title, lines, badge, to }: { icon: typeof FileText; title: string; lines: string[]; badge?: string; to?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 p-3 hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Icon className="size-3.5 text-brand-600" /> <span className="truncate">{title}</span></p>
        {badge && <StatusBadge status={badge} />}
      </div>
      {lines.map((l, i) => <p key={i} className="mt-0.5 truncate text-xs text-slate-500">{l}</p>)}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
