import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/api/admin-sdk';
import { PUBLIC_LOCALES } from '@/lib/public-locale';

type ProductUpdateChannel = 'app' | 'web';

interface PublishProductUpdateWebPayload {
  enabled: boolean;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
}

interface PublishProductUpdateSourceMeta {
  system: 'openclaw';
  externalId: string;
  sourceRefs: string[];
  evidenceRefs: string[];
  approvedAt?: string | null;
  approvedBy?: string | null;
}

interface PublishProductUpdatePayload {
  externalId: string;
  title: string;
  description: string;
  link?: string | null;
  contentLong: string;
  guideUrl?: string | null;
  videoUrl?: string | null;
  web?: PublishProductUpdateWebPayload | null;
  sourceMeta: PublishProductUpdateSourceMeta;
  channels: ProductUpdateChannel[];
}

type PublishProductUpdateSuccessResponse = {
  success: true;
  id: string;
  url: string | null;
};

type PublishProductUpdateErrorResponse = {
  success: false;
  error: string;
  details?: string[];
};

export type PublishProductUpdateResponse =
  | PublishProductUpdateSuccessResponse
  | PublishProductUpdateErrorResponse;

type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

type ExistingDocSnapshot = {
  exists: boolean;
  data: () => unknown;
};

type ExistingDocRef = {
  get: () => Promise<ExistingDocSnapshot>;
  create: (payload: Record<string, unknown>) => Promise<void>;
};

type CollectionSnapshot = {
  docs: Array<{
    id: string;
    data: () => unknown;
  }>;
};

type ProductUpdatesPublishDb = {
  doc: (path: string) => ExistingDocRef;
  collection: (path: string) => {
    get: () => Promise<CollectionSnapshot>;
  };
};

export interface PublishProductUpdateDeps {
  getAdminDbFn: () => ProductUpdatesPublishDb;
  nowTimestampFn: () => unknown;
  getPublishSecretFn: () => string | null;
  getPublicBaseUrlFn: () => string;
  getPublicLocalesFn: () => string[];
  revalidatePathsFn: (paths: string[]) => void | Promise<void>;
}

const HTML_TAG_PATTERN = /<[^>]+>/;
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 140;
const EXCERPT_MAX = 160;
const CONTENT_MAX = 6000;
const URL_MAX = 2000;
const REF_MAX = 32;

function getPublishSecretFromEnv(): string | null {
  return process.env.PRODUCT_UPDATES_PUBLISH_SECRET?.trim() || null;
}

const DEFAULT_DEPS: PublishProductUpdateDeps = {
  getAdminDbFn: () => getAdminDb() as unknown as ProductUpdatesPublishDb,
  nowTimestampFn: () => Timestamp.now(),
  getPublishSecretFn: getPublishSecretFromEnv,
  getPublicBaseUrlFn: () => process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://summasocial.app',
  getPublicLocalesFn: () => [...PUBLIC_LOCALES],
  revalidatePathsFn: (paths) => {
    for (const path of paths) {
      revalidatePath(path);
    }
  },
};

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function extractBearerToken(request: RequestLike): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function hasValidAuthorization(request: RequestLike, secret: string | null): boolean {
  if (!secret) return false;
  const token = extractBearerToken(request);
  if (!token) return false;
  return safeCompare(token, secret);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasHtml(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}

function normalizeString(value: unknown): string | null {
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

function isValidOptionalUrl(value: string | null): boolean {
  if (value === null) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeStringField(
  value: unknown,
  field: string,
  errors: string[],
  options: { max: number; required?: boolean }
): string | null {
  const normalized = normalizeString(value);

  if (!normalized) {
    if (options.required) {
      errors.push(`${field} must be a non-empty string`);
    }
    return null;
  }

  if (normalized.length > options.max) {
    errors.push(`${field} exceeds max length ${options.max}`);
  }

  if (hasHtml(normalized)) {
    errors.push(`${field} must be plain text`);
  }

  return normalized;
}

function sanitizeRefs(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }

  if (value.length > REF_MAX) {
    errors.push(`${field} exceeds max length ${REF_MAX}`);
  }

  const refs = value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => entry !== null);

  if (refs.length !== value.length) {
    errors.push(`${field} must contain only non-empty strings`);
  }

  return refs;
}

function sanitizeChannels(value: unknown, errors: string[]): ProductUpdateChannel[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('channels must be a non-empty array');
    return [];
  }

  const valid = new Set<ProductUpdateChannel>();
  for (const entry of value) {
    if (entry === 'app' || entry === 'web') {
      valid.add(entry);
    } else {
      errors.push('channels contains an invalid value');
    }
  }

  return [...valid];
}

function sanitizeOptionalIsoString(value: unknown, field: string, errors: string[]): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be an ISO date`);
    return null;
  }

  return parsed.toISOString();
}

function sanitizeWeb(
  value: unknown,
  channels: ProductUpdateChannel[],
  errors: string[]
): PublishProductUpdateWebPayload | null {
  if (value === null || value === undefined) {
    if (channels.includes('web')) {
      errors.push('web payload is required when channels includes web');
    }
    return null;
  }

  if (!isRecord(value)) {
    errors.push('web must be an object');
    return null;
  }

  const enabled = value.enabled === true;
  if (channels.includes('web') && !enabled) {
    errors.push('web.enabled must be true when channels includes web');
  }

  const slug = sanitizeStringField(value.slug, 'web.slug', errors, { max: 120, required: enabled });
  if (slug && !isSafeSlug(slug)) {
    errors.push('web.slug must be URL-safe');
  }

  const excerpt = sanitizeStringField(value.excerpt, 'web.excerpt', errors, { max: EXCERPT_MAX });
  const content = sanitizeStringField(value.content, 'web.content', errors, { max: CONTENT_MAX });

  if (!enabled) {
    return {
      enabled: false,
      slug: slug ?? '',
      excerpt,
      content,
    };
  }

  if (!slug) return null;

  return {
    enabled: true,
    slug,
    excerpt,
    content,
  };
}

function omitUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value
      .map((entry) => omitUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = omitUndefinedDeep(nested);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }

  return value;
}

function normalizePersistedUrl(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const link = normalizeString(data.link);
  return link ?? null;
}

function buildWebUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/ca/novetats/${slug}`;
}

function buildRevalidationPaths(locales: string[], slug: string | null): string[] {
  if (!slug) return [];

  const paths = new Set<string>();

  for (const locale of locales) {
    const normalized = locale.trim();
    if (!normalized) continue;
    paths.add(`/${normalized}`);
    paths.add(`/${normalized}/novetats`);
    paths.add(`/${normalized}/novetats/${slug}`);
  }

  return [...paths];
}

function validatePublishPayload(raw: unknown): {
  ok: true;
  value: PublishProductUpdatePayload;
} | {
  ok: false;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const externalId = sanitizeStringField(raw.externalId, 'externalId', errors, { max: 160, required: true });
  const title = sanitizeStringField(raw.title, 'title', errors, { max: TITLE_MAX, required: true });
  const description = sanitizeStringField(raw.description, 'description', errors, { max: DESCRIPTION_MAX, required: true });
  const contentLong = sanitizeStringField(raw.contentLong, 'contentLong', errors, { max: CONTENT_MAX, required: true });
  const guideUrl = normalizeString(raw.guideUrl);
  const videoUrl = normalizeString(raw.videoUrl);
  const link = normalizeString(raw.link);
  const channels = sanitizeChannels(raw.channels, errors);

  if (!isValidOptionalUrl(guideUrl)) {
    errors.push('guideUrl must be a valid http(s) URL');
  }
  if (!isValidOptionalUrl(videoUrl)) {
    errors.push('videoUrl must be a valid http(s) URL');
  }
  if (!isValidOptionalUrl(link)) {
    errors.push('link must be a valid http(s) URL');
  }
  if (guideUrl && guideUrl.length > URL_MAX) {
    errors.push(`guideUrl exceeds max length ${URL_MAX}`);
  }
  if (videoUrl && videoUrl.length > URL_MAX) {
    errors.push(`videoUrl exceeds max length ${URL_MAX}`);
  }
  if (link && link.length > URL_MAX) {
    errors.push(`link exceeds max length ${URL_MAX}`);
  }

  const web = sanitizeWeb(raw.web, channels, errors);

  const sourceMetaRaw = raw.sourceMeta;
  if (!isRecord(sourceMetaRaw)) {
    errors.push('sourceMeta must be an object');
  }

  const sourceMetaExternalId = isRecord(sourceMetaRaw)
    ? sanitizeStringField(sourceMetaRaw.externalId, 'sourceMeta.externalId', errors, { max: 160, required: true })
    : null;
  const system = isRecord(sourceMetaRaw) ? sourceMetaRaw.system : null;
  if (system !== 'openclaw') {
    errors.push('sourceMeta.system must be "openclaw"');
  }

  const sourceRefs = isRecord(sourceMetaRaw)
    ? sanitizeRefs(sourceMetaRaw.sourceRefs, 'sourceMeta.sourceRefs', errors)
    : [];
  const evidenceRefs = isRecord(sourceMetaRaw)
    ? sanitizeRefs(sourceMetaRaw.evidenceRefs, 'sourceMeta.evidenceRefs', errors)
    : [];
  const approvedAt = isRecord(sourceMetaRaw)
    ? sanitizeOptionalIsoString(sourceMetaRaw.approvedAt, 'sourceMeta.approvedAt', errors)
    : null;
  const approvedBy = isRecord(sourceMetaRaw)
    ? sanitizeStringField(sourceMetaRaw.approvedBy, 'sourceMeta.approvedBy', errors, { max: 160 })
    : null;

  if (channels.includes('web') && !web?.enabled) {
    errors.push('web must be enabled when channels includes web');
  }

  if (externalId && sourceMetaExternalId && externalId !== sourceMetaExternalId) {
    errors.push('sourceMeta.externalId must match externalId');
  }

  if (errors.length > 0 || !externalId || !title || !description || !contentLong || !sourceMetaExternalId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      externalId,
      title,
      description,
      link,
      contentLong,
      guideUrl,
      videoUrl,
      web: web?.enabled ? web : null,
      sourceMeta: {
        system: 'openclaw',
        externalId: sourceMetaExternalId,
        sourceRefs,
        evidenceRefs,
        approvedAt,
        approvedBy,
      },
      channels,
    },
  };
}

async function findSlugConflict(
  db: ProductUpdatesPublishDb,
  slug: string,
  externalId: string
): Promise<boolean> {
  const snapshot = await db.collection('productUpdates').get();

  return snapshot.docs.some((doc) => {
    if (doc.id === externalId) return false;
    const data = doc.data();
    if (!isRecord(data) || !isRecord(data.web)) return false;
    return data.web.enabled === true && data.web.slug === slug;
  });
}

async function safeRevalidatePaths(paths: string[], deps: Pick<PublishProductUpdateDeps, 'revalidatePathsFn'>): Promise<void> {
  try {
    await deps.revalidatePathsFn(paths);
  } catch (error) {
    console.warn('[product-updates/publish] revalidate warning:', error);
  }
}

export async function handleProductUpdatesPublish(
  request: RequestLike,
  deps: PublishProductUpdateDeps = DEFAULT_DEPS
): Promise<NextResponse<PublishProductUpdateResponse>> {
  try {
    const publishSecret = deps.getPublishSecretFn();
    if (!publishSecret || !hasValidAuthorization(request, publishSecret)) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    const validation = validatePublishPayload(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: 'invalid_payload', details: validation.errors },
        { status: 400 }
      );
    }

    const payload = validation.value;
    const db = deps.getAdminDbFn();
    const docRef = db.doc(`productUpdates/${payload.externalId}`);
    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({
        success: true,
        id: payload.externalId,
        url: normalizePersistedUrl(existing.data()),
      });
    }

    if (payload.web?.enabled) {
      const hasConflict = await findSlugConflict(db, payload.web.slug, payload.externalId);
      if (hasConflict) {
        return NextResponse.json({ success: false, error: 'duplicate_slug' }, { status: 409 });
      }
    }

    const now = deps.nowTimestampFn();
    const webLink = payload.web?.enabled
      ? buildWebUrl(deps.getPublicBaseUrlFn(), payload.web.slug)
      : null;
    const effectiveLink = payload.guideUrl ?? webLink ?? null;

    const docPayload = omitUndefinedDeep({
      id: payload.externalId,
      title: payload.title,
      description: payload.description,
      link: effectiveLink,
      contentLong: payload.contentLong,
      guideUrl: payload.guideUrl ?? null,
      videoUrl: payload.videoUrl ?? null,
      publishedAt: now,
      createdAt: now,
      isActive: true,
      web: payload.web?.enabled
        ? {
            enabled: true,
            slug: payload.web.slug,
            title: payload.title,
            excerpt: payload.web.excerpt ?? payload.description,
            content: payload.web.content ?? payload.contentLong,
            publishedAt: now,
          }
        : null,
      social: null,
      sourceMeta: {
        system: 'openclaw',
        externalId: payload.externalId,
        sourceRefs: payload.sourceMeta.sourceRefs,
        evidenceRefs: payload.sourceMeta.evidenceRefs,
        approvedAt: payload.sourceMeta.approvedAt ?? null,
        approvedBy: payload.sourceMeta.approvedBy ?? null,
      },
      channels: payload.channels,
    }) as Record<string, unknown>;

    try {
      await docRef.create(docPayload);
    } catch (error) {
      const duplicateCheck = await docRef.get();
      if (duplicateCheck.exists) {
        return NextResponse.json({
          success: true,
          id: payload.externalId,
          url: normalizePersistedUrl(duplicateCheck.data()),
        });
      }

      throw error;
    }

    const paths = buildRevalidationPaths(
      deps.getPublicLocalesFn(),
      payload.web?.enabled ? payload.web.slug : null
    );
    await safeRevalidatePaths(paths, deps);

    return NextResponse.json({
      success: true,
      id: payload.externalId,
      url: effectiveLink,
    });
  } catch (error) {
    console.error('[product-updates/publish] error:', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
