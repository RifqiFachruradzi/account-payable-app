import type { ReactNode } from 'react'
import { formatCompact, formatIDR } from '@/lib/format'

/** Palet kategorikal tervalidasi (urutan tetap) */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
/** Ramp sekuensial untuk tingkat keterlambatan (satu hue terang → gelap) */
export const AGING_COLORS = ['#94a3b8', '#fbbf24', '#f59e0b', '#ea580c', '#b91c1c']

export const axisProps = {
  tick: { fill: '#64748b', fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const

export const yMoney = (v: number) => formatCompact(v).replace('Rp ', '')

export function ChartTooltip({
  active,
  payload,
  label,
  extra,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string; payload: Record<string, unknown> }[]
  label?: ReactNode
  extra?: (p: Record<string, unknown>) => ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-44 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-900/10">
      {label && <p className="mb-1.5 font-semibold text-slate-800">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="size-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-slate-800">{formatIDR(p.value)}</span>
        </div>
      ))}
      {extra && <div className="mt-1 border-t border-slate-100 pt-1 text-slate-500">{extra(payload[0].payload)}</div>}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
