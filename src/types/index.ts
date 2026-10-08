export type ID = string

export type VendorCategory =
  | 'Konstruksi'
  | 'Material & Barang'
  | 'Jasa Profesional'
  | 'IT & Telekomunikasi'
  | 'Logistik'
  | 'Facility Management'

export type WithholdingTax = 'PPh 23' | 'PPh 4(2)' | 'PPh 21' | 'Tidak Ada'

export interface Vendor {
  id: ID
  code: string
  name: string
  legalForm: 'PT' | 'CV' | 'UD' | 'Perorangan' | 'Koperasi'
  npwp: string
  nib?: string
  isPkp: boolean
  category: VendorCategory
  address: string
  city: string
  province: string
  postalCode?: string
  contactPerson: string
  phone: string
  email: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
  paymentTermDays: number
  withholdingTax: WithholdingTax
  status: 'Aktif' | 'Non-Aktif' | 'Blacklist'
  createdAt: string
  notes?: string
}

export interface LineItem {
  id: ID
  description: string
  qty: number
  unit: string
  unitPrice: number
}

export type PRStatus = 'Draft' | 'Disetujui' | 'Diproses PO' | 'Selesai' | 'Ditolak'

export interface PurchaseRequisition {
  id: ID
  number: string
  date: string
  department: string
  requester: string
  costCenter: string
  purpose: string
  items: LineItem[]
  status: PRStatus
  approvedBy?: string
}

export type POStatus = 'Open' | 'Partial Received' | 'Received' | 'Closed' | 'Cancelled'

export interface PurchaseOrder {
  id: ID
  number: string
  prId: ID
  vendorId: ID
  date: string
  deliveryDate: string
  items: LineItem[]
  ppnRate: number
  status: POStatus
  buyer: string
}

export type SPKStatus = 'Draft' | 'Berjalan' | 'Selesai' | 'Ditutup' | 'Dibatalkan'

export interface SPKTermin {
  id: ID
  name: string
  percent: number
  milestone: string
}

export interface SPK {
  id: ID
  number: string
  poId?: ID
  prId?: ID
  vendorId: ID
  title: string
  scope: string
  location: string
  startDate: string
  endDate: string
  contractValue: number // DPP (excl. PPN)
  ppnRate: number
  progress: number // 0-100
  termins: SPKTermin[]
  pic: string
  department: string
  status: SPKStatus
}

export interface GoodsReceipt {
  id: ID
  number: string // BAST / GR number
  type: 'GR' | 'BAST'
  poId?: ID
  spkId?: ID
  date: string
  receivedBy: string
  description: string
  amount: number // DPP value received / accepted
}

export type InvoiceStatus =
  | 'Diterima'
  | 'Verifikasi'
  | 'Terverifikasi'
  | 'Pengajuan'
  | 'Disetujui'
  | 'Dibayar'
  | 'Ditolak'

export interface InvoiceHistory {
  at: string
  by: string
  action: string
  note?: string
}

export interface Invoice {
  id: ID
  number: string // internal register no
  vendorInvoiceNo: string
  vendorId: ID
  invoiceDate: string
  receivedDate: string
  dueDate: string
  fakturPajakNo?: string
  spkId?: ID
  poId?: ID
  prId?: ID
  grId?: ID
  description: string
  items: LineItem[]
  dpp: number
  ppnRate: number
  ppn: number
  pphRate: number
  pph: number
  total: number // dpp + ppn
  netPayable: number // total - pph
  paidAmount: number
  status: InvoiceStatus
  source: 'Manual' | 'Scan OCR' | 'E-Mail'
  attachmentName?: string
  attachmentDataUrl?: string
  ocrConfidence?: number
  history: InvoiceHistory[]
}

export type UserRole =
  | 'AP Staff'
  | 'AP Supervisor'
  | 'Finance Manager'
  | 'Finance Director'
  | 'President Director'

export interface AppUser {
  id: ID
  name: string
  role: UserRole
  title: string
  email: string
  initials: string
}

export type ApprovalStatus = 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Dilewati'

export interface ApprovalStep {
  level: number
  role: UserRole
  label: string // Dibuat / Diperiksa / Diverifikasi / Disetujui
  userId?: ID
  userName?: string
  status: ApprovalStatus
  signedAt?: string
  signature?: string // data URL
  note?: string
}

export type PaymentRequestStatus =
  | 'Draft'
  | 'Menunggu Persetujuan'
  | 'Disetujui'
  | 'Ditolak'
  | 'Dibayar'

export interface PaymentRequest {
  id: ID
  number: string
  date: string
  vendorId: ID
  invoiceIds: ID[]
  purpose: string
  paymentMethod: 'Transfer Bank' | 'Giro' | 'Cek' | 'Virtual Account'
  plannedPaymentDate: string
  sourceAccount: string
  costCenter: string
  amount: number // gross (total)
  pphAmount: number
  netAmount: number
  steps: ApprovalStep[]
  status: PaymentRequestStatus
  createdBy: string
  notes?: string
}

export interface Payment {
  id: ID
  number: string
  paymentRequestId: ID
  vendorId: ID
  date: string
  method: PaymentRequest['paymentMethod']
  sourceAccount: string
  bankReference: string
  amount: number
  paidBy: string
}

export interface ApprovalRule {
  role: UserRole
  label: string
  minAmount: number // required when request amount >= minAmount
}

export interface CompanySettings {
  companyName: string
  companyNpwp: string
  companyAddress: string
  defaultPpnRate: number
  bankAccounts: string[]
  approvalMatrix: ApprovalRule[]
}
