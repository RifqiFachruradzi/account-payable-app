import { useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { downloadText, parseCSV, toCSV } from '@/lib/csv'
import type { ImportResult } from '@/lib/importers'
import { cn } from '@/lib/cn'

export interface CsvTemplate {
  file: string
  headers: string[]
  rows: string[][]
  notes: string[]
}

/** Modal import CSV: unduh template → unggah → pratinjau & validasi → import */
export function CsvImportModal<T extends { id: string }>({ open, onClose, title, template, parse, columns, onImport }: {
  open: boolean
  onClose: () => void
  title: string
  template: CsvTemplate
  parse: (rows: Record<string, string>[]) => ImportResult<T>
  columns: { label: string; render: (d: T) => ReactNode; className?: string }[]
  onImport: (docs: T[]) => void
}) {
  const [file, setFile] = useState<string>('')
  const [result, setResult] = useState<ImportResult<T> | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile('')
    setResult(null)
    setRowCount(0)
  }
  const close = () => {
    reset()
    onClose()
  }

  const load = async (f?: File) => {
    if (!f) return
    const text = await f.text()
    const rows = parseCSV(text)
    setFile(f.name)
    setRowCount(rows.length)
    setResult(rows.length ? parse(rows) : { docs: [], errors: [{ row: 1, message: 'File kosong atau tidak memiliki baris data' }], rowsOf: new Map() })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={title}
      description="Unggah file CSV (pemisah ; atau ,) sesuai template. Data divalidasi sebelum disimpan."
      footer={
        <>
          <Button variant="secondary" onClick={close}>Batal</Button>
          <Button
            icon={CheckCircle2}
            disabled={!result?.docs.length}
            onClick={() => {
              onImport(result!.docs)
              close()
            }}
          >
            Import {result?.docs.length ?? 0} Dokumen
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileSpreadsheet className="size-4 text-emerald-600" /> 1. Unduh Template</p>
            <p className="mt-1 text-xs text-slate-500">Buka di Excel / Google Sheets, isi data, lalu simpan sebagai CSV.</p>
            <Button className="mt-3 w-full" variant="secondary" size="sm" icon={Download} onClick={() => downloadText(template.file, toCSV(template.headers, template.rows))}>
              {template.file}
            </Button>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">Ketentuan</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {template.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Kolom: <span className="font-mono">{template.headers.join(', ')}</span></p>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              load(e.dataTransfer.files?.[0])
            }}
            onClick={() => ref.current?.click()}
            className={cn('cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition', drag ? 'border-brand-500 bg-brand-50/50' : 'border-slate-300 hover:border-brand-300')}
          >
            <Upload className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">{file || '2. Pilih atau seret file CSV ke sini'}</p>
            {file && <p className="text-xs text-slate-500">{rowCount} baris data terbaca — klik untuk mengganti file</p>}
            <input
              ref={ref}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                load(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>

          {result && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700"><CheckCircle2 className="size-3.5" /> {result.docs.length} dokumen valid</span>
                {result.errors.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700"><AlertTriangle className="size-3.5" /> {result.errors.length} kesalahan (baris dilewati)</span>}
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-700 scrollbar-thin">
                  {result.errors.map((e, i) => <li key={i}><b>Baris {e.row}:</b> {e.message}</li>)}
                </ul>
              )}
              {result.docs.length > 0 && (
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
                  <table className="w-full">
                    <thead className="sticky top-0">
                      <tr>
                        <th className="th">Baris</th>
                        {columns.map((c) => <th key={c.label} className={cn('th', c.className)}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.docs.map((d) => (
                        <tr key={d.id}>
                          <td className="td text-xs text-slate-500">{result.rowsOf.get(d.id)?.join(', ')}</td>
                          {columns.map((c) => <td key={c.label} className={cn('td text-xs', c.className)}>{c.render(d)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
