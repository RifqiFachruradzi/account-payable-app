import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { AGING_BUCKETS, agingBucket, isOutstanding, outstandingAmount, type AgingBucket } from '@/lib/calc'
import { daysOverdue } from '@/lib/dates'
import { formatCompact, formatDate, formatIDR } from '@/lib/format'
import { exportCSV } from '@/lib/export'
import { Button, Card, PageHeader, SearchInput, StatusBadge, Tabs } from '@/components/ui'
import { AGING_COLORS } from '@/components/ap/charts'
import { cn } from '@/lib/cn'

type Filter = 'all' | 'overdue' | 'due7' | AgingBucket

export default function Outstanding() {
  const invoices = useStore((s) => s.invoices)
  const lk = useLookups()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter) ?? 'all'
  const [q, setQ] = useState('')
  const [view, setView] = useState<'invoice' | 'vendor'>('invoice')

  const out = useMemo(() => invoices.filter(isOutstanding), [invoices])

  const buckets = AGING_BUCKETS.map((b, i) => {
    const l = out.filter((x) => agingBucket(x.dueDate) === b)
    return { b, color: AGING_COLORS[i], count: l.length, amount: l.reduce((s, x) => s + outstandingAmount(x), 0) }
  })
  const total = buckets.reduce((s, b) => s + b.amount, 0)

  const list = useMemo(() => {
    const k = q.toLowerCase()
    return out
      .filter((i) => {
        const d = daysOverdue(i.dueDate)
        if (filter === 'overdue') return d > 0
        if (filter === 'due7') return d <= 0 && d >= -7
        if (filter !== 'all') return agingBucket(i.dueDate) === filter
        return true
      })
      .filter((i) => !k || `${i.number} ${i.vendorInvoiceNo} ${lk.vendor.get(i.vendorId)?.name} ${i.description}`.toLowerCase().includes(k))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [out, filter, q, lk])

  const byVendor = useMemo(() => {
    const m = new Map<string, Record<AgingBucket | 'total', number>>()
    list.forEach((i) => {
      const row = m.get(i.vendorId) ?? (Object.fromEntries([...AGING_BUCKETS, 'total'].map((b) => [b, 0])) as Record<AgingBucket | 'total', number>)
      const v = outstandingAmount(i)
      row[agingBucket(i.dueDate)] += v
      row.total += v
      m.set(i.vendorId, row)
    })
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [list])

  const setFilter = (f: Filter) => {
    if (f === 'all') params.delete('filter')
    else params.set('filter', f)
    setParams(params, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outstanding & Aging Hutang"
        description="Daftar tagihan yang belum dibayar beserta umur hutang berdasarkan tanggal jatuh tempo."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Outstanding' }]}
        actions={
          <Button
            variant="secondary"
            icon={Download}
            onClick={() =>
              exportCSV(
                'aging-hutang.csv',
                list.map((i) => ({
                  'No. Registrasi': i.number,
                  'No. Invoice': i.vendorInvoiceNo,
                  Vendor: lk.vendor.get(i.vendorId)?.name,
                  'Jatuh Tempo': i.dueDate,
                  'Hari Terlambat': Math.max(0, daysOverdue(i.dueDate)),
                  Umur: agingBucket(i.dueDate),
                  Outstanding: outstandingAmount(i),
                  Status: i.status,
                })),
              )
            }
          >
            Export CSV
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid divide-y divide-slate-100 sm:grid-cols-6 sm:divide-x sm:divide-y-0">
          <button onClick={() => setFilter('all')} className={cn('p-4 text-left hover:bg-slate-50', filter === 'all' && 'bg-brand-50/60')}>
            <p className="text-xs font-medium text-slate-500">Total Outstanding</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCompact(total)}</p>
            <p className="text-xs text-slate-500">{out.length} tagihan</p>
          </button>
          {buckets.map((b) => (
            <button key={b.b} onClick={() => setFilter(b.b)} className={cn('p-4 text-left hover:bg-slate-50', filter === b.b && 'bg-brand-50/60')}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><span className="size-2 rounded-full" style={{ background: b.color }} />{b.b}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCompact(b.amount)}</p>
              <p className="text-xs text-slate-500">{b.count} tagihan • {total ? Math.round((b.amount / total) * 100) : 0}%</p>
            </button>
          ))}
        </div>
        <div className="flex h-2">
          {buckets.map((b) => <div key={b.b} style={{ width: `${total ? (b.amount / total) * 100 : 0}%`, background: b.color }} className="border-r-2 border-white last:border-0" />)}
        </div>
      </div>

      <Card bodyClass="!p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <Tabs
            value={view}
            onChange={setView}
            tabs={[{ value: 'invoice', label: 'Per Tagihan', count: list.length }, { value: 'vendor', label: 'Ringkasan per Vendor', count: byVendor.length }]}
          />
          <div className="flex flex-wrap gap-1.5">
            {([['all', 'Semua'], ['overdue', 'Lewat jatuh tempo'], ['due7', 'Jatuh tempo ≤ 7 hari']] as [Filter, string][]).map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', filter === f ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                {l}
              </button>
            ))}
          </div>
          <SearchInput value={q} onChange={setQ} className="ml-auto w-full sm:w-72" placeholder="Cari tagihan / vendor…" />
        </div>
        <div className="overflow-x-auto">
          {view === 'invoice' ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">No. Tagihan</th>
                  <th className="th">Vendor</th>
                  <th className="th">Tgl Invoice</th>
                  <th className="th">Jatuh Tempo</th>
                  <th className="th">Umur</th>
                  <th className="th text-right">Outstanding</th>
                  <th className="th">Status Proses</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const d = daysOverdue(i.dueDate)
                  const b = agingBucket(i.dueDate)
                  return (
                    <tr key={i.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => nav(`/invoices/${i.id}`)}>
                      <td className="td">
                        <p className="font-mono text-xs text-brand-700">{i.number}</p>
                        <p className="font-medium text-slate-800">{i.vendorInvoiceNo}</p>
                      </td>
                      <td className="td max-w-64">
                        <p className="truncate text-slate-700">{lk.vendor.get(i.vendorId)?.name}</p>
                        <p className="truncate text-xs text-slate-500">{i.description}</p>
                      </td>
                      <td className="td whitespace-nowrap text-slate-600">{formatDate(i.invoiceDate)}</td>
                      <td className="td whitespace-nowrap">
                        <p>{formatDate(i.dueDate)}</p>
                        <p className={cn('text-xs font-medium', d > 0 ? 'text-rose-600' : d >= -7 ? 'text-amber-600' : 'text-slate-500')}>{d > 0 ? `Terlambat ${d} hari` : d === 0 ? 'Hari ini' : `${-d} hari lagi`}</p>
                      </td>
                      <td className="td"><StatusBadge status={b} /></td>
                      <td className="td num font-semibold">{formatIDR(outstandingAmount(i))}</td>
                      <td className="td"><StatusBadge status={i.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="td" colSpan={5}>Total</td>
                  <td className="td num">{formatIDR(list.reduce((s, i) => s + outstandingAmount(i), 0))}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Vendor</th>
                  {AGING_BUCKETS.map((b) => <th key={b} className="th text-right">{b}</th>)}
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.map(([vid, row]) => (
                  <tr key={vid} className="hover:bg-slate-50/70">
                    <td className="td font-medium"><Link to={`/vendors/${vid}`} className="hover:text-brand-700">{lk.vendor.get(vid)?.name}</Link></td>
                    {AGING_BUCKETS.map((b) => <td key={b} className={cn('td num', row[b] ? 'text-slate-800' : 'text-slate-300')}>{row[b] ? formatIDR(row[b]) : '—'}</td>)}
                    <td className="td num font-semibold">{formatIDR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="td">Total</td>
                  {AGING_BUCKETS.map((b) => <td key={b} className="td num">{formatIDR(byVendor.reduce((s, [, r]) => s + r[b], 0))}</td>)}
                  <td className="td num">{formatIDR(byVendor.reduce((s, [, r]) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
