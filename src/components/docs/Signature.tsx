import { useEffect, useState } from 'react'
import { Clock, PenLine } from 'lucide-react'
import type { DocSignature } from '@/types'
import { Button, Field, Modal } from '@/components/ui'
import { SignaturePad } from '@/components/ui/SignaturePad'
import { formatDateTime } from '@/lib/format'

/** Dialog untuk membubuhkan tanda tangan (nama, jabatan, catatan + coretan tanda tangan) */
export function SignatureDialog({ open, onClose, onSign, title, description, defaultName = '', defaultTitle = '', confirmLabel = 'Tanda Tangani', tone = 'primary' }: {
  open: boolean
  onClose: () => void
  onSign: (s: DocSignature) => void
  title: string
  description?: string
  defaultName?: string
  defaultTitle?: string
  confirmLabel?: string
  tone?: 'primary' | 'success' | 'danger'
}) {
  const [name, setName] = useState(defaultName)
  const [jabatan, setJabatan] = useState(defaultTitle)
  const [note, setNote] = useState('')
  const [sig, setSig] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setName(defaultName)
      setJabatan(defaultTitle)
      setNote('')
      setSig(null)
    }
  }, [open, defaultName, defaultTitle])
  const needSig = tone !== 'danger'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant={tone}
            disabled={!name.trim() || (needSig && !sig) || (tone === 'danger' && !note.trim())}
            onClick={() => onSign({ name: name.trim(), title: jabatan.trim(), at: new Date().toISOString(), signature: sig ?? undefined, note: note.trim() || undefined })}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Jabatan"><input className="input" value={jabatan} onChange={(e) => setJabatan(e.target.value)} /></Field>
        <Field label={tone === 'danger' ? 'Alasan' : 'Catatan'} required={tone === 'danger'} className="sm:col-span-2">
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {needSig && (
          <div className="sm:col-span-2">
            <p className="label">Tanda Tangan <span className="text-rose-500">*</span></p>
            <SignaturePad onChange={setSig} />
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Kotak tampilan tanda tangan pada dokumen */
export function SignatureBox({ label, sig, pending, action }: { label: string; sig?: DocSignature; pending?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 p-3 text-center">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <div className="my-2 grid h-20 place-items-center">
        {sig?.signature ? (
          <img src={sig.signature} alt="Tanda tangan" className="max-h-20 max-w-full object-contain" />
        ) : sig ? (
          <span className="flex items-center gap-1 text-xs text-emerald-700"><PenLine className="size-3.5" /> Tercatat</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="size-3.5" /> {pending ?? 'Belum ditandatangani'}</span>
        )}
      </div>
      <p className="border-t border-slate-200 pt-1.5 text-sm font-medium text-slate-800">{sig?.name ?? '……………………'}</p>
      <p className="text-[11px] text-slate-500">{sig?.title || ' '}</p>
      {sig && <p className="text-[11px] text-slate-400">{formatDateTime(sig.at)}</p>}
      {sig?.note && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">“{sig.note}”</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
