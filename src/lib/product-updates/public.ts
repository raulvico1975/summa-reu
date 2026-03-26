import { getAdminDb } from '@/lib/api/admin-sdk';

export interface PublicProductUpdate {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  publishedAt: string | null;
}

type RecordLike = Record<string, unknown>;

type ProductUpdatesPublicDb = {
  collection: (path: string) => {
    get: () => Promise<{
      docs: Array<{
        id: string;
        data: () => unknown;
      }>;
    }>;
  };
};

export interface PublicProductUpdatesDeps {
  getAdminDbFn?: () => ProductUpdatesPublicDb;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isSafeSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.includes('/') || slug.includes('..')) return false;
  if (/\s/.test(slug)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  return null;
}

function toPublicProductUpdate(docId: string, raw: unknown): PublicProductUpdate | null {
  if (!isRecord(raw)) return null;

  const isActive = raw.isActive !== false;
  if (!isActive) return null;

  const web = isRecord(raw.web) ? raw.web : null;
  if (!web || web.enabled !== true) return null;

  const slug = asNonEmptyString(web.slug);
  if (!slug || !isSafeSlug(slug)) return null;

  const title =
    asNonEmptyString(web.title) ??
    asNonEmptyString(raw.title);

  if (!title) return null;

  const excerpt =
    asNonEmptyString(web.excerpt) ??
    asNonEmptyString(raw.description);
  const content =
    asNonEmptyString(web.content) ??
    asNonEmptyString(raw.contentLong);
  const publishedAtDate =
    normalizeDate(web.publishedAt) ??
    normalizeDate(raw.publishedAt) ??
    normalizeDate(raw.createdAt);

  return {
    id: docId,
    title,
    slug,
    excerpt,
    content,
    publishedAt: publishedAtDate ? publishedAtDate.toISOString().slice(0, 10) : null,
  };
}

export async function listPublicProductUpdates(
  deps: PublicProductUpdatesDeps = {}
): Promise<PublicProductUpdate[]> {
  const db = deps.getAdminDbFn ? deps.getAdminDbFn() : (getAdminDb() as unknown as ProductUpdatesPublicDb);
  const snapshot = await db.collection('productUpdates').get();

  return snapshot.docs
    .map((doc) => toPublicProductUpdate(doc.id, doc.data()))
    .filter((item): item is PublicProductUpdate => item !== null)
    .sort((left, right) => {
      const leftMs = left.publishedAt ? Date.parse(left.publishedAt) : 0;
      const rightMs = right.publishedAt ? Date.parse(right.publishedAt) : 0;
      return rightMs - leftMs;
    });
}

export async function getPublicProductUpdateBySlug(
  slug: string,
  deps: PublicProductUpdatesDeps = {}
): Promise<PublicProductUpdate | null> {
  if (!isSafeSlug(slug)) return null;

  const updates = await listPublicProductUpdates(deps);
  return updates.find((update) => update.slug === slug) ?? null;
}

export async function getLatestPublicProductUpdate(
  deps: PublicProductUpdatesDeps = {}
): Promise<PublicProductUpdate | null> {
  const updates = await listPublicProductUpdates(deps);
  return updates[0] ?? null;
}
