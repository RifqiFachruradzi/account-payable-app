import { Check, Clock, X } from 'lucide-react'
import type { ApprovalStep } from '@/types'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

/** Indikator ringkas progres otorisasi (titik per tahap) */
export function ApprovalDots({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <span
            title={`${s.label} — ${s.role}: ${s.status}`}
            className={cn(
              'grid size-5 place-items-center rounded-full text-[10px] font-semibold',
              s.status === 'Disetujui' && 'bg-emerald-500 text-white',
              s.status === 'Ditolak' && 'bg-rose-500 text-white',
              s.status === 'Menunggu' && 'bg-slate-100 text-slate-400 ring-1 ring-slate-200',
            )}
          >
            {s.status === 'Disetujui' ? <Check className="size-3" /> : s.status === 'Ditolak' ? <X className="size-3" /> : i + 1}
          </span>
          {i < steps.length - 1 && <span className={cn('h-px w-2.5', s.status === 'Disetujui' ? 'bg-emerald-400' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  )
}

/** Timeline vertikal otorisasi */
export function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
  const nextIdx = steps.findIndex((s) => s.status === 'Menunggu')
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const current = i === nextIdx && !steps.some((x) => x.status === 'Ditolak')
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={cn('absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5', s.status === 'Disetujui' ? 'bg-emerald-300' : 'bg-slate-200')} />}
            <span
              className={cn(
                'relative z-10 grid size-8 shrink-0 place-items-center rounded-full',
                s.status === 'Disetujui' && 'bg-emerald-500 text-white',
                s.status === 'Ditolak' && 'bg-rose-500 text-white',
                s.status === 'Menunggu' && (current ? 'bg-amber-100 text-amber-600 ring-4 ring-amber-50' : 'bg-slate-100 text-slate-400'),
              )}
            >
              {s.status === 'Disetujui' ? <Check className="size-4" /> : s.status === 'Ditolak' ? <X className="size-4" /> : <Clock className="size-4" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-slate-800">{s.label} <span className="font-normal text-slate-500">— {s.role}</span></p>
              {s.userName ? (
                <p className="text-xs text-slate-500">{s.userName} • {formatDateTime(s.signedAt)}</p>
              ) : (
                <p className={cn('text-xs', current ? 'font-medium text-amber-700' : 'text-slate-400')}>{current ? 'Menunggu tanda tangan' : 'Belum sampai tahap ini'}</p>
              )}
              {s.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">“{s.note}”</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
