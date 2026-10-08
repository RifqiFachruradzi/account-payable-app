const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export const formatIDR = (v: number) => idr.format(Math.round(v || 0))
export const formatNumber = (v: number) => num.format(v || 0)

/** Ringkas: 1,2 M / 350 jt / 12 rb */
export function formatCompact(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}Rp ${num.format(+(abs / 1e12).toFixed(2))} T`
  if (abs >= 1e9) return `${sign}Rp ${num.format(+(abs / 1e9).toFixed(2))} M`
  if (abs >= 1e6) return `${sign}Rp ${num.format(+(abs / 1e6).toFixed(1))} jt`
  if (abs >= 1e3) return `${sign}Rp ${num.format(+(abs / 1e3).toFixed(0))} rb`
  return `${sign}Rp ${num.format(abs)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function formatDate(iso?: string, long = false) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${String(d.getDate()).padStart(2, '0')} ${(long ? MONTHS_LONG : MONTHS)[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateTime(iso?: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${formatDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const monthLabel = (d: Date) => `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`

export function terbilang(n: number): string {
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  n = Math.floor(Math.abs(n))
  if (n < 12) return s[n]
  if (n < 20) return `${terbilang(n - 10)} belas`
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim()
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim()
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim()
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim()
  if (n < 1e6) return `${terbilang(Math.floor(n / 1000))} ribu ${terbilang(n % 1000)}`.trim()
  if (n < 1e9) return `${terbilang(Math.floor(n / 1e6))} juta ${terbilang(n % 1e6)}`.trim()
  if (n < 1e12) return `${terbilang(Math.floor(n / 1e9))} miliar ${terbilang(n % 1e9)}`.trim()
  return `${terbilang(Math.floor(n / 1e12))} triliun ${terbilang(n % 1e12)}`.trim()
}

export const terbilangRupiah = (n: number) => {
  const t = terbilang(n).replace(/\s+/g, ' ')
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)} rupiah` : 'Nol rupiah'
}
