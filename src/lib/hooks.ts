import { useMemo } from 'react'
import { useStore } from '@/store/useStore'

export function useLookups() {
  const { vendors, spks, pos, prs, grs, invoices, paymentRequests } = useStore()
  return useMemo(() => {
    const map = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]))
    return {
      vendor: map(vendors),
      spk: map(spks),
      po: map(pos),
      pr: map(prs),
      gr: map(grs),
      invoice: map(invoices),
      prq: map(paymentRequests),
    }
  }, [vendors, spks, pos, prs, grs, invoices, paymentRequests])
}
