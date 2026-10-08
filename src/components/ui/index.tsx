import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Inbox, Loader2, Search, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs',
  outline: 'bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-11 px-5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} /> : null}
      {children}
    </button>
  )
})

export type Tone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'cyan' | 'orange'
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
}
const DOT: Record<Tone, string> = {
  slate: 'bg-slate-400', blue: 'bg-brand-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500',
  rose: 'bg-rose-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500',
}

export function Badge({ tone = 'slate', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, Tone> = {
  Diterima: 'slate', Verifikasi: 'cyan', Terverifikasi: 'blue', Pengajuan: 'amber', Disetujui: 'violet', Dibayar: 'emerald', Ditolak: 'rose',
  'Menunggu Persetujuan': 'amber', Draft: 'slate', Menunggu: 'amber', Dilewati: 'slate',
  Berjalan: 'blue', Selesai: 'emerald', Ditutup: 'slate', Dibatalkan: 'rose',
  Open: 'blue', 'Partial Received': 'amber', Received: 'emerald', Closed: 'slate', Cancelled: 'rose',
  'Diproses PO': 'violet', Aktif: 'emerald', 'Non-Aktif': 'slate', Blacklist: 'rose',
  'Belum Jatuh Tempo': 'emerald', '1-30 Hari': 'amber', '31-60 Hari': 'orange', '61-90 Hari': 'rose', '> 90 Hari': 'rose',
}
export const statusTone = (s: string): Tone => STATUS_TONE[s] ?? 'slate'
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={statusTone(status)} dot>
    {status}
  </Badge>
)

export function Card({ title, subtitle, actions, children, className, bodyClass, icon: Icon }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: LucideIcon
}) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {Icon && (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(title || actions ? 'px-5 pb-5' : 'p-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, description, actions, breadcrumbs }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; to?: string }[]
}) {
  return (
    <div className="mb-6 no-print">
      {breadcrumbs && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-slate-400" />}
              {b.to ? <Link to={b.to} className="hover:text-brand-600">{b.label}</Link> : <span className="text-slate-700">{b.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'blue', trend, to }: {
  label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: Tone; trend?: { value: string; up?: boolean; good?: boolean }; to?: string
}) {
  const iconTone: Record<Tone, string> = {
    blue: 'bg-brand-50 text-brand-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600', cyan: 'bg-cyan-50 text-cyan-600', slate: 'bg-slate-100 text-slate-600', orange: 'bg-orange-50 text-orange-600',
  }
  const body = (
    <div className="card h-full p-4 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={cn('grid size-8 place-items-center rounded-lg', iconTone[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        {trend && (
          <span className={cn('font-medium', trend.good ? 'text-emerald-600' : 'text-rose-600')}>
            {trend.up ? '▲' : '▼'} {trend.value}
          </span>
        )}
        {hint}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

export function Field({ label, error, hint, children, required, className }: {
  label: string; error?: string | null; hint?: string; children: ReactNode; required?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center no-print">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5',
          size === 'sm' && 'max-w-md', size === 'md' && 'max-w-xl', size === 'lg' && 'max-w-3xl', size === 'xl' && 'max-w-5xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-thin border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition',
            value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 py-px text-[11px] tabular-nums', value === t.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, tone = 'blue', className }: { value: number; tone?: 'blue' | 'emerald' | 'amber' | 'rose'; className?: string }) {
  const c = { blue: 'bg-brand-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cn('h-full rounded-full transition-all', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Cari…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function DescList({ items, cols = 2 }: { items: { label: string; value: ReactNode; full?: boolean }[]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4')}>
      {items.map((it, i) => (
        <div key={i} className={cn(it.full && 'sm:col-span-full')}>
          <dt className="text-xs text-slate-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-800 break-words">{it.value || '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Select<T extends string>({ value, onChange, options, className, placeholder }: {
  value: T | ''; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; placeholder?: string
}) {
  return (
    <select className={cn('input pr-8', className)} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
