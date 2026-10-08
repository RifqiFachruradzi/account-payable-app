import type { CompanySettings, PurchaseOrder, SPK, Vendor } from '@/types'
import { addDays, today, toISODate } from './dates'
import { renderInvoiceDocument } from './documents'

export interface SampleSpec {
  vendor: Vendor
  spk?: SPK
  po?: PurchaseOrder
  description: string
  dpp: number
  /** kop berupa logo saja — nama vendor hanya ada di stempel / tanda tangan / rekening */
  logoOnly?: boolean
}

/** Membuat gambar tagihan vendor (seperti hasil scan) untuk uji coba OCR */
export function renderSampleInvoice(spec: SampleSpec, company: CompanySettings): string {
  const v = spec.vendor
  const invDate = toISODate(today())
  const yy = String(today().getFullYear()).slice(2)
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return renderInvoiceDocument(
    {
      vendor: v,
      invoiceNo: `INV/${v.code.replace('VND-', 'V')}/${today().getFullYear()}/${seq}`,
      invoiceDate: invDate,
      dueDate: addDays(invDate, v.paymentTermDays),
      fakturPajakNo: v.isPkp ? `010.002-${yy}.${String(Math.floor(Math.random() * 9e7) + 1e7)}` : undefined,
      spkNo: spec.spk?.number,
      poNo: spec.po?.number,
      spkTitle: spec.spk?.title,
      description: spec.description,
      dpp: spec.dpp,
      ppnRate: v.isPkp ? 11 : 0,
    },
    company,
    { scanned: true, logoOnly: spec.logoOnly },
  )
}
