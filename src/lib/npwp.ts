/**
 * NPWP lama: 15 digit -> 00.000.000.0-000.000
 * NPWP baru (NIK/16 digit, berlaku sejak 2024) -> 0000 0000 0000 0000
 */
export const npwpDigits = (v: string) => (v || '').replace(/\D/g, '')

export function formatNPWP(v: string) {
  const d = npwpDigits(v)
  if (d.length === 16) return d.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4')
  if (d.length === 15)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d)(\d{3})(\d{3})/, '$1.$2.$3.$4-$5.$6')
  return v
}

export function validateNPWP(v: string): string | null {
  const d = npwpDigits(v)
  if (!d) return 'NPWP wajib diisi'
  if (d.length !== 15 && d.length !== 16) return 'NPWP harus 15 digit (format lama) atau 16 digit (format baru)'
  if (/^0+$/.test(d)) return 'NPWP tidak valid'
  return null
}

export const sameNPWP = (a?: string, b?: string) => {
  const x = npwpDigits(a || '')
  const y = npwpDigits(b || '')
  if (!x || !y) return false
  // 16-digit format = '0' + 15-digit lama untuk badan
  return x === y || x === `0${y}` || `0${x}` === y
}
