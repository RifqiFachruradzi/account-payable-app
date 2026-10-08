import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import type { MatchCheck, MatchLevel } from '@/lib/calc'
import { matchSummary } from '@/lib/calc'
import { cn } from '@/lib/cn'

const ICON = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle, na: MinusCircle }
const COLOR = { ok: 'text-emerald-600', warn: 'text-amber-500', fail: 'text-rose-600', na: 'text-slate-400' }
export const MATCH_LABEL: Record<MatchLevel, string> = { ok: 'Sesuai (Match)', warn: 'Perlu Perhatian', fail: 'Tidak Sesuai', na: 'Belum dicek' }

export function MatchPanel({ checks }: { checks: MatchCheck[] }) {
  const sum = matchSummary(checks)
  const SumIcon = ICON[sum]
  return (
    <div>
      <div
        className={cn(
          'mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          sum === 'ok' && 'bg-emerald-50 text-emerald-700',
          sum === 'warn' && 'bg-amber-50 text-amber-800',
          sum === 'fail' && 'bg-rose-50 text-rose-700',
          sum === 'na' && 'bg-slate-50 text-slate-600',
        )}
      >
        <SumIcon className="size-4" /> Hasil 3-Way Matching: {MATCH_LABEL[sum]}
      </div>
      <ul className="divide-y divide-slate-100">
        {checks.map((c) => {
          const I = ICON[c.level]
          return (
            <li key={c.key} className="flex items-start gap-3 py-2.5">
              <I className={cn('mt-0.5 size-4 shrink-0', COLOR[c.level])} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{c.label}</p>
                <p className="text-xs text-slate-500">{c.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
