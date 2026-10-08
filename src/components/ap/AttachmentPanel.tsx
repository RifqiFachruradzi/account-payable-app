import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileBadge,
  FileImage,
  FileSignature,
  FileText,
  Files,
  Loader2,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { AttachmentCategory, Invoice } from '@/types'
import { useStore } from '@/store/useStore'
import { dataUrlToBlob, deleteFile, formatBytes, getFile, putFile } from '@/lib/attachmentStore'
import { compressImage } from '@/lib/ocr'
import { renderFakturPajak, renderInvoiceDocument, renderPoDocument, renderReceiptDocument, renderSpkDocument } from '@/lib/documents'
import { uid } from '@/lib/id'
import { formatDateTime } from '@/lib/format'
import { Badge, Button, Modal } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PdfViewer } from './PdfViewer'

export const CATEGORIES: { key: AttachmentCategory; icon: LucideIcon; hint: string }[] = [
  { key: 'Invoice', icon: Receipt, hint: 'Invoice / kuitansi asli dari vendor' },
  { key: 'Faktur Pajak', icon: FileBadge, hint: 'e-Faktur PPN (wajib untuk vendor PKP)' },
  { key: 'PO/SPK', icon: FileSignature, hint: 'Purchase Order & Surat Perintah Kerja' },
  { key: 'Dokumen Pendukung', icon: Files, hint: 'BAST / GR, laporan progres, foto, timesheet, dll.' },
]

const MAX_SIZE = 15 * 1024 * 1024

interface DocItem {
  key: string
  category: AttachmentCategory
  name: string
  type: string
  source: 'upload' | 'system' | 'legacy'
  meta: string
  attId?: string
  load: () => Promise<Blob>
}

interface Opened {
  item: DocItem
  url: string
  type: string
}

export function AttachmentPanel({ invoice }: { invoice: Invoice }) {
  const { vendors, spks, pos, prs, grs, settings, addAttachment, removeAttachment, notify } = useStore()
  const vendor = vendors.find((v) => v.id === invoice.vendorId)!
  const spk = spks.find((s) => s.id === invoice.spkId)
  const po = pos.find((p) => p.id === invoice.poId)
  const pr = prs.find((p) => p.id === invoice.prId)
  const gr = grs.find((g) => g.id === invoice.grId)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<AttachmentCategory, HTMLInputElement | null>>>({})

  const items = useMemo(() => {
    const list: DocItem[] = []
    const sys = (category: AttachmentCategory, key: string, name: string, meta: string, render: () => string) =>
      list.push({ key, category, name, type: 'image/jpeg', source: 'system', meta, load: () => dataUrlToBlob(render()) })

    // Upload pengguna (IndexedDB)
    for (const a of invoice.attachments ?? []) {
      list.push({
        key: a.id,
        attId: a.id,
        category: a.category,
        name: a.name,
        type: a.type,
        source: 'upload',
        meta: `${formatBytes(a.size)} • ${a.uploadedBy} • ${formatDateTime(a.uploadedAt)}`,
        load: async () => {
          const b = await getFile(a.id)
          if (!b) throw new Error('missing')
          return b
        },
      })
    }
    // Lampiran lama (disimpan sebagai data URL)
    if (invoice.attachmentDataUrl) {
      list.push({
        key: 'legacy',
        category: 'Invoice',
        name: invoice.attachmentName ?? 'scan_tagihan.jpg',
        type: 'image/jpeg',
        source: 'legacy',
        meta: `Hasil ${invoice.source}`,
        load: () => dataUrlToBlob(invoice.attachmentDataUrl!),
      })
    }
    const hasInvoiceFile = list.some((i) => i.category === 'Invoice')
    if (!hasInvoiceFile) {
      sys('Invoice', 'sys-inv', invoice.attachmentName?.replace(/\.pdf$/i, '.jpg') ?? `Invoice ${invoice.vendorInvoiceNo}.jpg`, `Salinan digital dari data registrasi ${invoice.number}`, () =>
        renderInvoiceDocument(
          {
            vendor,
            invoiceNo: invoice.vendorInvoiceNo,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            fakturPajakNo: invoice.fakturPajakNo,
            spkNo: spk?.number,
            poNo: po?.number,
            spkTitle: spk?.title,
            description: invoice.description,
            dpp: invoice.dpp,
            ppnRate: invoice.ppnRate,
          },
          settings,
          { scanned: invoice.source === 'Scan OCR' },
        ),
      )
    }
    if (invoice.fakturPajakNo && !list.some((i) => i.category === 'Faktur Pajak')) {
      sys('Faktur Pajak', 'sys-fp', `Faktur Pajak ${invoice.fakturPajakNo}.jpg`, `e-Faktur • DPP & PPN sesuai tagihan`, () =>
        renderFakturPajak(
          { fakturNo: invoice.fakturPajakNo!, vendor, invoiceDate: invoice.invoiceDate, description: invoice.description, dpp: invoice.dpp, ppnRate: invoice.ppnRate, invoiceNo: invoice.vendorInvoiceNo },
          settings,
        ),
      )
    }
    if (po) sys('PO/SPK', 'sys-po', `${po.number.replace(/\//g, '-')}.jpg`, 'Ditarik dari sistem pengadaan', () => renderPoDocument(po, vendor, settings, pr))
    if (spk) sys('PO/SPK', 'sys-spk', `${spk.number.replace(/\//g, '-')}.jpg`, 'Ditarik dari sistem kontrak', () => renderSpkDocument(spk, vendor, settings, po, pr))
    if (gr)
      sys('Dokumen Pendukung', 'sys-gr', `${gr.number.replace(/\//g, '-')}.jpg`, `${gr.type === 'BAST' ? 'Berita Acara Serah Terima' : 'Goods Receipt'} • ditarik dari sistem`, () =>
        renderReceiptDocument(gr, vendor, settings, spk?.number ?? po?.number),
      )
    return list
  }, [invoice, vendor, spk, po, pr, gr, settings])

  // bersihkan object URL saat viewer ditutup
  useEffect(() => () => {
    if (opened) URL.revokeObjectURL(opened.url)
  }, [opened])

  const view = async (item: DocItem) => {
    setBusy(item.key)
    try {
      const blob = await item.load()
      setOpened({ item, url: URL.createObjectURL(blob), type: blob.type || item.type })
    } catch {
      notify({ type: 'error', title: 'Dokumen tidak dapat dibuka', message: 'File tidak ditemukan di penyimpanan browser ini. Unggah ulang dokumen.' })
    } finally {
      setBusy(null)
    }
  }

  const download = async (item: DocItem) => {
    try {
      const blob = await item.load()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      notify({ type: 'error', title: 'Gagal mengunduh dokumen' })
    }
  }

  const upload = async (category: AttachmentCategory, files: FileList | null) => {
    if (!files?.length) return
    setBusy(`up-${category}`)
    const me = useStore.getState().users.find((u) => u.id === useStore.getState().currentUserId)!
    for (const f of Array.from(files)) {
      if (!/^image\/|application\/pdf/.test(f.type)) {
        notify({ type: 'error', title: `${f.name} ditolak`, message: 'Format yang didukung: PDF, JPG, PNG, WEBP.' })
        continue
      }
      if (f.size > MAX_SIZE) {
        notify({ type: 'error', title: `${f.name} terlalu besar`, message: `Maksimal ${formatBytes(MAX_SIZE)} per file.` })
        continue
      }
      try {
        let blob: Blob = f
        if (f.type.startsWith('image/') && f.size > 1.5 * 1024 * 1024) {
          const url = URL.createObjectURL(f)
          blob = await dataUrlToBlob(await compressImage(url, 2200, 0.85))
          URL.revokeObjectURL(url)
        }
        const id = uid('att')
        await putFile(id, blob)
        addAttachment(invoice.id, { id, category, name: f.name, type: blob.type || f.type, size: blob.size, uploadedAt: new Date().toISOString(), uploadedBy: me.name })
      } catch {
        notify({ type: 'error', title: `Gagal menyimpan ${f.name}`, message: 'Penyimpanan browser penuh atau tidak tersedia.' })
      }
    }
    setBusy(null)
    notify({ type: 'success', title: `Lampiran ${category} diperbarui` })
  }

  const remove = async (item: DocItem) => {
    if (!item.attId || !confirm(`Hapus lampiran ${item.name}?`)) return
    await deleteFile(item.attId).catch(() => undefined)
    removeAttachment(invoice.id, item.attId)
  }

  const required: Record<AttachmentCategory, boolean> = {
    Invoice: true,
    'Faktur Pajak': vendor.isPkp && invoice.ppnRate > 0,
    'PO/SPK': true,
    'Dokumen Pendukung': false,
  }
  const complete = CATEGORIES.filter((c) => required[c.key]).every((c) => items.some((i) => i.category === c.key))

  return (
    <section className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-600"><Paperclip className="size-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Lampiran Dokumen</h3>
            <p className="mt-0.5 text-xs text-slate-500">{items.length} dokumen • klik untuk membuka</p>
          </div>
        </div>
        {complete ? (
          <Badge tone="emerald"><CheckCircle2 className="size-3" /> Kelengkapan dokumen terpenuhi</Badge>
        ) : (
          <Badge tone="amber">Dokumen wajib belum lengkap</Badge>
        )}
      </header>
      <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
        {CATEGORIES.map((c) => {
          const list = items.filter((i) => i.category === c.key)
          const missing = required[c.key] && list.length === 0
          return (
            <div key={c.key} className={cn('rounded-xl border p-3', missing ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200')}>
              <div className="flex items-center gap-2">
                <c.icon className="size-4 text-brand-600" />
                <p className="text-sm font-semibold text-slate-800">{c.key}</p>
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500">{list.length}</span>
                {required[c.key] && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Wajib</span>}
                <button
                  onClick={() => inputs.current[c.key]?.click()}
                  disabled={busy === `up-${c.key}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                >
                  {busy === `up-${c.key}` ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Unggah
                </button>
                <input
                  ref={(el) => {
                    inputs.current[c.key] = el
                  }}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    upload(c.key, e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{c.hint}</p>
              <ul className="mt-2 space-y-1.5">
                {list.length === 0 && <li className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">Belum ada dokumen</li>}
                {list.map((it) => {
                  const Icon = it.type === 'application/pdf' ? FileText : FileImage
                  return (
                    <li key={it.key} className="group flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-2.5 py-2 hover:border-brand-200 hover:bg-brand-50/30">
                      <button onClick={() => view(it)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', it.type === 'application/pdf' ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600')}>
                          {busy === it.key ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-800 group-hover:text-brand-700">{it.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {it.source === 'system' && <span className="mr-1 rounded bg-violet-50 px-1 font-medium text-violet-700">Sistem</span>}
                            {it.meta}
                          </span>
                        </span>
                      </button>
                      <button onClick={() => view(it)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Lihat"><Eye className="size-4" /></button>
                      <button onClick={() => download(it)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Unduh"><Download className="size-4" /></button>
                      {it.source === 'upload' && (
                        <button onClick={() => remove(it)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Hapus"><Trash2 className="size-4" /></button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      <Modal
        open={!!opened}
        onClose={() => setOpened(null)}
        size="xl"
        title={opened?.item.name ?? ''}
        description={opened ? `${opened.item.category} • ${opened.item.meta}` : undefined}
        footer={
          opened && (
            <>
              <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(opened.url, '_blank', 'noopener')}>Buka di Tab Baru</Button>
              <Button icon={Download} onClick={() => download(opened.item)}>Unduh</Button>
            </>
          )
        }
      >
        {opened &&
          (opened.type === 'application/pdf' ? (
            <PdfViewer url={opened.url} />
          ) : (
            <img src={opened.url} alt={opened.item.name} className="mx-auto max-h-[65vh] rounded-lg border border-slate-200 object-contain shadow-sm" />
          ))}
      </Modal>
    </section>
  )
}
