import { parseDate } from './ocr'

/** Parser CSV: auto-deteksi pemisah ; atau , — mendukung tanda kutip & baris baru dalam kutip */
export function parseCSV(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = src.split('\n')[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim()))
  if (!nonEmpty.length) return []
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])))
}

/** Angka format Indonesia/Inggris: "1.500.000", "1,500,000", "1500000", "2,5", "Rp 3.000,00" */
export function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  let s = v.replace(/rp\.?|idr|\s|%/gi, '')
  if (!s) return undefined
  const dots = (s.match(/\./g) ?? []).length
  const commas = (s.match(/,/g) ?? []).length
  if (dots && commas) {
    // pemisah desimal = yang muncul terakhir
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (dots > 1 || (dots === 1 && /\.\d{3}$/.test(s))) s = s.replace(/\./g, '')
  else if (commas > 1 || (commas === 1 && /,\d{3}$/.test(s))) s = s.replace(/,/g, '')
  else if (commas === 1) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export const parseCsvDate = (v: string | undefined) => (v ? parseDate(v) : undefined)

export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function toCSV(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\n')
}
