import type {
  ApprovalStep,
  AppUser,
  CompanySettings,
  GoodsReceipt,
  Invoice,
  InvoiceStatus,
  LineItem,
  Payment,
  PaymentRequest,
  PurchaseOrder,
  PurchaseRequisition,
  SPK,
  Vendor,
} from '@/types'
import { addDays, daysAgo } from '@/lib/dates'
import { computeInvoiceAmounts, pphRateFor } from '@/lib/calc'

export const USERS: AppUser[] = [
  { id: 'u1', name: 'Rina Wulandari', role: 'AP Staff', title: 'Staf Account Payable', email: 'rina.w@nusantaramakmur.co.id', initials: 'RW' },
  { id: 'u2', name: 'Andi Pratama', role: 'AP Supervisor', title: 'Supervisor Account Payable', email: 'andi.p@nusantaramakmur.co.id', initials: 'AP' },
  { id: 'u3', name: 'Dewi Kartika Sari', role: 'Finance Manager', title: 'Finance Manager', email: 'dewi.ks@nusantaramakmur.co.id', initials: 'DK' },
  { id: 'u4', name: 'Budi Santoso', role: 'Finance Director', title: 'Direktur Keuangan', email: 'budi.s@nusantaramakmur.co.id', initials: 'BS' },
  { id: 'u5', name: 'Hendra Gunawan', role: 'President Director', title: 'Presiden Direktur', email: 'hendra.g@nusantaramakmur.co.id', initials: 'HG' },
]

export const SETTINGS: CompanySettings = {
  companyName: 'PT Nusantara Makmur Sejahtera',
  companyNpwp: '01.234.567.8-091.000',
  companyAddress: 'Menara Nusantara Lt. 18, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan 12190',
  defaultPpnRate: 11,
  bankAccounts: ['BCA 012-345-6789 (Operasional)', 'Mandiri 123-00-0987654-3 (Proyek)', 'BNI 0456-789-012 (Payroll & Vendor)'],
  approvalMatrix: [
    { role: 'AP Staff', label: 'Dibuat oleh', minAmount: 0 },
    { role: 'AP Supervisor', label: 'Diperiksa oleh', minAmount: 0 },
    { role: 'Finance Manager', label: 'Diverifikasi oleh', minAmount: 0 },
    { role: 'Finance Director', label: 'Disetujui oleh', minAmount: 100_000_000 },
    { role: 'President Director', label: 'Disetujui Direksi', minAmount: 500_000_000 },
  ],
}

/** Tanda tangan contoh (SVG) untuk data awal */
export function demoSignature(name: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="90" viewBox="0 0 240 90"><text x="16" y="58" font-family="'Brush Script MT','Segoe Script',cursive" font-size="34" fill="#1e3a8a">${name.split(' ')[0]}</text><path d="M12 68 C 70 78, 150 52, 226 64" stroke="#1e3a8a" stroke-width="1.6" fill="none"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const V = (v: Omit<Vendor, 'createdAt'> & { createdAt?: string }): Vendor => ({ createdAt: daysAgo(400), ...v })

export const VENDORS: Vendor[] = [
  V({ id: 'v1', code: 'VND-0001', name: 'PT Bangun Karya Persada', legalForm: 'PT', npwp: '02.415.678.9-013.000', nib: '9120001234567', isPkp: true, category: 'Konstruksi', address: 'Jl. TB Simatupang No. 18', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12430', contactPerson: 'Ir. Joko Susilo', phone: '021-7812345', email: 'finance@bangunkarya.co.id', bankName: 'BCA', bankAccountNo: '5270123456', bankAccountName: 'PT Bangun Karya Persada', paymentTermDays: 30, withholdingTax: 'PPh 4(2)', status: 'Aktif' }),
  V({ id: 'v2', code: 'VND-0002', name: 'PT Sinar Teknologi Nusantara', legalForm: 'PT', npwp: '03.221.908.4-411.000', nib: '9120002233445', isPkp: true, category: 'IT & Telekomunikasi', address: 'Jl. HR Rasuna Said Blok X-5 Kav. 3', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12950', contactPerson: 'Melisa Hartono', phone: '021-5223344', email: 'billing@sinartek.co.id', bankName: 'Mandiri', bankAccountNo: '1240009876543', bankAccountName: 'PT Sinar Teknologi Nusantara', paymentTermDays: 30, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v3', code: 'VND-0003', name: 'CV Mitra Sarana Logistik', legalForm: 'CV', npwp: '0317 2045 6678 9001', isPkp: true, category: 'Logistik', address: 'Jl. Raya Cakung Cilincing Km 3', city: 'Jakarta Timur', province: 'DKI Jakarta', postalCode: '13910', contactPerson: 'Rudi Hermawan', phone: '021-4401122', email: 'admin@mitrasarana.id', bankName: 'BRI', bankAccountNo: '034501000123307', bankAccountName: 'CV Mitra Sarana Logistik', paymentTermDays: 14, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v4', code: 'VND-0004', name: 'PT Prima Baja Indonesia', legalForm: 'PT', npwp: '01.889.345.2-054.000', nib: '9120004455667', isPkp: true, category: 'Material & Barang', address: 'Kawasan Industri Pulogadung, Jl. Rawa Gelam IV No. 9', city: 'Jakarta Timur', province: 'DKI Jakarta', postalCode: '13930', contactPerson: 'Stevanus Wijaya', phone: '021-4605566', email: 'ar@primabaja.co.id', bankName: 'BNI', bankAccountNo: '0298765432', bankAccountName: 'PT Prima Baja Indonesia', paymentTermDays: 45, withholdingTax: 'Tidak Ada', status: 'Aktif' }),
  V({ id: 'v5', code: 'VND-0005', name: 'PT Integra Konsultan Solusi', legalForm: 'PT', npwp: '02.774.120.6-017.000', nib: '9120005566778', isPkp: true, category: 'Jasa Profesional', address: 'Gedung Graha Niaga Lt. 12, Jl. Sudirman Kav. 58', city: 'Jakarta Pusat', province: 'DKI Jakarta', postalCode: '10220', contactPerson: 'Anita Rahmawati, CPA', phone: '021-2506677', email: 'invoice@integrakonsultan.com', bankName: 'CIMB Niaga', bankAccountNo: '800123456700', bankAccountName: 'PT Integra Konsultan Solusi', paymentTermDays: 30, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v6', code: 'VND-0006', name: 'PT Cahaya Facility Services', legalForm: 'PT', npwp: '03.456.789.1-432.000', isPkp: true, category: 'Facility Management', address: 'Jl. Pemuda No. 77', city: 'Bekasi', province: 'Jawa Barat', postalCode: '17141', contactPerson: 'Yulia Permata', phone: '021-8854433', email: 'finance@cahayafs.co.id', bankName: 'BCA', bankAccountNo: '6040456789', bankAccountName: 'PT Cahaya Facility Services', paymentTermDays: 30, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v7', code: 'VND-0007', name: 'CV Anugrah Elektrikal Mandiri', legalForm: 'CV', npwp: '0316 7788 9900 1002', isPkp: true, category: 'Konstruksi', address: 'Jl. Raya Serpong Km 7 No. 21', city: 'Tangerang Selatan', province: 'Banten', postalCode: '15310', contactPerson: 'Bambang Setiadi', phone: '021-5371234', email: 'anugrah.elektrikal@gmail.com', bankName: 'Mandiri', bankAccountNo: '1550012345678', bankAccountName: 'CV Anugrah Elektrikal Mandiri', paymentTermDays: 21, withholdingTax: 'PPh 4(2)', status: 'Aktif' }),
  V({ id: 'v8', code: 'VND-0008', name: 'PT Datacomm Infranet', legalForm: 'PT', npwp: '02.118.456.3-062.000', nib: '9120008899001', isPkp: true, category: 'IT & Telekomunikasi', address: 'Jl. Gatot Subroto Kav. 36-38', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12190', contactPerson: 'Kevin Saputra', phone: '021-5250808', email: 'collection@datacomm-infra.co.id', bankName: 'BCA', bankAccountNo: '2050881234', bankAccountName: 'PT Datacomm Infranet', paymentTermDays: 30, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v9', code: 'VND-0009', name: 'CV Hijau Lestari Lanskap', legalForm: 'CV', npwp: '0320 4455 6677 8003', isPkp: false, category: 'Facility Management', address: 'Jl. Margonda Raya No. 300', city: 'Depok', province: 'Jawa Barat', postalCode: '16424', contactPerson: 'Sri Mulyani', phone: '0812-8899-7766', email: 'hijaulestari.lanskap@gmail.com', bankName: 'BRI', bankAccountNo: '012301002233505', bankAccountName: 'CV Hijau Lestari Lanskap', paymentTermDays: 14, withholdingTax: 'PPh 23', status: 'Aktif' }),
  V({ id: 'v10', code: 'VND-0010', name: 'UD Sumber Rejeki Makmur', legalForm: 'UD', npwp: '3578 0123 4567 0004', isPkp: false, category: 'Material & Barang', address: 'Jl. Kenjeran No. 112', city: 'Surabaya', province: 'Jawa Timur', postalCode: '60134', contactPerson: 'H. Mukhlis', phone: '031-3812233', email: 'sumberrejeki.ud@yahoo.co.id', bankName: 'BNI', bankAccountNo: '0712345678', bankAccountName: 'Mukhlis (UD Sumber Rejeki)', paymentTermDays: 7, withholdingTax: 'Tidak Ada', status: 'Non-Aktif', notes: 'Dinonaktifkan karena dokumen legalitas kedaluwarsa.' }),
]

let li = 0
const L = (description: string, qty: number, unit: string, unitPrice: number): LineItem => ({ id: `li${++li}`, description, qty, unit, unitPrice })

interface Project {
  key: string
  vendorId: string
  dept: string
  requester: string
  cc: string
  title: string
  items: LineItem[]
  prAgo: number
  type: 'SPK' | 'PO'
  spk?: { location: string; scope: string; durationDays: number; progress: number; status: SPK['status']; pic: string; termins: [string, number, string][] }
}

const PROJECTS: Project[] = [
  {
    key: '01', vendorId: 'v1', dept: 'General Affairs', requester: 'Agus Salim', cc: 'CC-GA-01', title: 'Renovasi Gedung Kantor Pusat Lantai 3', prAgo: 210, type: 'SPK',
    items: [L('Pekerjaan persiapan & bongkaran', 1, 'Ls', 185_000_000), L('Pekerjaan sipil & struktur', 1, 'Ls', 980_000_000), L('Pekerjaan arsitektur & interior', 1, 'Ls', 865_000_000), L('Pekerjaan MEP', 1, 'Ls', 420_000_000)],
    spk: { location: 'Menara Nusantara Lt. 3, Jakarta', scope: 'Renovasi total area kerja 1.200 m² termasuk sipil, interior dan MEP sesuai RKS & gambar kerja.', durationDays: 240, progress: 72, status: 'Berjalan', pic: 'Agus Salim', termins: [['Uang Muka', 20, 'Penandatanganan SPK & jaminan uang muka'], ['Termin I', 30, 'Progres fisik 40%'], ['Termin II', 30, 'Progres fisik 75%'], ['Termin III', 15, 'BAST I (100%)'], ['Retensi', 5, 'Masa pemeliharaan 180 hari']] },
  },
  {
    key: '02', vendorId: 'v2', dept: 'Information Technology', requester: 'Fajar Nugroho', cc: 'CC-IT-01', title: 'Implementasi Modul ERP Procurement & Finance', prAgo: 180, type: 'SPK',
    items: [L('Lisensi modul procurement (perpetual)', 1, 'Paket', 260_000_000), L('Jasa implementasi & konfigurasi', 1, 'Ls', 420_000_000), L('Migrasi data & pelatihan', 1, 'Ls', 170_000_000)],
    spk: { location: 'Kantor Pusat Jakarta', scope: 'Implementasi modul procurement, AP & GL termasuk integrasi dengan sistem existing dan UAT.', durationDays: 210, progress: 60, status: 'Berjalan', pic: 'Fajar Nugroho', termins: [['Termin I', 30, 'Kick-off & blueprint disetujui'], ['Termin II', 40, 'UAT selesai'], ['Termin III', 30, 'Go-live & hypercare']] },
  },
  {
    key: '03', vendorId: 'v5', dept: 'Finance & Tax', requester: 'Dewi Kartika Sari', cc: 'CC-FIN-01', title: 'Jasa Konsultansi Review Kepatuhan Pajak 2025', prAgo: 160, type: 'SPK',
    items: [L('Jasa review kepatuhan PPh Badan & PPN', 1, 'Ls', 240_000_000), L('Pendampingan pemeriksaan', 1, 'Ls', 80_000_000)],
    spk: { location: 'Kantor Pusat Jakarta', scope: 'Review kepatuhan perpajakan tahun buku 2025 dan pendampingan pemeriksaan pajak.', durationDays: 120, progress: 100, status: 'Selesai', pic: 'Dewi Kartika Sari', termins: [['Termin I', 50, 'Laporan interim'], ['Termin II', 50, 'Laporan akhir diterima']] },
  },
  {
    key: '04', vendorId: 'v6', dept: 'General Affairs', requester: 'Agus Salim', cc: 'CC-GA-02', title: 'Jasa Cleaning Service & Office Boy 12 Bulan', prAgo: 300, type: 'SPK',
    items: [L('Jasa cleaning service (18 personel)', 12, 'Bulan', 38_000_000), L('Chemical & peralatan kebersihan', 12, 'Bulan', 7_000_000)],
    spk: { location: 'Kantor Pusat & Gudang Cakung', scope: 'Penyediaan 18 personel cleaning service dan office boy termasuk chemical & peralatan.', durationDays: 365, progress: 75, status: 'Berjalan', pic: 'Agus Salim', termins: [['Tagihan Bulanan', 100, 'Berita acara kinerja bulanan']] },
  },
  {
    key: '05', vendorId: 'v7', dept: 'Operations', requester: 'Taufik Hidayat', cc: 'CC-OPS-03', title: 'Instalasi Panel Listrik & Penerangan Gudang Cakung', prAgo: 95, type: 'SPK',
    items: [L('Panel LVMDP 1600A', 1, 'Unit', 285_000_000), L('Kabel NYY & aksesoris', 1, 'Ls', 210_000_000), L('Lampu LED high bay 200W', 120, 'Unit', 1_500_000)],
    spk: { location: 'Gudang Cakung, Jakarta Timur', scope: 'Pengadaan dan instalasi panel LVMDP, jaringan kabel dan penerangan LED gudang.', durationDays: 120, progress: 40, status: 'Berjalan', pic: 'Taufik Hidayat', termins: [['Uang Muka', 30, 'Penandatanganan SPK'], ['Termin I', 40, 'Material on site & instalasi 70%'], ['Termin II', 30, 'Commissioning & BAST']] },
  },
  {
    key: '06', vendorId: 'v8', dept: 'Information Technology', requester: 'Fajar Nugroho', cc: 'CC-IT-02', title: 'Upgrade Jaringan WAN SD-WAN 25 Cabang', prAgo: 70, type: 'SPK',
    items: [L('Perangkat SD-WAN edge', 25, 'Unit', 28_000_000), L('Jasa instalasi & konfigurasi per site', 25, 'Site', 9_200_000), L('Managed service 12 bulan', 1, 'Paket', 250_000_000)],
    spk: { location: '25 Kantor Cabang Nasional', scope: 'Migrasi jaringan MPLS ke SD-WAN untuk 25 cabang termasuk perangkat dan managed service 12 bulan.', durationDays: 180, progress: 25, status: 'Berjalan', pic: 'Fajar Nugroho', termins: [['Termin I', 40, 'Perangkat terkirim'], ['Termin II', 40, 'Instalasi 25 site selesai'], ['Termin III', 20, 'Akhir masa managed service']] },
  },
  {
    key: '07', vendorId: 'v9', dept: 'General Affairs', requester: 'Agus Salim', cc: 'CC-GA-02', title: 'Pemeliharaan Taman & Lanskap 6 Bulan', prAgo: 120, type: 'SPK',
    items: [L('Jasa pemeliharaan taman', 6, 'Bulan', 16_000_000)],
    spk: { location: 'Kantor Pusat & Training Center Bogor', scope: 'Pemeliharaan taman, pemangkasan, pemupukan dan penggantian tanaman mati.', durationDays: 180, progress: 50, status: 'Berjalan', pic: 'Agus Salim', termins: [['Tagihan Bulanan', 100, 'Laporan pekerjaan bulanan']] },
  },
  {
    key: '08', vendorId: 'v3', dept: 'Supply Chain', requester: 'Lukman Hakim', cc: 'CC-SCM-01', title: 'Jasa Angkutan Distribusi Kuartal IV', prAgo: 30, type: 'SPK',
    items: [L('Trip distribusi CDD Jabodetabek', 300, 'Trip', 900_000), L('Trip distribusi Fuso Jawa Barat', 60, 'Trip', 2_500_000)],
    spk: { location: 'Gudang Cakung → Jabodetabek & Jawa Barat', scope: 'Pengangkutan barang jadi dari gudang ke distributor sesuai jadwal pengiriman.', durationDays: 92, progress: 15, status: 'Berjalan', pic: 'Lukman Hakim', termins: [['Tagihan Bulanan', 100, 'Rekap DO & POD bulanan']] },
  },
  {
    key: '09', vendorId: 'v4', dept: 'Operations', requester: 'Taufik Hidayat', cc: 'CC-OPS-01', title: 'Pengadaan Baja WF & Besi Beton Proyek Gudang', prAgo: 85, type: 'PO',
    items: [L('Baja WF 300x150x6,5x9 mm', 120, 'Batang', 3_650_000), L('Besi beton ulir D16', 2_500, 'Batang', 118_000)],
  },
  {
    key: '10', vendorId: 'v2', dept: 'Information Technology', requester: 'Fajar Nugroho', cc: 'CC-IT-01', title: 'Pengadaan Laptop Karyawan Batch 2', prAgo: 50, type: 'PO',
    items: [L('Laptop Core i7 16GB 512GB SSD', 30, 'Unit', 16_500_000), L('Docking station USB-C', 30, 'Unit', 1_450_000)],
  },
  {
    key: '11', vendorId: 'v3', dept: 'Supply Chain', requester: 'Lukman Hakim', cc: 'CC-SCM-01', title: 'Sewa Forklift 3 Ton (3 Bulan)', prAgo: 40, type: 'PO',
    items: [L('Sewa forklift diesel 3 ton', 3, 'Bulan', 24_500_000)],
  },
]

const YEAR = new Date().getFullYear()
export const PRS: PurchaseRequisition[] = []
export const POS: PurchaseOrder[] = []
export const SPKS: SPK[] = []
export const GRS: GoodsReceipt[] = []

const sum = (items: LineItem[]) => items.reduce((s, i) => s + i.qty * i.unitPrice, 0)

for (const p of PROJECTS) {
  const prDate = daysAgo(p.prAgo)
  const poDate = addDays(prDate, 7)
  const pr: PurchaseRequisition = {
    id: `pr${p.key}`, number: `PR/${YEAR}/${p.dept.slice(0, 3).toUpperCase()}/${p.key.padStart(4, '0')}`, date: prDate, department: p.dept,
    requester: p.requester, costCenter: p.cc, purpose: p.title, items: p.items, status: 'Diproses PO', approvedBy: 'Dewi Kartika Sari',
  }
  const po: PurchaseOrder = {
    id: `po${p.key}`, number: `PO/${YEAR}/${p.key.padStart(5, '0')}`, prId: pr.id, vendorId: p.vendorId, date: poDate,
    deliveryDate: addDays(poDate, p.spk ? p.spk.durationDays : 21), items: p.items, ppnRate: 11, status: 'Open', buyer: 'Yohanes Prasetyo',
  }
  PRS.push(pr)
  POS.push(po)
  if (p.spk) {
    const start = addDays(poDate, 5)
    SPKS.push({
      id: `spk${p.key}`, number: `SPK/${YEAR}/NMS/${p.key.padStart(3, '0')}`, poId: po.id, prId: pr.id, vendorId: p.vendorId, title: p.title,
      scope: p.spk.scope, location: p.spk.location, startDate: start, endDate: addDays(start, p.spk.durationDays), contractValue: sum(p.items), ppnRate: 11,
      progress: p.spk.progress, pic: p.spk.pic, department: p.dept, status: p.spk.status,
      termins: p.spk.termins.map(([name, percent, milestone], i) => ({ id: `t${p.key}${i}`, name, percent, milestone })),
    })
  }
}
// PR tambahan yang belum diproses PO
PRS.push(
  { id: 'pr12', number: `PR/${YEAR}/GEN/0012`, date: daysAgo(6), department: 'General Affairs', requester: 'Agus Salim', costCenter: 'CC-GA-01', purpose: 'Pengadaan Kursi Ergonomis Ruang Rapat', items: [L('Kursi ergonomis mesh', 40, 'Unit', 2_850_000)], status: 'Disetujui', approvedBy: 'Dewi Kartika Sari' },
  { id: 'pr13', number: `PR/${YEAR}/MAR/0013`, date: daysAgo(3), department: 'Marketing', requester: 'Citra Ayu', costCenter: 'CC-MKT-01', purpose: 'Produksi Materi Promosi Akhir Tahun', items: [L('Cetak brosur A4 art paper', 20_000, 'Lembar', 2_100), L('Standing banner', 50, 'Unit', 350_000)], status: 'Draft' },
)
POS.find((p) => p.id === 'po03')!.status = 'Closed'
POS.find((p) => p.id === 'po09')!.status = 'Partial Received'
POS.find((p) => p.id === 'po10')!.status = 'Received'

// ---- Tagihan ----
interface InvSpec {
  proj: string
  dpp: number
  invAgo: number
  status: InvoiceStatus
  desc: string
  gr?: boolean
  source?: Invoice['source']
}
const INV_SPECS: InvSpec[] = [
  // Renovasi gedung (2.450.000.000)
  { proj: '01', dpp: 490_000_000, invAgo: 190, status: 'Dibayar', desc: 'Uang muka 20% Renovasi Gedung Lt. 3' },
  { proj: '01', dpp: 735_000_000, invAgo: 110, status: 'Dibayar', desc: 'Termin I (30%) progres fisik 40%', gr: true },
  { proj: '01', dpp: 735_000_000, invAgo: 12, status: 'Pengajuan', desc: 'Termin II (30%) progres fisik 75%', gr: true },
  // ERP 850.000.000
  { proj: '02', dpp: 255_000_000, invAgo: 150, status: 'Dibayar', desc: 'Termin I (30%) blueprint disetujui', gr: true },
  { proj: '02', dpp: 340_000_000, invAgo: 41, status: 'Disetujui', desc: 'Termin II (40%) UAT selesai', gr: true },
  // Konsultan pajak 320.000.000
  { proj: '03', dpp: 160_000_000, invAgo: 100, status: 'Dibayar', desc: 'Termin I laporan interim review pajak', gr: true },
  { proj: '03', dpp: 160_000_000, invAgo: 48, status: 'Terverifikasi', desc: 'Termin II laporan akhir review pajak', gr: true },
  // Cleaning 45jt/bulan
  ...[8, 7, 6, 5].map((m, i) => ({ proj: '04', dpp: 45_000_000, invAgo: m * 30 - 20, status: 'Dibayar' as InvoiceStatus, desc: `Jasa cleaning service periode bulan ke-${i + 1}`, gr: true })),
  { proj: '04', dpp: 45_000_000, invAgo: 100, status: 'Dibayar', desc: 'Jasa cleaning service periode bulan ke-5', gr: true },
  { proj: '04', dpp: 45_000_000, invAgo: 72, status: 'Pengajuan', desc: 'Jasa cleaning service periode bulan ke-6', gr: true },
  { proj: '04', dpp: 45_000_000, invAgo: 38, status: 'Terverifikasi', desc: 'Jasa cleaning service periode bulan ke-7', gr: true },
  { proj: '04', dpp: 45_000_000, invAgo: 9, status: 'Verifikasi', desc: 'Jasa cleaning service periode bulan ke-8', gr: true, source: 'Scan OCR' },
  // Panel listrik 675.000.000
  { proj: '05', dpp: 202_500_000, invAgo: 80, status: 'Dibayar', desc: 'Uang muka 30% instalasi panel listrik' },
  { proj: '05', dpp: 270_000_000, invAgo: 4, status: 'Diterima', desc: 'Termin I (40%) material on site', source: 'Scan OCR' },
  // SD-WAN 1.180.000.000
  { proj: '06', dpp: 472_000_000, invAgo: 20, status: 'Pengajuan', desc: 'Termin I (40%) pengiriman perangkat SD-WAN', gr: true },
  // Lanskap 16jt/bulan
  { proj: '07', dpp: 16_000_000, invAgo: 95, status: 'Dibayar', desc: 'Pemeliharaan taman bulan ke-1', gr: true },
  { proj: '07', dpp: 16_000_000, invAgo: 66, status: 'Disetujui', desc: 'Pemeliharaan taman bulan ke-2', gr: true },
  { proj: '07', dpp: 16_000_000, invAgo: 35, status: 'Verifikasi', desc: 'Pemeliharaan taman bulan ke-3', gr: true },
  { proj: '07', dpp: 16_000_000, invAgo: 2, status: 'Diterima', desc: 'Pemeliharaan taman bulan ke-4', source: 'E-Mail' },
  // Angkutan
  { proj: '08', dpp: 63_000_000, invAgo: 6, status: 'Diterima', desc: 'Jasa angkutan distribusi periode minggu 1-2', source: 'Scan OCR' },
  // PO baja
  { proj: '09', dpp: 438_000_000, invAgo: 62, status: 'Terverifikasi', desc: 'Pengiriman I baja WF 120 batang', gr: true },
  { proj: '09', dpp: 150_000_000, invAgo: 25, status: 'Ditolak', desc: 'Pengiriman II besi beton — nilai tidak sesuai GR' },
  // PO laptop
  { proj: '10', dpp: 538_500_000, invAgo: 28, status: 'Pengajuan', desc: 'Pengadaan 30 unit laptop & docking station', gr: true },
  // Forklift
  { proj: '11', dpp: 24_500_000, invAgo: 33, status: 'Dibayar', desc: 'Sewa forklift bulan ke-1', gr: true },
  { proj: '11', dpp: 24_500_000, invAgo: 3, status: 'Diterima', desc: 'Sewa forklift bulan ke-2', source: 'E-Mail' },
]

export const INVOICES: Invoice[] = []
export const PAYMENT_REQUESTS: PaymentRequest[] = []
export const PAYMENTS: Payment[] = []

const vendorById = (id: string) => VENDORS.find((v) => v.id === id)!
const vendorPrefix: Record<string, string> = { v1: 'BKP', v2: 'STN', v3: 'MSL', v4: 'PBI', v5: 'IKS', v6: 'CFS', v7: 'AEM', v8: 'DCI', v9: 'HLL' }

const statusOrder: InvoiceStatus[] = ['Diterima', 'Verifikasi', 'Terverifikasi', 'Pengajuan', 'Disetujui', 'Dibayar']

INV_SPECS.sort((a, b) => b.invAgo - a.invAgo).forEach((s, idx) => {
  const proj = PROJECTS.find((p) => p.key === s.proj)!
  const vendor = vendorById(proj.vendorId)
  const invoiceDate = daysAgo(s.invAgo)
  const receivedDate = addDays(invoiceDate, 2)
  const pphRate = pphRateFor(vendor.withholdingTax)
  const ppnRate = vendor.isPkp ? 11 : 0
  const amt = computeInvoiceAmounts(s.dpp, ppnRate, pphRate)
  const spkId = proj.type === 'SPK' ? `spk${proj.key}` : undefined
  const no = idx + 1
  let grId: string | undefined
  if (s.gr) {
    grId = `gr${no}`
    GRS.push({
      id: grId, number: `${spkId ? 'BAST' : 'GR'}/${YEAR}/${String(no).padStart(4, '0')}`, type: spkId ? 'BAST' : 'GR', poId: `po${proj.key}`, spkId,
      date: addDays(invoiceDate, -3), receivedBy: proj.requester, description: s.desc, amount: s.dpp,
    })
  }
  const history: Invoice['history'] = [{ at: `${receivedDate}T09:15:00`, by: 'Rina Wulandari', action: `Tagihan diterima (${s.source ?? 'Manual'})` }]
  const reached = statusOrder.indexOf(s.status)
  if (s.status === 'Ditolak') {
    history.push({ at: `${addDays(receivedDate, 2)}T14:00:00`, by: 'Andi Pratama', action: 'Tagihan ditolak', note: 'Nilai tagihan tidak sesuai GR. Vendor diminta menerbitkan ulang.' })
  } else {
    if (reached >= 1) history.push({ at: `${addDays(receivedDate, 1)}T10:00:00`, by: 'Rina Wulandari', action: 'Proses verifikasi & 3-way matching dimulai' })
    if (reached >= 2) history.push({ at: `${addDays(receivedDate, 2)}T15:30:00`, by: 'Andi Pratama', action: 'Tagihan terverifikasi' })
  }
  const inv: Invoice = {
    id: `inv${no}`, number: `AP/${YEAR}/${String(no).padStart(5, '0')}`, vendorInvoiceNo: `INV/${vendorPrefix[vendor.id]}/${YEAR}/${String(100 + no * 7).padStart(4, '0')}`,
    vendorId: vendor.id, invoiceDate, receivedDate, dueDate: addDays(invoiceDate, vendor.paymentTermDays),
    fakturPajakNo: vendor.isPkp ? `010.002-${YEAR % 100}.${String(10_000_000 + no * 7919).slice(-8)}` : undefined,
    spkId, poId: `po${proj.key}`, prId: `pr${proj.key}`, grId, description: s.desc,
    items: [{ id: `ii${no}`, description: s.desc, qty: 1, unit: 'Ls', unitPrice: s.dpp }],
    dpp: s.dpp, ppnRate, pphRate, ...amt, paidAmount: 0, status: s.status, source: s.source ?? 'Manual', history,
    ocrConfidence: s.source === 'Scan OCR' ? 88 + (no % 9) : undefined,
    attachmentName: s.source === 'Scan OCR' ? `scan_tagihan_${no}.jpg` : s.source === 'E-Mail' ? `invoice_${no}.pdf` : undefined,
  }
  INVOICES.push(inv)
})

// ---- Pengajuan pembayaran & pembayaran ----
let prqNo = 0
let payNo = 0
const matrix = SETTINGS.approvalMatrix
for (const inv of INVOICES) {
  if (!['Pengajuan', 'Disetujui', 'Dibayar'].includes(inv.status)) continue
  prqNo++
  const reqDate = addDays(inv.receivedDate, 4)
  const steps = matrix
    .filter((r, i) => i === 0 || inv.total >= r.minAmount)
    .map((r, i) => ({ level: i + 1, role: r.role, label: r.label, status: 'Menunggu' as const, ...{} }))
  // jumlah langkah yang sudah ditandatangani
  const signedCount = inv.status === 'Pengajuan' ? Math.min(steps.length - 1, 1 + (prqNo % 3)) : steps.length
  const fullSteps: ApprovalStep[] = steps.map((st, i): ApprovalStep => {
    const user = USERS.find((u) => u.role === st.role)!
    if (i < signedCount) {
      return { ...st, status: 'Disetujui' as const, userId: user.id, userName: user.name, signedAt: `${addDays(reqDate, i)}T${10 + i}:20:00`, signature: demoSignature(user.name) }
    }
    return st
  })
  const pr: PaymentRequest = {
    id: `prq${prqNo}`, number: `PP/${YEAR}/${String(prqNo).padStart(4, '0')}`, date: reqDate, vendorId: inv.vendorId, invoiceIds: [inv.id],
    purpose: `Pembayaran ${inv.description}`, paymentMethod: 'Transfer Bank', plannedPaymentDate: inv.dueDate,
    sourceAccount: SETTINGS.bankAccounts[prqNo % 3], costCenter: PRS.find((p) => p.id === inv.prId)?.costCenter ?? '-',
    amount: inv.total, pphAmount: inv.pph, netAmount: inv.netPayable, steps: fullSteps,
    status: inv.status === 'Pengajuan' ? 'Menunggu Persetujuan' : inv.status === 'Disetujui' ? 'Disetujui' : 'Dibayar', createdBy: 'Rina Wulandari',
  }
  PAYMENT_REQUESTS.push(pr)
  inv.history.push({ at: `${reqDate}T11:00:00`, by: 'Rina Wulandari', action: `Diajukan dalam ${pr.number}` })
  if (inv.status === 'Disetujui' || inv.status === 'Dibayar')
    inv.history.push({ at: `${addDays(reqDate, steps.length - 1)}T16:00:00`, by: fullSteps[fullSteps.length - 1].userName ?? '-', action: 'Pengajuan pembayaran disetujui penuh' })
  if (inv.status === 'Dibayar') {
    payNo++
    const date = addDays(inv.dueDate, (payNo % 5) - 3)
    const safeDate = date > daysAgo(0) ? daysAgo(1) : date
    PAYMENTS.push({
      id: `pay${payNo}`, number: `BKK/${YEAR}/${String(payNo).padStart(4, '0')}`, paymentRequestId: pr.id, vendorId: inv.vendorId, date: safeDate,
      method: 'Transfer Bank', sourceAccount: pr.sourceAccount, bankReference: `TRF${String(81234567 + payNo * 1373)}`, amount: inv.netPayable, paidBy: 'Dewi Kartika Sari',
    })
    inv.paidAmount = inv.netPayable
    inv.history.push({ at: `${safeDate}T13:45:00`, by: 'Dewi Kartika Sari', action: 'Pembayaran ditransfer', note: `Ref. TRF${81234567 + payNo * 1373}` })
  }
}

// Status PO berdasarkan progres
SPKS.forEach((s) => {
  if (s.status === 'Selesai') POS.find((p) => p.id === s.poId)!.status = 'Received'
})

export const SEED_VERSION = 3
