import { Link } from 'react-router-dom'
import { Banknote, ClipboardCheck, FileSignature, FileText, Receipt, ShoppingCart, Stamp, type LucideIcon } from 'lucide-react'
import type { Invoice } from '@/types'
import { useStore } from '@/store/useStore'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'

interface Node {
  key: string
  label: string
  icon: LucideIcon
  number?: string
  date?: string
  status?: string
  to?: string
}

/** Alur dokumen: PR → PO → SPK → BAST/GR → Tagihan → Pengajuan → Pembayaran */
export function DocumentTrail({ invoice }: { invoice: Invoice }) {
  const { prs, pos, spks, grs, paymentRequests, payments } = useStore()
  const pr = prs.find((p) => p.id === invoice.prId)
  const po = pos.find((p) => p.id === invoice.poId)
  const spk = spks.find((s) => s.id === invoice.spkId)
  const gr = grs.find((g) => g.id === invoice.grId)
  const prq = [...paymentRequests].reverse().find((p) => p.invoiceIds.includes(invoice.id))
  const pay = prq && payments.find((p) => p.paymentRequestId === prq.id)

  const nodes: Node[] = [
    { key: 'pr', label: 'Purchase Requisition', icon: ClipboardCheck, number: pr?.number, date: pr?.date, status: pr?.status, to: '/procurement?tab=pr' },
    { key: 'po', label: 'Purchase Order', icon: ShoppingCart, number: po?.number, date: po?.date, status: po?.status, to: '/procurement?tab=po' },
    ...(spk || !po ? [{ key: 'spk', label: 'Surat Perintah Kerja', icon: FileSignature, number: spk?.number, date: spk?.startDate, status: spk?.status, to: spk ? `/spk/${spk.id}` : undefined }] : []),
    { key: 'gr', label: spk ? 'BAST' : 'Goods Receipt', icon: Stamp, number: gr?.number, date: gr?.date },
    { key: 'inv', label: 'Tagihan Vendor', icon: Receipt, number: invoice.vendorInvoiceNo, date: invoice.invoiceDate, status: invoice.status },
    { key: 'prq', label: 'Pengajuan Pembayaran', icon: FileText, number: prq?.number, date: prq?.date, status: prq?.status, to: prq ? `/payment-requests/${prq.id}` : undefined },
    { key: 'pay', label: 'Pembayaran', icon: Banknote, number: pay?.number, date: pay?.date, status: pay ? 'Dibayar' : undefined, to: pay ? '/payments' : undefined },
  ]

  return (
    <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {nodes.map((n, i) => {
        const done = !!n.number
        const inner = (
          <div className={cn('relative h-full rounded-xl border p-3 transition', done ? 'border-brand-200 bg-brand-50/40 hover:border-brand-300' : 'border-dashed border-slate-200 bg-slate-50/50')}>
            <div className="flex items-center gap-2">
              <span className={cn('grid size-7 place-items-center rounded-lg', done ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400')}>
                <n.icon className="size-3.5" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Langkah {i + 1}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-700">{n.label}</p>
            <p className={cn('mt-0.5 truncate font-mono text-[11px]', done ? 'text-brand-700' : 'text-slate-400')}>{n.number ?? 'Belum ada'}</p>
            {n.date && <p className="text-[11px] text-slate-500">{formatDate(n.date)}</p>}
          </div>
        )
        return <li key={n.key}>{n.to && done ? <Link to={n.to}>{inner}</Link> : inner}</li>
      })}
    </ol>
  )
}
