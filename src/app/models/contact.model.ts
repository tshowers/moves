/**
 * Trimmed version of TODD's Contact interface
 * (frontend/src/app/shared/data/interfaces/contact.model.ts) - that one is
 * huge and covers every feature across TODD (opportunities, engagements,
 * subscriptions, etc.). This carries only the fields Moves' ported
 * components actually read: contact-picker rows in task-edit/task/sub-task
 * (id, firstName, lastName, email), and the sender identity used when
 * emailing a newly-assigned Move (signature).
 */
export interface Contact {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  signature?: string;
  emailAddresses?: { emailAddress: string; emailAddressType?: string }[];
  [key: string]: unknown;
}

export type UserRole = 'admin' | 'reviewer' | 'contractor';

/** Ported from contact.model.ts - used by MovesAdminService's tenant-member lookups. */
export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  companyId?: string;
  status: 'active' | 'invited' | 'disabled';
  isTenantOwner?: boolean;
}
