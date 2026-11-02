export type UserDocumentRecord = {
  name?: string;
  url?: string;
  category?: string;
  uploadedAt?: string;
  type?: string;
  path?: string;
  [key: string]: unknown;
};

/** Supabase may return jsonb as array, or legacy stringified JSON. */
export function normalizeUserDocuments(raw: unknown): UserDocumentRecord[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as UserDocumentRecord[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as UserDocumentRecord[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isMedicalUserDocument(d: UserDocumentRecord): boolean {
  const cat = String(d.category ?? '').toLowerCase();
  const p = String(d.path ?? '').toLowerCase();
  return cat === 'medical' || p.includes('/medical/');
}

export function isImageDoc(d: UserDocumentRecord): boolean {
  const t = String(d.type ?? '').toLowerCase();
  const n = String(d.name ?? '');
  return t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(n);
}
