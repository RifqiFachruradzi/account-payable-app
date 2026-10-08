import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
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
  // spk
  updateSpk: (id: string, patch: Partial<SPK>) => void
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

        updateSpk: (id, patch) => set((s) => ({ spks: s.spks.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

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
        resetData: () => set({ ...initialData() }),
      }
    },
    {
      name: 'ap-hub-store',
      version: seed.SEED_VERSION,
      partialize: ({ toasts: _t, ...rest }) => {
        void _t
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as unknown as Data
      },
      migrate: () => initialData() as unknown as Store,
    },
  ),
)

export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId)!)
export const todayISO = () => toISODate(new Date())
