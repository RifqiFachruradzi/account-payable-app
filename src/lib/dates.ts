const DAY = 86400000

export const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
export const toISODate = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
export const addDays = (iso: string | Date, n: number) => {
  const d = typeof iso === 'string' ? new Date(iso) : new Date(iso)
  return toISODate(new Date(d.getTime() + n * DAY))
}
export const daysAgo = (n: number) => addDays(today(), -n)
export const daysFromNow = (n: number) => addDays(today(), n)
export const diffDays = (a: string | Date, b: string | Date) => {
  const x = new Date(typeof a === 'string' ? a : a.getTime())
  const y = new Date(typeof b === 'string' ? b : b.getTime())
  x.setHours(0, 0, 0, 0)
  y.setHours(0, 0, 0, 0)
  return Math.round((x.getTime() - y.getTime()) / DAY)
}
/** Hari lewat jatuh tempo (positif = overdue) */
export const daysOverdue = (dueDate: string) => diffDays(today(), dueDate)
export const nowISO = () => new Date().toISOString()
