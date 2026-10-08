import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const InvoiceList = lazy(() => import('@/pages/invoices/InvoiceList'))
const InvoiceDetail = lazy(() => import('@/pages/invoices/InvoiceDetail'))
const ScanInvoice = lazy(() => import('@/pages/invoices/ScanInvoice'))
const Outstanding = lazy(() => import('@/pages/invoices/Outstanding'))
const SpkList = lazy(() => import('@/pages/spk/SpkList'))
const SpkDetail = lazy(() => import('@/pages/spk/SpkDetail'))
const Receipts = lazy(() => import('@/pages/receipts/Receipts'))
const PrList = lazy(() => import('@/pages/pr/PrList'))
const PrForm = lazy(() => import('@/pages/pr/PrForm'))
const PrDetail = lazy(() => import('@/pages/pr/PrDetail'))
const PoList = lazy(() => import('@/pages/po/PoList'))
const PoForm = lazy(() => import('@/pages/po/PoForm'))
const PoDetail = lazy(() => import('@/pages/po/PoDetail'))
const SpkForm = lazy(() => import('@/pages/spk/SpkForm'))
const VendorList = lazy(() => import('@/pages/vendors/VendorList'))
const VendorDetail = lazy(() => import('@/pages/vendors/VendorDetail'))
const PaymentRequestList = lazy(() => import('@/pages/payments/PaymentRequestList'))
const PaymentRequestForm = lazy(() => import('@/pages/payments/PaymentRequestForm'))
const PaymentRequestDetail = lazy(() => import('@/pages/payments/PaymentRequestDetail'))
const Approvals = lazy(() => import('@/pages/payments/Approvals'))
const Payments = lazy(() => import('@/pages/payments/Payments'))
const SettingsPage = lazy(() => import('@/pages/Settings'))

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<div className="grid h-64 place-items-center text-slate-400"><Loader2 className="size-6 animate-spin" /></div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scan" element={<ScanInvoice />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/outstanding" element={<Outstanding />} />
        <Route path="/spk" element={<SpkList />} />
        <Route path="/spk/new" element={<SpkForm />} />
        <Route path="/spk/:id" element={<SpkDetail />} />
        <Route path="/spk/:id/edit" element={<SpkForm />} />
        <Route path="/pr" element={<PrList />} />
        <Route path="/pr/new" element={<PrForm />} />
        <Route path="/pr/:id" element={<PrDetail />} />
        <Route path="/pr/:id/edit" element={<PrForm />} />
        <Route path="/po" element={<PoList />} />
        <Route path="/po/new" element={<PoForm />} />
        <Route path="/po/:id" element={<PoDetail />} />
        <Route path="/po/:id/edit" element={<PoForm />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/procurement" element={<Navigate to="/pr" replace />} />
        <Route path="/vendors" element={<VendorList />} />
        <Route path="/vendors/:id" element={<VendorDetail />} />
        <Route path="/payment-requests" element={<PaymentRequestList />} />
        <Route path="/payment-requests/new" element={<PaymentRequestForm />} />
        <Route path="/payment-requests/:id" element={<PaymentRequestDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Layout>
  )
}
