/** Ported verbatim from shared/data/interfaces/image.model.ts. */
export interface Image {
  title?: string;
  name?: string;
  src: string;
  alt: string;
  contactId?: string;
  _loadError?: boolean;
}
