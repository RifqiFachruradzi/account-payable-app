import type { UserRole } from '@/types'

/** Peran yang berwenang menyetujui PR dan menerbitkan PO / SPK atas nama perusahaan */
export const DOC_APPROVER_ROLES: UserRole[] = ['Finance Manager', 'Finance Director', 'President Director']
export const canApproveDocs = (role: UserRole) => DOC_APPROVER_ROLES.includes(role)

export const DEPARTMENTS = ['General Affairs', 'Information Technology', 'Finance & Tax', 'Operations', 'Supply Chain', 'Marketing', 'Human Capital', 'Legal']
