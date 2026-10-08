import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Attachment,
  AppUser,
  CompanySettings,
  GoodsReceipt,
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentRequest,
  PurchaseOrder,
  PurchaseRequisition,
  SPK,
  Vendor,
} from '@/types'
import * as seed from '@/data/seed'
import { uid } from '@/lib/id'
import { nowISO, toISODate } from '@/lib/dates'
import { buildApprovalSteps } from '@/lib/calc'
import { clearFiles } from '@/lib/attachmentStore'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
}

interface Data {
  version: number
  currentUserId: string
  users: AppUser[]
  settings: CompanySettings
  vendors: Vendor[]
  prs: PurchaseRequisition[]
  pos: PurchaseOrder[]
  spks: SPK[]
  grs: GoodsReceipt[]
  invoices: Invoice[]
  paymentRequests: PaymentRequest[]
  payments: Payment[]
}

interface Actions {
  toasts: Toast[]
  notify: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  setCurrentUser: (id: string) => void
  // vendor
  saveVendor: (v: Vendor) => void
  deleteVendor: (id: string) => boolean
  // invoice
  addInvoice: (inv: Omit<Invoice, 'id' | 'number' | 'history' | 'paidAmount'>, note?: string) => Invoice
  updateInvoice: (id: string, patch: Partial<Invoice>, action?: string) => void
  setInvoiceStatus: (id: string, status: InvoiceStatus, action: string, note?: string) => void
  addAttachment: (invoiceId: string, att: Attachment) => void
  removeAttachment: (invoiceId: string, attId: string) => void
  // dokumen internal
  updateSpk: (id: string, patch: Partial<SPK>) => void
  saveSpk: (spk: SPK) => void
  savePR: (pr: PurchaseRequisition) => void
  updatePR: (id: string, patch: Partial<PurchaseRequisition>) => void
  savePO: (po: PurchaseOrder) => void
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  importDocs: (docs: { prs?: PurchaseRequisition[]; pos?: PurchaseOrder[]; spks?: SPK[] }) => void
  // payment request
  createPaymentRequest: (
    data: Omit<PaymentRequest, 'id' | 'number' | 'steps' | 'status' | 'createdBy' | 'amount' | 'pphAmount' | 'netAmount'>,
    signature: string,
  ) => PaymentRequest
  signPaymentRequest: (id: string, signature: string, note?: string) => void
  rejectPaymentRequest: (id: string, note: string) => void
  recordPayment: (prqId: string, data: Pick<Payment, 'date' | 'bankReference' | 'sourceAccount'>) => Payment | undefined
  updateSettings: (s: Partial<CompanySettings>) => void
  resetData: () => void
}

export type Store = Data & Actions

const initialData = (): Data => ({
  version: seed.SEED_VERSION,
  currentUserId: 'u1',
  users: seed.USERS,
  settings: seed.SETTINGS,
  vendors: seed.VENDORS,
  prs: seed.PRS,
  pos: seed.POS,
  spks: seed.SPKS,
  grs: seed.GRS,
  invoices: seed.INVOICES,
  paymentRequests: seed.PAYMENT_REQUESTS,
  payments: seed.PAYMENTS,
})

const nextNumber = (prefix: string, existing: string[]) => {
  const year = new Date().getFullYear()
  const max = existing
    .filter((n) => n.startsWith(`${prefix}/${year}/`))
    .map((n) => parseInt(n.split('/').pop() || '0', 10))
    .reduce((a, b) => Math.max(a, b), 0)
  return { year, n: max + 1 }
}

const upsert = <T extends { id: string }>(arr: T[], item: T) =>
  arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item]

/** Nomor dokumen berikutnya, mis. PR/2026/GEN/0015, PO/2026/00012, SPK/2026/NMS/009 */
export function nextDocNumber(kind: 'PR' | 'PO' | 'SPK', existing: string[], opts: { dept?: string; offset?: number } = {}) {
  const { year, n } = nextNumber(kind, existing)
  const k = n + (opts.offset ?? 0)
  if (kind === 'PR') return `PR/${year}/${(opts.dept || 'GEN').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')}/${String(k).padStart(4, '0')}`
  if (kind === 'PO') return `PO/${year}/${String(k).padStart(5, '0')}`
  return `SPK/${year}/NMS/${String(k).padStart(3, '0')}`
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const me = () => get().users.find((u) => u.id === get().currentUserId)!
      const pushHistory = (inv: Invoice, action: string, note?: string): Invoice => ({
        ...inv,
        history: [...inv.history, { at: nowISO(), by: me().name, action, note }],
      })

      return {
        ...initialData(),
        toasts: [],
        notify: (t) => {
          const id = uid('t')
          set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
          setTimeout(() => get().dismissToast(id), 4200)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        setCurrentUser: (id) => set({ currentUserId: id }),

        saveVendor: (v) =>
          set((s) => ({
            vendors: s.vendors.some((x) => x.id === v.id) ? s.vendors.map((x) => (x.id === v.id ? v : x)) : [...s.vendors, v],
          })),
        deleteVendor: (id) => {
          const used = get().invoices.some((i) => i.vendorId === id) || get().spks.some((s) => s.vendorId === id) || get().pos.some((p) => p.vendorId === id)
          if (used) return false
          set((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) }))
          return true
        },

        addInvoice: (data, note) => {
          const { year, n } = nextNumber('AP', get().invoices.map((i) => i.number))
          const inv: Invoice = {
            ...data,
            id: uid('inv'),
            number: `AP/${year}/${String(n).padStart(5, '0')}`,
            paidAmount: 0,
            history: [{ at: nowISO(), by: me().name, action: `Tagihan diterima & diregistrasi (${data.source})`, note }],
          }
          set((s) => ({ invoices: [...s.invoices, inv] }))
          return inv
        },
        updateInvoice: (id, patch, action) =>
          set((s) => ({
            invoices: s.invoices.map((i) => (i.id === id ? (action ? pushHistory({ ...i, ...patch }, action) : { ...i, ...patch }) : i)),
          })),
        setInvoiceStatus: (id, status, action, note) =>
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? pushHistory({ ...i, status }, action, note) : i)) })),

        addAttachment: (invoiceId, att) =>
          set((s) => ({
            invoices: s.invoices.map((i) =>
              i.id === invoiceId ? pushHistory({ ...i, attachments: [...(i.attachments ?? []), att] }, `Lampiran ${att.category} ditambahkan`, att.name) : i,
            ),
          })),
        removeAttachment: (invoiceId, attId) =>
          set((s) => ({
            invoices: s.invoices.map((i) => {
              if (i.id !== invoiceId) return i
              const att = i.attachments?.find((a) => a.id === attId)
              return pushHistory({ ...i, attachments: (i.attachments ?? []).filter((a) => a.id !== attId) }, `Lampiran ${att?.category ?? ''} dihapus`, att?.name)
            }),
          })),

        updateSpk: (id, patch) => set((s) => ({ spks: s.spks.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
        saveSpk: (spk) => set((s) => ({ spks: upsert(s.spks, spk) })),
        savePR: (pr) => set((s) => ({ prs: upsert(s.prs, pr) })),
        updatePR: (id, patch) => set((s) => ({ prs: s.prs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
        savePO: (po) =>
          set((s) => ({
            pos: upsert(s.pos, po),
            // PR yang dirujuk PO berpindah status menjadi Diproses PO
            prs: s.prs.map((r) => (r.id === po.prId && r.status === 'Disetujui' && po.status !== 'Cancelled' ? { ...r, status: 'Diproses PO' } : r)),
          })),
        updatePO: (id, patch) => set((s) => ({ pos: s.pos.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
        importDocs: ({ prs = [], pos = [], spks = [] }) =>
          set((s) => {
            const linkedPr = new Set(pos.map((p) => p.prId).filter(Boolean))
            return {
              prs: [...s.prs.map((r) => (linkedPr.has(r.id) && r.status === 'Disetujui' ? { ...r, status: 'Diproses PO' as const } : r)), ...prs],
              pos: [...s.pos, ...pos],
              spks: [...s.spks, ...spks],
            }
          }),

        createPaymentRequest: (data, signature) => {
          const invs = get().invoices.filter((i) => data.invoiceIds.includes(i.id))
          const amount = invs.reduce((a, i) => a + i.total, 0)
          const pphAmount = invs.reduce((a, i) => a + i.pph, 0)
          const user = me()
          const steps = buildApprovalSteps(amount, get().settings.approvalMatrix, user)
          steps[0].signature = signature
          const { year, n } = nextNumber('PP', get().paymentRequests.map((p) => p.number))
          const prq: PaymentRequest = {
            ...data,
            id: uid('prq'),
            number: `PP/${year}/${String(n).padStart(4, '0')}`,
            amount,
            pphAmount,
            netAmount: amount - pphAmount,
            steps,
            status: steps.every((st) => st.status === 'Disetujui') ? 'Disetujui' : 'Menunggu Persetujuan',
            createdBy: user.name,
          }
          set((s) => ({
            paymentRequests: [...s.paymentRequests, prq],
            invoices: s.invoices.map((i) => (data.invoiceIds.includes(i.id) ? pushHistory({ ...i, status: 'Pengajuan' }, `Diajukan dalam ${prq.number}`) : i)),
          }))
          return prq
        },
        signPaymentRequest: (id, signature, note) => {
          const user = me()
          set((s) => {
            let approvedAll = false
            let number = ''
            const paymentRequests = s.paymentRequests.map((p) => {
              if (p.id !== id) return p
              number = p.number
              const idx = p.steps.findIndex((st) => st.status === 'Menunggu')
              if (idx < 0 || p.steps[idx].role !== user.role) return p
              const steps = p.steps.map((st, i) =>
                i === idx ? { ...st, status: 'Disetujui' as const, userId: user.id, userName: user.name, signedAt: nowISO(), signature, note } : st,
              )
              approvedAll = steps.every((st) => st.status === 'Disetujui')
              return { ...p, steps, status: approvedAll ? ('Disetujui' as const) : p.status }
            })
            const prq = paymentRequests.find((p) => p.id === id)!
            const invoices = s.invoices.map((i) =>
              prq.invoiceIds.includes(i.id)
                ? pushHistory(
                    approvedAll ? { ...i, status: 'Disetujui' } : i,
                    approvedAll ? `${number} disetujui penuh — siap dibayar` : `${number} ditandatangani (${user.role})`,
                    note,
                  )
                : i,
            )
            return { paymentRequests, invoices }
          })
        },
        rejectPaymentRequest: (id, note) => {
          const user = me()
          set((s) => {
            const prq = s.paymentRequests.find((p) => p.id === id)!
            const idx = prq.steps.findIndex((st) => st.status === 'Menunggu')
            const steps = prq.steps.map((st, i) =>
              i === idx ? { ...st, status: 'Ditolak' as const, userId: user.id, userName: user.name, signedAt: nowISO(), note } : st,
            )
            return {
              paymentRequests: s.paymentRequests.map((p) => (p.id === id ? { ...p, steps, status: 'Ditolak' } : p)),
              invoices: s.invoices.map((i) =>
                prq.invoiceIds.includes(i.id) ? pushHistory({ ...i, status: 'Terverifikasi' }, `${prq.number} ditolak oleh ${user.role}`, note) : i,
              ),
            }
          })
        },
        recordPayment: (prqId, data) => {
          const prq = get().paymentRequests.find((p) => p.id === prqId)
          if (!prq || prq.status !== 'Disetujui') return undefined
          const { year, n } = nextNumber('BKK', get().payments.map((p) => p.number))
          const pay: Payment = {
            id: uid('pay'),
            number: `BKK/${year}/${String(n).padStart(4, '0')}`,
            paymentRequestId: prqId,
            vendorId: prq.vendorId,
            method: prq.paymentMethod,
            amount: prq.netAmount,
            paidBy: me().name,
            ...data,
          }
          set((s) => ({
            payments: [...s.payments, pay],
            paymentRequests: s.paymentRequests.map((p) => (p.id === prqId ? { ...p, status: 'Dibayar' } : p)),
            invoices: s.invoices.map((i) =>
              prq.invoiceIds.includes(i.id)
                ? pushHistory({ ...i, status: 'Dibayar', paidAmount: i.netPayable }, `Pembayaran ${pay.number} tanggal ${data.date}`, `Ref. bank ${data.bankReference}`)
                : i,
            ),
          }))
          return pay
        },
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        resetData: () => {
          clearFiles().catch(() => undefined)
          set({ ...initialData() })
        },
      }
    },
    {
      name: 'ap-hub-store',
      version: seed.SEED_VERSION,
      partialize: ({ toasts: _t, ...rest }) => {
        void _t
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as unknown as Data
      },
      migrate: (persisted, version) => {
        // v3 → v4: dokumen PR/PO/SPK mendapat jejak persetujuan; data pengguna dipertahankan
        if (version === 3 && persisted) {
          const d = persisted as Data
          const legacy = (name: string, title: string, at: string) => ({ name, title, at, signature: seed.demoSignature(name), note: 'Data sebelum fitur persetujuan' })
          return {
            ...d,
            version: 4,
            prs: d.prs.map((p) =>
              ['Disetujui', 'Diproses PO', 'Selesai'].includes(p.status) && !p.approval
                ? { ...p, submitted: legacy(p.requester, `User — ${p.department}`, p.date), approval: legacy(p.approvedBy ?? 'Dewi Kartika Sari', 'Finance Manager', p.date) }
                : p,
            ),
            pos: d.pos.map((o) => {
              if (o.companyApproval || o.status === 'Draft' || o.status === 'Cancelled') return o
              const v = d.vendors.find((x) => x.id === o.vendorId)
              return { ...o, companyApproval: legacy('Budi Santoso', 'Direktur Keuangan', o.date), vendorAcceptance: legacy(v?.contactPerson ?? 'Vendor', 'Perwakilan Vendor', o.date) }
            }),
            spks: d.spks.map((k) => {
              if (k.companyApproval || k.status === 'Draft' || k.status === 'Dibatalkan') return k
              const v = d.vendors.find((x) => x.id === k.vendorId)
              return { ...k, companyApproval: legacy('Budi Santoso', 'Direktur Keuangan', k.startDate), vendorAcceptance: legacy(v?.contactPerson ?? 'Vendor', 'Perwakilan Vendor', k.startDate) }
            }),
          } as unknown as Store
        }
        return initialData() as unknown as Store
      },
    },
  ),
)

export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId)!)
export const todayISO = () => toISODate(new Date())
