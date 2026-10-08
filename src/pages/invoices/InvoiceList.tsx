import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileInput, Mail, Paperclip, PencilLine, Receipt, ScanLine } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLookups } from '@/lib/hooks'
import { formatDate, formatIDR } from '@/lib/format'
import { daysOverdue } from '@/lib/dates'
import { exportCSV } from '@/lib/export'
import { Button, EmptyState, PageHeader, SearchInput, Select, StatusBadge, Tabs } from '@/components/ui'
import type { InvoiceStatus } from '@/types'
import { cn } from '@/lib/cn'

const STATUSES: (InvoiceStatus | 'Semua')[] = ['Semua', 'Diterima', 'Verifikasi', 'Terverifikasi', 'Pengajuan', 'Disetujui', 'Dibayar', 'Ditolak']
const SOURCE_ICON = { 'Scan OCR': ScanLine, 'E-Mail': Mail, Manual: PencilLine }

export default function InvoiceList() {
  const invoices = useStore((s) => s.invoices)
  const vendors = useStore((s) => s.vendors)
  const lk = useLookups()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as InvoiceStatus | null) ?? 'Semua'
  const [q, setQ] = useState('')
  const [vendor, setVendor] = useState('')

  const filtered = useMemo(() => {
    const k = q.toLowerCase()
    return invoices
      .filter((i) => status === 'Semua' || i.status === status)
      .filter((i) => !vendor || i.vendorId === vendor)
      .filter((i) => {
        if (!k) return true
        const v = lk.vendor.get(i.vendorId)
        return [i.number, i.vendorInvoiceNo, i.description, v?.name, lk.spk.get(i.spkId ?? '')?.number, lk.po.get(i.poId ?? '')?.number]
          .join(' ')
          .toLowerCase()
          .includes(k)
      })
      .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  }, [invoices, status, vendor, q, lk])

  const counts = useMemo(() => {
    const c: Record<string, number> = { Semua: invoices.length }
    invoices.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1))
    return c
  }, [invoices])

  const totals = filtered.reduce((s, i) => ({ dpp: s.dpp + i.dpp, ppn: s.ppn + i.ppn, pph: s.pph + i.pph, net: s.net + i.netPayable }), { dpp: 0, ppn: 0, pph: 0, net: 0 })

  const doExport = () =>
    exportCSV(
      'tagihan-vendor.csv',
      filtered.map((i) => ({
        'No. Registrasi': i.number,
        'No. Tagihan Vendor': i.vendorInvoiceNo,
        Vendor: lk.vendor.get(i.vendorId)?.name,
        NPWP: lk.vendor.get(i.vendorId)?.npwp,
        'No. SPK': lk.spk.get(i.spkId ?? '')?.number,
        'No. PO': lk.po.get(i.poId ?? '')?.number,
        'Tgl Tagihan': i.invoiceDate,
        'Tgl Diterima': i.receivedDate,
        'Jatuh Tempo': i.dueDate,
        DPP: i.dpp,
        PPN: i.ppn,
        PPh: i.pph,
        Netto: i.netPayable,
        Status: i.status,
        Sumber: i.source,
      })),
    )

  return (
    <div>
      <PageHeader
        title="Tagihan Masuk"
        description="Register seluruh tagihan vendor yang diterima beserta status verifikasi dan pembayarannya."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Tagihan Masuk' }]}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={doExport}>Export CSV</Button>
            <Button variant="secondary" icon={FileInput} onClick={() => nav('/scan?mode=manual')}>Input Manual</Button>
            <Button icon={ScanLine} onClick={() => nav('/scan')}>Scan Tagihan</Button>
          </>
        }
      />

      <div className="card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={STATUSES.map((s) => ({ value: s, label: s, count: counts[s] ?? 0 }))}
            value={status}
            onChange={(v) => {
              if (v === 'Semua') params.delete('status')
              else params.set('status', v)
              setParams(params, { replace: true })
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Cari no. tagihan, vendor, SPK, PO…" className="w-full sm:w-80" />
          <Select
            value={vendor}
            onChange={setVendor}
            placeholder="Semua vendor"
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            className="w-full sm:w-64"
          />
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} tagihan • Netto <b className="text-slate-800">{formatIDR(totals.net)}</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No. Registrasi / Tagihan</th>
                <th className="th">Vendor</th>
                <th className="th">Rujukan</th>
                <th className="th">Diterima</th>
                <th className="th">Jatuh Tempo</th>
                <th className="th text-right">DPP</th>
                <th className="th text-right">PPN</th>
                <th className="th text-right">PPh</th>
                <th className="th text-right">Netto Dibayar</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const SI = SOURCE_ICON[i.source]
                const od = daysOverdue(i.dueDate)
                const open = i.status !== 'Dibayar' && i.status !== 'Ditolak'
                return (
                  <tr key={i.id} onClick={() => nav(`/invoices/${i.id}`)} className="cursor-pointer hover:bg-slate-50/70">
                    <td className="td">
                      <p className="font-mono text-xs text-brand-700">{i.number}</p>
                      <p className="flex items-center gap-1.5 font-medium text-slate-800">
                        {i.vendorInvoiceNo}
                        <SI className="size-3.5 text-slate-400" aria-label={i.source} />
                        {(i.attachments?.length || i.attachmentName) && <Paperclip className="size-3.5 text-slate-400" />}
                      </p>
                    </td>
                    <td className="td max-w-56">
                      <p className="truncate font-medium text-slate-700">{lk.vendor.get(i.vendorId)?.name}</p>
                      <p className="truncate text-xs text-slate-500">{i.description}</p>
                    </td>
                    <td className="td whitespace-nowrap font-mono text-xs text-slate-600">
                      {i.spkId && <p>{lk.spk.get(i.spkId)?.number}</p>}
                      {i.poId && <p className="text-slate-400">{lk.po.get(i.poId)?.number}</p>}
                      {!i.spkId && !i.poId && <span className="text-rose-500">Belum dirujuk</span>}
                    </td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDate(i.receivedDate)}</td>
                    <td className="td whitespace-nowrap">
                      <p className="text-slate-700">{formatDate(i.dueDate)}</p>
                      {open && od > 0 && <p className="text-xs font-medium text-rose-600">+{od} hari</p>}
                    </td>
                    <td className="td num">{formatIDR(i.dpp)}</td>
                    <td className="td num text-slate-500">{formatIDR(i.ppn)}</td>
                    <td className="td num text-slate-500">({formatIDR(i.pph)})</td>
                    <td className={cn('td num font-semibold', i.status === 'Dibayar' ? 'text-emerald-700' : 'text-slate-900')}>{formatIDR(i.netPayable)}</td>
                    <td className="td"><StatusBadge status={i.status} /></td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="td" colSpan={5}>Total ({filtered.length} tagihan)</td>
                  <td className="td num">{formatIDR(totals.dpp)}</td>
                  <td className="td num">{formatIDR(totals.ppn)}</td>
                  <td className="td num">({formatIDR(totals.pph)})</td>
                  <td className="td num">{formatIDR(totals.net)}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={Receipt} title="Tidak ada tagihan" description="Ubah filter atau scan tagihan baru." action={<Link to="/scan"><Button icon={ScanLine}>Scan Tagihan</Button></Link>} />
          )}
        </div>
      </div>
    </div>
  )
}
