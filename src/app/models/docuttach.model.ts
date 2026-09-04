/** Ported verbatim (field-for-field) from shared/data/interfaces/docuttach.model.ts. */
export interface Document {
  id?: any;
  src: string;
  name: string;
  title?: string;
  topic?: string;
  author?: string;
  type: 'document' | 'image' | 'video' | 'draft' | 'rfp' | 'proposal';
  recordKind?: 'upload' | 'draft';
  htmlContent?: string;
  uploadDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  dueDate?: any;
  contactId?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  ownerId?: string;
  tenantId?: string;
  isPendingUpload?: boolean;
  summary?: string;
  description?: string;
}
