import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  FileSignature,
  FileText,
  Hourglass,
  LayoutDashboard,
  Menu,
  Receipt,
  ScanLine,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { cn } from '@/lib/cn'
import { Toaster } from '@/components/ui/Toaster'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

function useNav() {
  const { invoices, paymentRequests } = useStore()
  const me = useCurrentUser()
  const newInv = invoices.filter((i) => i.status === 'Diterima' || i.status === 'Verifikasi').length
  const myApprovals = paymentRequests.filter((p) => p.status === 'Menunggu Persetujuan' && p.steps.find((s) => s.status === 'Menunggu')?.role === me.role).length
  const toPay = paymentRequests.filter((p) => p.status === 'Disetujui').length
  return [
    { group: 'Ringkasan', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      group: 'Tagihan Vendor',
      items: [
        { to: '/scan', label: 'Scan Tagihan (OCR)', icon: ScanLine },
        { to: '/invoices', label: 'Tagihan Masuk', icon: Receipt, badge: newInv },
        { to: '/outstanding', label: 'Outstanding & Aging', icon: Hourglass },
      ],
    },
    {
      group: 'Dokumen Internal',
      items: [
        { to: '/spk', label: 'Surat Perintah Kerja', icon: FileSignature },
        { to: '/procurement', label: 'PR & PO', icon: ClipboardList },
      ],
    },
    {
      group: 'Pembayaran',
      items: [
        { to: '/payment-requests', label: 'Pengajuan Pembayaran', icon: FileText },
        { to: '/approvals', label: 'Persetujuan Saya', icon: ShieldCheck, badge: myApprovals },
        { to: '/payments', label: 'Realisasi Pembayaran', icon: Banknote, badge: toPay },
      ],
    },
    { group: 'Master Data', items: [{ to: '/vendors', label: 'Vendor', icon: Building2 }, { to: '/settings', label: 'Pengaturan', icon: Settings }] },
  ] as { group: string; items: NavItem[] }[]
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  const settings = useStore((s) => s.settings)
  return (
    <div className="flex h-full flex-col bg-ink-950 text-slate-300">
      <Link to="/" className="flex items-center gap-3 px-5 py-5" onClick={onNavigate}>
        <img src="/favicon.svg" alt="" className="size-9" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-white">AP Hub</p>
          <p className="text-[11px] text-slate-400">Account Payable System</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 scrollbar-thin">
        {nav.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                        isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    <it.icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {!!it.badge && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900 tabular-nums">{it.badge}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/5 px-5 py-4">
        <p className="truncate text-xs font-medium text-slate-300">{settings.companyName}</p>
        <p className="font-mono text-[11px] text-slate-500">NPWP {settings.companyNpwp}</p>
      </div>
    </div>
  )
}

function UserMenu() {
  const me = useCurrentUser()
  const users = useStore((s) => s.users)
  const setUser = useStore((s) => s.setCurrentUser)
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-semibold text-white">{me.initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-800">{me.name}</span>
          <span className="block text-[11px] text-slate-500">{me.role}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-900/10">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Masuk sebagai (simulasi PIC)</p>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setUser(u.id)
                  setOpen(false)
                }}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50', u.id === me.id && 'bg-brand-50')}
              >
                <span className="grid size-7 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">{u.initials}</span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium text-slate-800">{u.name}</span>
                  <span className="block text-[11px] text-slate-500">{u.title}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Notifications() {
  const me = useCurrentUser()
  const { paymentRequests, invoices, vendors } = useStore()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const items = useMemo(() => {
    const list: { title: string; sub: string; to: string }[] = []
    paymentRequests
      .filter((p) => p.status === 'Menunggu Persetujuan' && p.steps.find((s) => s.status === 'Menunggu')?.role === me.role)
      .forEach((p) => list.push({ title: `Persetujuan dibutuhkan: ${p.number}`, sub: vendors.find((v) => v.id === p.vendorId)?.name ?? '', to: `/payment-requests/${p.id}` }))
    invoices
      .filter((i) => i.status === 'Diterima')
      .forEach((i) => list.push({ title: `Tagihan baru: ${i.vendorInvoiceNo}`, sub: vendors.find((v) => v.id === i.vendorId)?.name ?? '', to: `/invoices/${i.id}` }))
    return list
  }, [paymentRequests, invoices, vendors, me.role])
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifikasi">
        <Bell className="size-5" />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl bg-white shadow-xl ring-1 ring-slate-900/10">
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Notifikasi ({items.length})</p>
            <ul className="max-h-80 overflow-y-auto scrollbar-thin">
              {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada notifikasi</li>}
              {items.map((n, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      setOpen(false)
                      nav(n.to)
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.sub}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block no-print">
        <Sidebar />
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobile(false)} />
          <div className="relative h-full w-64">
            <Sidebar onNavigate={() => setMobile(false)} />
            <button onClick={() => setMobile(false)} className="absolute -right-10 top-4 text-white" aria-label="Tutup menu">
              <X className="size-6" />
            </button>
          </div>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 no-print">
          <button onClick={() => setMobile(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <div className="hidden text-sm text-slate-500 md:block">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex-1" />
          <Link to="/scan" className="hidden items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 sm:flex">
            <ScanLine className="size-4" /> Scan Tagihan
          </Link>
          <Notifications />
          <div className="h-6 w-px bg-slate-200" />
          <UserMenu />
        </header>
        <main key={loc.pathname} className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
