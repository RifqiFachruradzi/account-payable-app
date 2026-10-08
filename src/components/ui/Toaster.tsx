import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/cn'

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 no-print">
      {toasts.map((t) => {
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info
        return (
          <div key={t.id} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ring-slate-900/10">
            <Icon className={cn('mt-0.5 size-5 shrink-0', t.type === 'success' ? 'text-emerald-500' : t.type === 'error' ? 'text-rose-500' : 'text-brand-500')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.message && <p className="mt-0.5 text-sm text-slate-500">{t.message}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
